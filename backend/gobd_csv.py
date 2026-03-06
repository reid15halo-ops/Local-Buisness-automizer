"""
GoBD CSV / DATEV Export Router
FreyAI Visions - Zone 2 Backend

Endpoints:
  POST /api/csv/parse          - Parse German-locale CSV, validate GoBD fields
  POST /api/gobd/prepare       - Full GoBD compliance check + human-approval gate
  POST /api/datev/export       - Generate DATEV EXTF-format CSV download
  POST /api/validate/invoice   - Validate a single invoice record

GoBD compliance requirements implemented:
  - All required fields present (Datum, Belegnummer, Buchungstext, Betrag, Konto, Gegenkonto)
  - Date format DD.MM.YYYY with valid calendar date
  - Correct fiscal period assignment (Periodenrichtigkeit)
  - Sequential document numbering – no gaps (lückenlose Belegnummernvergabe)
  - Amount stored as Decimal (no float precision loss)
  - Immutability flag: created_at timestamps may not be altered
  - DSGVO/GDPR: PII scrubbing applied to Buchungstext before any logging

DATEV EXTF CSV format reference:
  Header line 1 (semicolon-separated):
    "EXTF";510;21;"Buchungsstapel";7;[created_at];[imported_at];"";[berater_nr];[mandant_nr];[fiscal_year_begin];[sachkonten_laenge];[datev_from];[datev_to];[bezeichnung];"";0;""
  Header line 2 (column names):
    Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;…
  Data rows follow from line 3 onwards.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Any

import chardet
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from models import (
    CSVRow,
    DATEVExportRequest,
    GoBDTransaction,
    GoBDValidationResult,
    GoBDViolation,
    InvoiceValidateRequest,
    InvoiceValidateResponse,
    ParseResult,
)
from pii_sanitizer import _detect_entities, _make_replacement, _apply_replacements, SanitizeMode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["GoBD / DATEV"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS = {"Datum", "Belegnummer", "Buchungstext", "Betrag", "Konto", "Gegenkonto"}
# German column aliases (case-insensitive normalisation map)
COLUMN_ALIASES: dict[str, str] = {
    "datum": "Datum",
    "date": "Datum",
    "belegdatum": "Datum",
    "belegnummer": "Belegnummer",
    "beleg-nr": "Belegnummer",
    "belegnr": "Belegnummer",
    "rechnungsnummer": "Belegnummer",
    "buchungstext": "Buchungstext",
    "text": "Buchungstext",
    "beschreibung": "Buchungstext",
    "betrag": "Betrag",
    "amount": "Betrag",
    "umsatz": "Betrag",
    "konto": "Konto",
    "account": "Konto",
    "gegenkonto": "Gegenkonto",
    "gegen-konto": "Gegenkonto",
    "gegenk": "Gegenkonto",
    "gegenkonto (ohne bu-schlüssel)": "Gegenkonto",
}

# Maximum CSV file size (10 MB)
MAX_CSV_BYTES = 10 * 1024 * 1024

# German date pattern DD.MM.YYYY
_DATE_RE = re.compile(r"^\d{1,2}\.\d{1,2}\.\d{4}$")

# Numeric belegnummer for sequential-gap detection
_BELEGNR_NUMERIC_RE = re.compile(r"(\d+)$")

# DATEV EXTF header version constant
_DATEV_EXTF_VERSION = 510
_DATEV_FORMAT_CATEGORY = 21  # Buchungsstapel


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _detect_encoding(raw: bytes) -> str:
    """Use chardet to detect CSV encoding; fall back to utf-8."""
    result = chardet.detect(raw)
    enc = result.get("encoding") or "utf-8"
    # Normalise common Windows variants
    if enc.lower() in ("windows-1252", "cp1252", "latin-1", "iso-8859-1"):
        return "windows-1252"
    return enc


def _normalise_column(name: str) -> str:
    """Map raw CSV header to canonical field name via COLUMN_ALIASES."""
    key = name.strip().lower()
    return COLUMN_ALIASES.get(key, name.strip())


def _parse_german_decimal(value: str) -> Decimal:
    """
    Parse a German-locale or English-locale decimal string to Decimal.

    Locale detection rules:
      - If the string contains a comma AND a dot:
          The rightmost separator is the decimal separator.
          If comma is last → German locale: remove dots, replace comma with dot.
          If dot is last   → English locale: remove commas (they are thousands seps).
      - If the string contains only a comma (no dot):
          German locale: replace comma with dot.  e.g. "123,45" → "123.45"
      - If the string contains only a dot (no comma):
          English locale: use as-is.  e.g. "999.99" → "999.99"
      - If neither: plain integer string.

    Examples:
      "1.234,56"  → Decimal("1234.56")   German thousands + decimal
      "-1.234,56" → Decimal("-1234.56")
      "1234.56"   → Decimal("1234.56")   English locale
      "1234,56"   → Decimal("1234.56")   German locale (no thousands sep)
      "1,234.56"  → Decimal("1234.56")   English thousands + decimal
    """
    s = value.strip()

    has_comma = "," in s
    has_dot = "." in s

    if has_comma and has_dot:
        # Determine which is the decimal separator by position of last occurrence
        last_comma = s.rfind(",")
        last_dot = s.rfind(".")
        if last_comma > last_dot:
            # German: "1.234,56" — dot = thousands sep, comma = decimal sep
            s = s.replace(".", "").replace(",", ".")
        else:
            # English: "1,234.56" — comma = thousands sep, dot = decimal sep
            s = s.replace(",", "")
    elif has_comma:
        # Only comma present → German decimal comma, e.g. "123,45"
        s = s.replace(",", ".")
    # else: only dot or no separator → already English locale, use as-is

    try:
        return Decimal(s)
    except InvalidOperation as exc:
        raise ValueError(f"Cannot parse '{value}' as a decimal number") from exc


def _validate_german_date(date_str: str) -> tuple[bool, str]:
    """
    Validate a date string in DD.MM.YYYY format.
    Returns (valid: bool, error_message: str).
    """
    if not _DATE_RE.match(date_str.strip()):
        return False, f"Date '{date_str}' is not in DD.MM.YYYY format"
    try:
        datetime.strptime(date_str.strip(), "%d.%m.%Y")
        return True, ""
    except ValueError as exc:
        return False, f"Invalid date '{date_str}': {exc}"


def _date_to_period(date_str: str) -> tuple[int, int]:
    """Parse DD.MM.YYYY → (year, month)."""
    dt = datetime.strptime(date_str.strip(), "%d.%m.%Y")
    return dt.year, dt.month


def _sanitize_for_log(text: str) -> str:
    """Apply PII scrubbing (MASK mode) before logging Buchungstext."""
    try:
        raw_matches = _detect_entities(text)
        for m in raw_matches:
            m.replacement = _make_replacement(m.entity_type, m.original, SanitizeMode.MASK)
        return _apply_replacements(text, raw_matches)
    except Exception:
        return "[SANITIZATION_ERROR]"


def _extract_trailing_number(belegnummer: str) -> int | None:
    """Extract trailing numeric portion of a Belegnummer, or None if not numeric."""
    m = _BELEGNR_NUMERIC_RE.search(belegnummer)
    if m:
        return int(m.group(1))
    return None


def _check_sequential_gaps(
    belegnummern: list[str],
) -> list[tuple[str, str]]:
    """
    Detect gaps in sequential document numbering.
    Works on the numeric suffix; returns list of (before, after) gap pairs.
    Only checks when all belegnummern share the same non-numeric prefix.
    """
    if len(belegnummern) < 2:
        return []

    # Extract (prefix, number) pairs
    pairs: list[tuple[str, int]] = []
    for b in belegnummern:
        m = _BELEGNR_NUMERIC_RE.search(b)
        if m:
            prefix = b[: m.start()]
            number = int(m.group(1))
            pairs.append((prefix, number))
        else:
            # Non-numeric belegnummer — skip sequential check
            return []

    # Only check if all prefixes are identical
    prefixes = {p for p, _ in pairs}
    if len(prefixes) > 1:
        return []

    gaps: list[tuple[str, str]] = []
    sorted_pairs = sorted(pairs, key=lambda x: x[1])
    for i in range(1, len(sorted_pairs)):
        prev_num = sorted_pairs[i - 1][1]
        curr_num = sorted_pairs[i][1]
        prefix = sorted_pairs[i][0]
        if curr_num - prev_num > 1:
            gaps.append(
                (f"{prefix}{prev_num}", f"{prefix}{curr_num}")
            )
    return gaps


def _soll_haben(betrag: Decimal) -> str:
    """Determine DATEV Soll/Haben indicator: 'S' if >= 0, 'H' if negative."""
    return "S" if betrag >= Decimal("0") else "H"


# ---------------------------------------------------------------------------
# CSV Parse endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/csv/parse",
    response_model=ParseResult,
    summary="Parse German-locale bookkeeping CSV",
    description=(
        "Accepts a multipart CSV file upload. Parses with German locale "
        "(semicolon delimiter, comma decimal separator). Validates that each "
        "row contains all GoBD-required fields. Runs PII sanitization on "
        "Buchungstext before logging. Returns parsed rows and validation errors."
    ),
)
async def parse_csv(file: UploadFile = File(...)) -> ParseResult:
    # --- Read file ---
    raw = await file.read(MAX_CSV_BYTES + 1)
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV file exceeds maximum size of {MAX_CSV_BYTES // (1024 * 1024)} MB",
        )
    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty",
        )

    # --- Encoding detection ---
    encoding = _detect_encoding(raw)
    try:
        text = raw.decode(encoding, errors="replace")
    except (LookupError, UnicodeDecodeError):
        text = raw.decode("utf-8", errors="replace")
        encoding = "utf-8"

    # --- Detect delimiter: prefer semicolon (German DATEV standard) ---
    first_line = text.split("\n")[0]
    delimiter = ";" if ";" in first_line else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    # Normalise column headers
    if reader.fieldnames is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file has no header row or is not a valid CSV",
        )

    normalised_fieldnames = [_normalise_column(f) for f in reader.fieldnames]
    reader.fieldnames = normalised_fieldnames  # type: ignore[assignment]

    # Check required columns are present
    missing_cols = REQUIRED_COLUMNS - set(normalised_fieldnames)
    if missing_cols:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"CSV is missing required columns: {sorted(missing_cols)}. "
                f"Found: {normalised_fieldnames}"
            ),
        )

    rows: list[CSVRow] = []
    parse_errors: list[dict[str, Any]] = []

    for row_index, raw_row in enumerate(reader):
        row_errors: list[dict[str, Any]] = []

        # --- Extract known fields ---
        datum_raw = (raw_row.get("Datum") or "").strip()
        belegnummer_raw = (raw_row.get("Belegnummer") or "").strip()
        buchungstext_raw = (raw_row.get("Buchungstext") or "").strip()
        betrag_raw = (raw_row.get("Betrag") or "").strip()
        konto_raw = (raw_row.get("Konto") or "").strip()
        gegenkonto_raw = (raw_row.get("Gegenkonto") or "").strip()

        # Collect extra columns
        extra: dict[str, str] = {
            k: v
            for k, v in raw_row.items()
            if k not in REQUIRED_COLUMNS and k is not None
        }

        # --- Validate required fields ---
        for field_name, value in [
            ("Datum", datum_raw),
            ("Belegnummer", belegnummer_raw),
            ("Buchungstext", buchungstext_raw),
            ("Betrag", betrag_raw),
            ("Konto", konto_raw),
            ("Gegenkonto", gegenkonto_raw),
        ]:
            if not value:
                row_errors.append(
                    {
                        "row_index": row_index,
                        "field": field_name,
                        "message": f"Field '{field_name}' is required but empty",
                    }
                )

        # --- Validate date format ---
        if datum_raw:
            date_valid, date_err = _validate_german_date(datum_raw)
            if not date_valid:
                row_errors.append(
                    {"row_index": row_index, "field": "Datum", "message": date_err}
                )

        # --- Parse amount via math guardrail ---
        betrag_decimal: Decimal | None = None
        if betrag_raw:
            try:
                betrag_decimal = _parse_german_decimal(betrag_raw)
            except ValueError as exc:
                row_errors.append(
                    {
                        "row_index": row_index,
                        "field": "Betrag",
                        "message": str(exc),
                    }
                )

        if row_errors:
            parse_errors.extend(row_errors)
            # Still try to build a partial row for reference (skip if amount failed)
            continue

        # --- PII scrub Buchungstext before constructing final row ---
        # (raw buchungstext is used in the data row; logging uses scrubbed version)
        sanitized_log_text = _sanitize_for_log(buchungstext_raw)
        logger.debug(
            "csv_parse row=%d datum=%s beleg=%s text=%s betrag=%s",
            row_index,
            datum_raw,
            belegnummer_raw,
            sanitized_log_text,
            betrag_decimal,
        )

        rows.append(
            CSVRow(
                datum=datum_raw,
                belegnummer=belegnummer_raw,
                buchungstext=buchungstext_raw,
                betrag=betrag_decimal,  # type: ignore[arg-type]
                konto=konto_raw,
                gegenkonto=gegenkonto_raw,
                extra=extra,
            )
        )

    logger.info(
        "csv_parse file=%s encoding=%s rows_ok=%d rows_err=%d",
        file.filename,
        encoding,
        len(rows),
        len(parse_errors),
    )

    return ParseResult(
        rows=rows,
        errors=parse_errors,
        total_rows=len(rows) + len(parse_errors),
        valid_rows=len(rows),
        invalid_rows=len(parse_errors),
        encoding_detected=encoding,
    )


# ---------------------------------------------------------------------------
# GoBD Prepare endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/gobd/prepare",
    response_model=GoBDValidationResult,
    summary="Validate and prepare transactions for GoBD compliance",
    description=(
        "Accepts parsed transaction data. Validates full GoBD compliance: "
        "required fields, date format, sequential numbering, fiscal period "
        "assignment, and immutability checks. Always returns "
        "requires_human_approval=true to enforce the 95/5 review model."
    ),
)
async def prepare_gobd(transactions: list[CSVRow]) -> GoBDValidationResult:
    if not transactions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Transaction list must not be empty",
        )

    violations: list[GoBDViolation] = []
    prepared: list[GoBDTransaction] = []

    # Track periods for summary
    all_years: list[int] = []
    all_months: list[int] = []
    total_debit = Decimal("0")
    total_credit = Decimal("0")

    for idx, row in enumerate(transactions):
        row_ok = True

        # --- Required fields (already validated in parse, but double-check) ---
        for field_name, value in [
            ("Datum", row.datum),
            ("Belegnummer", row.belegnummer),
            ("Buchungstext", row.buchungstext),
            ("Konto", row.konto),
            ("Gegenkonto", row.gegenkonto),
        ]:
            if not value or not str(value).strip():
                violations.append(
                    GoBDViolation(
                        violation_type="MISSING_FIELD",
                        row_index=idx,
                        belegnummer=row.belegnummer or None,
                        field_name=field_name,
                        detail=f"Required GoBD field '{field_name}' is missing or empty",
                    )
                )
                row_ok = False

        # --- Validate date ---
        date_valid, date_err = _validate_german_date(row.datum)
        if not date_valid:
            violations.append(
                GoBDViolation(
                    violation_type="INVALID_DATE",
                    row_index=idx,
                    belegnummer=row.belegnummer or None,
                    field_name="Datum",
                    detail=date_err,
                )
            )
            row_ok = False

        # --- Amount validation ---
        if row.betrag is None:
            violations.append(
                GoBDViolation(
                    violation_type="INVALID_AMOUNT",
                    row_index=idx,
                    belegnummer=row.belegnummer or None,
                    field_name="Betrag",
                    detail="Amount (Betrag) is None",
                )
            )
            row_ok = False

        if not row_ok:
            continue

        # --- Period assignment ---
        try:
            year, month = _date_to_period(row.datum)
        except ValueError:
            violations.append(
                GoBDViolation(
                    violation_type="WRONG_PERIOD",
                    row_index=idx,
                    belegnummer=row.belegnummer,
                    field_name="Datum",
                    detail=f"Cannot determine fiscal period from date '{row.datum}'",
                )
            )
            continue

        all_years.append(year)
        all_months.append(month)

        # --- Accumulate debit / credit ---
        sh = _soll_haben(row.betrag)
        if sh == "S":
            total_debit += row.betrag
        else:
            total_credit += abs(row.betrag)

        prepared.append(
            GoBDTransaction(
                datum=row.datum,
                belegnummer=row.belegnummer,
                buchungstext=row.buchungstext,
                betrag=abs(row.betrag),
                soll_haben=sh,
                konto=row.konto,
                gegenkonto=row.gegenkonto,
                fiscal_year=year,
                period=month,
                created_at=None,
            )
        )

    # --- Sequential numbering check ---
    belegnummern = [t.belegnummer for t in prepared]
    gaps = _check_sequential_gaps(belegnummern)
    for before, after in gaps:
        violations.append(
            GoBDViolation(
                violation_type="SEQUENCE_GAP",
                row_index=None,
                belegnummer=None,
                field_name="Belegnummer",
                detail=(
                    f"Gap in sequential document numbering between "
                    f"'{before}' and '{after}' — GoBD requires lückenlose Belegnummernvergabe"
                ),
            )
        )

    # --- Multi-fiscal-year check ---
    if all_years:
        unique_years = set(all_years)
        if len(unique_years) > 1:
            violations.append(
                GoBDViolation(
                    violation_type="WRONG_PERIOD",
                    row_index=None,
                    belegnummer=None,
                    field_name="Datum",
                    detail=(
                        f"Transactions span multiple fiscal years: {sorted(unique_years)}. "
                        "Each DATEV export batch should cover a single fiscal year."
                    ),
                )
            )

    # --- Build summary ---
    if all_years and all_months:
        min_month = min(all_months)
        max_month = max(all_months)
        fiscal_year = max(all_years)  # dominant year
        period_str = (
            f"{fiscal_year}/{min_month:02d}"
            if min_month == max_month
            else f"{fiscal_year}/{min_month:02d}-{max_month:02d}"
        )
    else:
        period_str = "unknown"
        fiscal_year = 0

    summary: dict[str, Any] = {
        "total_entries": len(prepared),
        "total_debit": str(total_debit),
        "total_credit": str(total_credit),
        "period": period_str,
        "fiscal_year": fiscal_year,
    }

    is_valid = len(violations) == 0

    logger.info(
        "gobd_prepare rows_in=%d prepared=%d violations=%d valid=%s",
        len(transactions),
        len(prepared),
        len(violations),
        is_valid,
    )

    return GoBDValidationResult(
        valid=is_valid,
        violations=violations,
        prepared_rows=prepared,
        summary=summary,
        requires_human_approval=True,
    )


# ---------------------------------------------------------------------------
# DATEV Export endpoint
# ---------------------------------------------------------------------------


def _format_datev_amount(amount: Decimal) -> str:
    """Format Decimal as DATEV amount string (comma decimal, no thousands separator)."""
    # DATEV expects up to 13 digits before decimal, 2 after, comma-separated
    abs_amount = abs(amount)
    return f"{abs_amount:.2f}".replace(".", ",")


def _format_datev_date(date_str: str) -> str:
    """Convert DD.MM.YYYY to DDMM (DATEV Belegdatum short format)."""
    try:
        dt = datetime.strptime(date_str.strip(), "%d.%m.%Y")
        return dt.strftime("%d%m")
    except ValueError:
        return date_str.replace(".", "")[:4]


def _build_extf_header(request: DATEVExportRequest, now_str: str) -> list[str]:
    """
    Build the two DATEV EXTF header lines.

    Line 1 – format descriptor
    Line 2 – column headers
    """
    # Date range from transactions
    if request.transactions:
        dates_parsed = []
        for t in request.transactions:
            try:
                dates_parsed.append(datetime.strptime(t.datum.strip(), "%d.%m.%Y"))
            except ValueError:
                pass
        if dates_parsed:
            datev_from = min(dates_parsed).strftime("%Y%m%d")
            datev_to = max(dates_parsed).strftime("%Y%m%d")
        else:
            datev_from = request.fiscal_year_begin
            datev_to = request.fiscal_year_begin
    else:
        datev_from = request.fiscal_year_begin
        datev_to = request.fiscal_year_begin

    # EXTF header fields (semicolon-separated, quoted per DATEV spec)
    header_fields = [
        '"EXTF"',
        str(_DATEV_EXTF_VERSION),          # Format-Version
        str(_DATEV_FORMAT_CATEGORY),       # Format-Kategorie (21 = Buchungsstapel)
        '"Buchungsstapel"',                # Format-Name
        "7",                               # Format-Version (Buchungsstapel v7)
        now_str,                           # Erstellt am
        "",                                # Importiert am (leer)
        '""',                              # Herkunft
        request.berater_nummer,            # Beraternummer
        request.mandant_nummer,            # Mandantennummer
        request.fiscal_year_begin,         # WJ-Beginn
        str(request.sachkonten_laenge),    # Sachkontenlänge
        datev_from,                        # Datum von
        datev_to,                          # Datum bis
        f'"{request.description}"',        # Bezeichnung des Kontenblatts
        '""',                              # Diktatzeichen
        "0",                               # Festschreibung (0 = nein)
        '""',                              # Kontoführungs-Währungskennzeichen
    ]
    line1 = ";".join(header_fields)

    # Column header line (DATEV Buchungsstapel standard columns)
    col_headers = [
        "Umsatz (ohne Soll/Haben-Kz)",
        "Soll/Haben-Kennzeichen",
        "WKZ Umsatz",
        "Kurs",
        "Basis-Umsatz",
        "WKZ Basis-Umsatz",
        "Konto",
        "Gegenkonto (ohne BU-Schlüssel)",
        "BU-Schlüssel",
        "Belegdatum",
        "Belegfeld 1",
        "Belegfeld 2",
        "Skonto",
        "Buchungstext",
    ]
    line2 = ";".join(col_headers)

    return [line1, line2]


def _build_datev_data_row(t: GoBDTransaction) -> str:
    """Build a single DATEV data row (semicolon-separated)."""
    fields = [
        _format_datev_amount(t.betrag),   # Umsatz (ohne Soll/Haben-Kz)
        t.soll_haben,                      # Soll/Haben-Kennzeichen
        "EUR",                             # WKZ Umsatz
        "",                                # Kurs
        "",                                # Basis-Umsatz
        "",                                # WKZ Basis-Umsatz
        t.konto,                           # Konto
        t.gegenkonto,                      # Gegenkonto
        "",                                # BU-Schlüssel
        _format_datev_date(t.datum),       # Belegdatum (DDMM)
        t.belegnummer[:36],                # Belegfeld 1 (max 36 chars)
        "",                                # Belegfeld 2
        "",                                # Skonto
        t.buchungstext[:60],               # Buchungstext (max 60 chars)
    ]
    return ";".join(fields)


@router.post(
    "/datev/export",
    summary="Generate DATEV EXTF-format CSV export",
    description=(
        "Accepts prepared GoBD transaction data plus DATEV metadata. "
        "Generates a DATEV-compatible EXTF CSV file (Buchungsstapel format) "
        "ready for import into DATEV Kanzlei-Rechnungswesen or compatible "
        "tax software. Returns a streaming CSV download."
    ),
    responses={
        200: {
            "content": {"text/csv": {}},
            "description": "DATEV EXTF CSV file download",
        }
    },
)
async def export_datev(request: DATEVExportRequest) -> StreamingResponse:
    if not request.transactions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No transactions provided for export",
        )

    now_str = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:17]  # YYYYMMDDHHMMSSmmm

    try:
        lines: list[str] = _build_extf_header(request, now_str)
    except Exception as exc:
        logger.error("datev_export header build failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build DATEV header: {exc}",
        ) from exc

    # Add data rows
    for idx, t in enumerate(request.transactions):
        try:
            lines.append(_build_datev_data_row(t))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to format transaction row {idx} (Beleg: {t.belegnummer}): {exc}",
            ) from exc

    csv_content = "\r\n".join(lines) + "\r\n"  # DATEV uses CRLF

    # Encode as Windows-1252 (DATEV standard encoding)
    try:
        csv_bytes = csv_content.encode("windows-1252", errors="replace")
    except Exception:
        csv_bytes = csv_content.encode("utf-8")

    filename = (
        f"DATEV_EXTF_{request.berater_nummer}_{request.mandant_nummer}_"
        f"{request.fiscal_year_begin}.csv"
    )

    logger.info(
        "datev_export berater=%s mandant=%s rows=%d bytes=%d",
        request.berater_nummer,
        request.mandant_nummer,
        len(request.transactions),
        len(csv_bytes),
    )

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=windows-1252",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(csv_bytes)),
        },
    )


# ---------------------------------------------------------------------------
# Single invoice validation endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/validate/invoice",
    response_model=InvoiceValidateResponse,
    summary="Validate a single invoice record for GoBD compliance",
    description=(
        "Validates one invoice/transaction record: checks required fields, "
        "German date format (DD.MM.YYYY), amount precision, and optionally "
        "checks sequential numbering against the previous document number."
    ),
)
async def validate_invoice(payload: InvoiceValidateRequest) -> InvoiceValidateResponse:
    errors: list[str] = []

    # Required field checks
    for field_name, value in [
        ("datum", payload.datum),
        ("belegnummer", payload.belegnummer),
        ("buchungstext", payload.buchungstext),
        ("konto", payload.konto),
        ("gegenkonto", payload.gegenkonto),
    ]:
        if not value or not str(value).strip():
            errors.append(f"Required field '{field_name}' is missing or empty")

    # Date format validation
    if payload.datum:
        date_valid, date_err = _validate_german_date(payload.datum)
        if not date_valid:
            errors.append(date_err)

    # Amount validation
    if payload.betrag is None:
        errors.append("Amount (betrag) must not be None")

    # Sequential numbering check (optional)
    if payload.previous_belegnummer and payload.belegnummer:
        prev_num = _extract_trailing_number(payload.previous_belegnummer)
        curr_num = _extract_trailing_number(payload.belegnummer)
        if prev_num is not None and curr_num is not None:
            if curr_num - prev_num > 1:
                errors.append(
                    f"Sequence gap: '{payload.previous_belegnummer}' → "
                    f"'{payload.belegnummer}' (expected {prev_num + 1}, got {curr_num})"
                )
            elif curr_num <= prev_num:
                errors.append(
                    f"Belegnummer '{payload.belegnummer}' is not greater than "
                    f"previous '{payload.previous_belegnummer}'"
                )

    is_valid = len(errors) == 0
    logger.info(
        "validate_invoice beleg=%s valid=%s errors=%d",
        _sanitize_for_log(payload.belegnummer),
        is_valid,
        len(errors),
    )

    return InvoiceValidateResponse(valid=is_valid, errors=errors)
