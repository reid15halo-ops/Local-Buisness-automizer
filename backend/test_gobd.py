"""
Pytest test suite for GoBD CSV parsing, GoBD validation,
DATEV export, math guardrail, and PII sanitizer.

Run with:
  cd services/backend && python -m pytest test_gobd.py -v
"""

from __future__ import annotations

import io
import csv
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# App under test
# ---------------------------------------------------------------------------
# We import main so that all routers are registered before tests run.
import sys
import os

# Ensure the backend directory is on sys.path so that relative imports work
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from main import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_CSV_CONTENT = (
    "Datum;Belegnummer;Buchungstext;Betrag;Konto;Gegenkonto\r\n"
    "01.01.2024;RE-001;Werkzeug Lieferung;1.190,00;4980;1600\r\n"
    "15.01.2024;RE-002;Betriebskosten;238,00;4980;1600\r\n"
    "31.01.2024;RE-003;Reparaturmaterial;595,00;4980;1600\r\n"
)

VALID_CSV_BYTES = VALID_CSV_CONTENT.encode("utf-8")


def _make_csv_bytes(rows: list[dict]) -> bytes:
    """Build a German-semicolon CSV from a list of row dicts."""
    buf = io.StringIO()
    fieldnames = ["Datum", "Belegnummer", "Buchungstext", "Betrag", "Konto", "Gegenkonto"]
    writer = csv.DictWriter(buf, fieldnames=fieldnames, delimiter=";", lineterminator="\r\n")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    return buf.getvalue().encode("utf-8")


def _upload_csv(content: bytes, filename: str = "test.csv") -> dict:
    response = client.post(
        "/api/csv/parse",
        files={"file": (filename, io.BytesIO(content), "text/csv")},
    )
    return response


# ---------------------------------------------------------------------------
# 1. GET /api/health
# ---------------------------------------------------------------------------


class TestApiHealth:
    def test_returns_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] in ("ok", "healthy")
        assert "version" in body

    def test_also_health_endpoint(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] in ("ok", "healthy")


# ---------------------------------------------------------------------------
# 2. POST /api/csv/parse – valid CSV
# ---------------------------------------------------------------------------


class TestCSVParseValid:
    def test_parse_valid_csv_returns_200(self):
        resp = _upload_csv(VALID_CSV_BYTES)
        assert resp.status_code == 200

    def test_parse_valid_csv_row_count(self):
        resp = _upload_csv(VALID_CSV_BYTES)
        body = resp.json()
        assert body["valid_rows"] == 3
        assert body["invalid_rows"] == 0
        assert body["total_rows"] == 3

    def test_parse_valid_csv_row_fields(self):
        resp = _upload_csv(VALID_CSV_BYTES)
        rows = resp.json()["rows"]
        assert rows[0]["datum"] == "01.01.2024"
        assert rows[0]["belegnummer"] == "RE-001"
        assert rows[0]["buchungstext"] == "Werkzeug Lieferung"
        # Decimal stored as string in JSON
        assert Decimal(rows[0]["betrag"]) == Decimal("1190.00")
        assert rows[0]["konto"] == "4980"
        assert rows[0]["gegenkonto"] == "1600"

    def test_parse_german_decimal_comma(self):
        """Values like '1.190,00' (German thousands+decimal) must parse correctly."""
        rows = [
            {
                "Datum": "05.03.2024",
                "Belegnummer": "RE-001",
                "Buchungstext": "Material",
                "Betrag": "2.345,67",
                "Konto": "4980",
                "Gegenkonto": "1600",
            }
        ]
        resp = _upload_csv(_make_csv_bytes(rows))
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid_rows"] == 1
        assert Decimal(body["rows"][0]["betrag"]) == Decimal("2345.67")

    def test_parse_negative_betrag(self):
        rows = [
            {
                "Datum": "05.03.2024",
                "Belegnummer": "GU-001",
                "Buchungstext": "Gutschrift",
                "Betrag": "-500,00",
                "Konto": "8400",
                "Gegenkonto": "1200",
            }
        ]
        resp = _upload_csv(_make_csv_bytes(rows))
        assert resp.status_code == 200
        assert Decimal(resp.json()["rows"][0]["betrag"]) == Decimal("-500.00")

    def test_encoding_detected_field_present(self):
        resp = _upload_csv(VALID_CSV_BYTES)
        body = resp.json()
        assert "encoding_detected" in body

    def test_comma_delimiter_fallback(self):
        """CSV with comma delimiter should also parse when semicolon is absent."""
        content = (
            "Datum,Belegnummer,Buchungstext,Betrag,Konto,Gegenkonto\r\n"
            "01.02.2024,INV-001,Beschreibung,100.00,4980,1600\r\n"
        )
        resp = _upload_csv(content.encode("utf-8"))
        assert resp.status_code == 200
        assert resp.json()["valid_rows"] == 1


# ---------------------------------------------------------------------------
# 3. POST /api/csv/parse – missing required fields
# ---------------------------------------------------------------------------


class TestCSVParseMissingFields:
    def test_missing_konto_flagged(self):
        rows = [
            {
                "Datum": "01.01.2024",
                "Belegnummer": "RE-001",
                "Buchungstext": "Test",
                "Betrag": "100,00",
                "Konto": "",
                "Gegenkonto": "1600",
            }
        ]
        resp = _upload_csv(_make_csv_bytes(rows))
        body = resp.json()
        assert body["invalid_rows"] >= 1
        error_fields = [e["field"] for e in body["errors"]]
        assert "Konto" in error_fields

    def test_missing_datum_flagged(self):
        rows = [
            {
                "Datum": "",
                "Belegnummer": "RE-001",
                "Buchungstext": "Test",
                "Betrag": "100,00",
                "Konto": "4980",
                "Gegenkonto": "1600",
            }
        ]
        resp = _upload_csv(_make_csv_bytes(rows))
        body = resp.json()
        assert body["invalid_rows"] >= 1

    def test_invalid_date_format_flagged(self):
        rows = [
            {
                "Datum": "2024-01-01",  # ISO format, not German
                "Belegnummer": "RE-001",
                "Buchungstext": "Test",
                "Betrag": "100,00",
                "Konto": "4980",
                "Gegenkonto": "1600",
            }
        ]
        resp = _upload_csv(_make_csv_bytes(rows))
        body = resp.json()
        assert body["invalid_rows"] >= 1
        error_messages = [e["message"] for e in body["errors"]]
        assert any("DD.MM.YYYY" in m or "format" in m.lower() for m in error_messages)

    def test_missing_required_csv_columns_raises_422(self):
        """CSV missing entire Konto column should return HTTP 422."""
        content = (
            "Datum;Belegnummer;Buchungstext;Betrag;Gegenkonto\r\n"
            "01.01.2024;RE-001;Test;100,00;1600\r\n"
        )
        resp = _upload_csv(content.encode("utf-8"))
        assert resp.status_code == 422

    def test_empty_file_returns_400(self):
        resp = _upload_csv(b"")
        assert resp.status_code == 400

    def test_invalid_amount_flagged(self):
        rows = [
            {
                "Datum": "01.01.2024",
                "Belegnummer": "RE-001",
                "Buchungstext": "Test",
                "Betrag": "not-a-number",
                "Konto": "4980",
                "Gegenkonto": "1600",
            }
        ]
        resp = _upload_csv(_make_csv_bytes(rows))
        body = resp.json()
        assert body["invalid_rows"] >= 1
        error_fields = [e["field"] for e in body["errors"]]
        assert "Betrag" in error_fields


# ---------------------------------------------------------------------------
# 4. POST /api/gobd/prepare – valid data
# ---------------------------------------------------------------------------


def _gobd_payload(rows=None):
    if rows is None:
        rows = [
            {
                "datum": "01.01.2024",
                "belegnummer": "RE-001",
                "buchungstext": "Werkzeugkauf",
                "betrag": "1190.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
            {
                "datum": "15.01.2024",
                "belegnummer": "RE-002",
                "buchungstext": "Betriebskosten",
                "betrag": "238.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
            {
                "datum": "31.01.2024",
                "belegnummer": "RE-003",
                "buchungstext": "Material",
                "betrag": "595.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
        ]
    return rows


class TestGoBDPrepareValid:
    def test_valid_transactions_pass(self):
        resp = client.post("/api/gobd/prepare", json=_gobd_payload())
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["violations"] == []

    def test_prepared_rows_count(self):
        resp = client.post("/api/gobd/prepare", json=_gobd_payload())
        body = resp.json()
        assert len(body["prepared_rows"]) == 3

    def test_summary_fields_present(self):
        resp = client.post("/api/gobd/prepare", json=_gobd_payload())
        summary = resp.json()["summary"]
        assert "total_entries" in summary
        assert "total_debit" in summary
        assert "total_credit" in summary
        assert "period" in summary

    def test_requires_human_approval_always_true(self):
        """The 95/5 human-in-the-loop flag must always be True."""
        resp = client.post("/api/gobd/prepare", json=_gobd_payload())
        body = resp.json()
        assert body["requires_human_approval"] is True

    def test_soll_haben_indicator(self):
        """Positive amount should get 'S' (Soll), negative should get 'H' (Haben)."""
        rows = [
            {
                "datum": "01.06.2024",
                "belegnummer": "RE-001",
                "buchungstext": "Einnahme",
                "betrag": "500.00",
                "konto": "1200",
                "gegenkonto": "8400",
                "extra": {},
            },
            {
                "datum": "02.06.2024",
                "belegnummer": "GU-001",
                "buchungstext": "Gutschrift",
                "betrag": "-200.00",
                "konto": "8400",
                "gegenkonto": "1200",
                "extra": {},
            },
        ]
        resp = client.post("/api/gobd/prepare", json=rows)
        body = resp.json()
        prepared = body["prepared_rows"]
        assert prepared[0]["soll_haben"] == "S"
        assert prepared[1]["soll_haben"] == "H"


# ---------------------------------------------------------------------------
# 5. POST /api/gobd/prepare – sequence gap detection
# ---------------------------------------------------------------------------


class TestGoBDSequenceGaps:
    def test_sequential_gap_creates_violation(self):
        """RE-001, RE-003 (gap at RE-002) should produce a SEQUENCE_GAP violation."""
        rows = [
            {
                "datum": "01.01.2024",
                "belegnummer": "RE-001",
                "buchungstext": "Kauf",
                "betrag": "100.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
            {
                "datum": "15.01.2024",
                "belegnummer": "RE-003",  # gap: RE-002 is missing
                "buchungstext": "Kauf 2",
                "betrag": "200.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
        ]
        resp = client.post("/api/gobd/prepare", json=rows)
        body = resp.json()
        assert body["valid"] is False
        violation_types = [v["violation_type"] for v in body["violations"]]
        assert "SEQUENCE_GAP" in violation_types

    def test_no_gap_when_sequential(self):
        resp = client.post("/api/gobd/prepare", json=_gobd_payload())
        body = resp.json()
        violation_types = [v["violation_type"] for v in body["violations"]]
        assert "SEQUENCE_GAP" not in violation_types

    def test_large_gap_reported(self):
        """Gap of 10 (RE-001 → RE-011) must be flagged."""
        rows = [
            {
                "datum": "01.01.2024",
                "belegnummer": "INV-001",
                "buchungstext": "First",
                "betrag": "100.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
            {
                "datum": "15.01.2024",
                "belegnummer": "INV-011",
                "buchungstext": "After big gap",
                "betrag": "200.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            },
        ]
        resp = client.post("/api/gobd/prepare", json=rows)
        body = resp.json()
        violation_types = [v["violation_type"] for v in body["violations"]]
        assert "SEQUENCE_GAP" in violation_types


# ---------------------------------------------------------------------------
# 6. POST /api/gobd/prepare – field validation violations
# ---------------------------------------------------------------------------


class TestGoBDFieldViolations:
    def test_missing_buchungstext_flagged(self):
        rows = [
            {
                "datum": "01.01.2024",
                "belegnummer": "RE-001",
                "buchungstext": "",
                "betrag": "100.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            }
        ]
        resp = client.post("/api/gobd/prepare", json=rows)
        body = resp.json()
        assert body["valid"] is False
        violation_types = [v["violation_type"] for v in body["violations"]]
        assert "MISSING_FIELD" in violation_types

    def test_invalid_date_format_flagged(self):
        rows = [
            {
                "datum": "2024-01-01",
                "belegnummer": "RE-001",
                "buchungstext": "Test",
                "betrag": "100.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            }
        ]
        resp = client.post("/api/gobd/prepare", json=rows)
        body = resp.json()
        assert body["valid"] is False
        violation_types = [v["violation_type"] for v in body["violations"]]
        assert "INVALID_DATE" in violation_types

    def test_empty_transactions_returns_422(self):
        resp = client.post("/api/gobd/prepare", json=[])
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 7. POST /api/datev/export – format correctness
# ---------------------------------------------------------------------------


def _datev_request_payload():
    return {
        "transactions": [
            {
                "datum": "01.01.2024",
                "belegnummer": "RE-001",
                "buchungstext": "Werkzeugkauf",
                "betrag": "1190.00",
                "soll_haben": "S",
                "konto": "4980",
                "gegenkonto": "1600",
                "fiscal_year": 2024,
                "period": 1,
                "created_at": None,
            }
        ],
        "berater_nummer": "12345",
        "mandant_nummer": "1",
        "fiscal_year_begin": "20240101",
        "sachkonten_laenge": 4,
        "description": "Test Export",
    }


class TestDATEVExport:
    def test_export_returns_200(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        assert resp.status_code == 200

    def test_export_content_type_csv(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        assert "text/csv" in resp.headers.get("content-type", "")

    def test_export_has_content_disposition(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert ".csv" in cd

    def test_extf_header_line1_starts_with_extf(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        # Decode with windows-1252 (DATEV standard) or utf-8 fallback
        try:
            content = resp.content.decode("windows-1252")
        except UnicodeDecodeError:
            content = resp.content.decode("utf-8", errors="replace")
        first_line = content.split("\r\n")[0]
        assert first_line.startswith('"EXTF"')

    def test_extf_header_line2_has_umsatz_column(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        try:
            content = resp.content.decode("windows-1252")
        except UnicodeDecodeError:
            content = resp.content.decode("utf-8", errors="replace")
        lines = content.split("\r\n")
        assert len(lines) >= 3  # header1, header2, at least 1 data row
        assert "Umsatz" in lines[1]
        assert "Soll/Haben-Kennzeichen" in lines[1]
        assert "Konto" in lines[1]
        assert "Buchungstext" in lines[1]

    def test_extf_data_row_contains_soll_haben(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        try:
            content = resp.content.decode("windows-1252")
        except UnicodeDecodeError:
            content = resp.content.decode("utf-8", errors="replace")
        lines = [l for l in content.split("\r\n") if l.strip()]
        data_row = lines[2]  # first data row after two headers
        fields = data_row.split(";")
        # fields[0] = amount, fields[1] = S/H indicator
        assert fields[1] in ("S", "H")

    def test_extf_amount_uses_german_decimal(self):
        """DATEV amounts use comma decimal separator."""
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        try:
            content = resp.content.decode("windows-1252")
        except UnicodeDecodeError:
            content = resp.content.decode("utf-8", errors="replace")
        lines = [l for l in content.split("\r\n") if l.strip()]
        data_row = lines[2]
        amount_field = data_row.split(";")[0]
        # Should contain comma (German decimal), e.g. "1190,00"
        assert "," in amount_field

    def test_berater_nummer_in_header(self):
        resp = client.post("/api/datev/export", json=_datev_request_payload())
        try:
            content = resp.content.decode("windows-1252")
        except UnicodeDecodeError:
            content = resp.content.decode("utf-8", errors="replace")
        assert "12345" in content.split("\r\n")[0]

    def test_empty_transactions_returns_422(self):
        payload = _datev_request_payload()
        payload["transactions"] = []
        resp = client.post("/api/datev/export", json=payload)
        # FastAPI validates min_length=1 → should return 422
        assert resp.status_code in (422, 400)


# ---------------------------------------------------------------------------
# 8. POST /api/validate/invoice
# ---------------------------------------------------------------------------


class TestValidateInvoice:
    def test_valid_invoice_returns_valid_true(self):
        payload = {
            "datum": "15.03.2024",
            "belegnummer": "RE-005",
            "buchungstext": "Materiallieferung",
            "betrag": "595.00",
            "konto": "4980",
            "gegenkonto": "1600",
        }
        resp = client.post("/api/validate/invoice", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["errors"] == []

    def test_missing_datum_returns_errors(self):
        payload = {
            "datum": "",
            "belegnummer": "RE-001",
            "buchungstext": "Test",
            "betrag": "100.00",
            "konto": "4980",
            "gegenkonto": "1600",
        }
        resp = client.post("/api/validate/invoice", json=payload)
        body = resp.json()
        assert body["valid"] is False
        assert len(body["errors"]) > 0

    def test_invalid_date_format_returns_error(self):
        payload = {
            "datum": "2024/03/15",
            "belegnummer": "RE-001",
            "buchungstext": "Test",
            "betrag": "100.00",
            "konto": "4980",
            "gegenkonto": "1600",
        }
        resp = client.post("/api/validate/invoice", json=payload)
        body = resp.json()
        assert body["valid"] is False
        assert any("DD.MM.YYYY" in e or "format" in e.lower() for e in body["errors"])

    def test_sequence_gap_detected(self):
        payload = {
            "datum": "15.03.2024",
            "belegnummer": "RE-005",
            "buchungstext": "Test",
            "betrag": "100.00",
            "konto": "4980",
            "gegenkonto": "1600",
            "previous_belegnummer": "RE-003",  # gap: RE-004 missing
        }
        resp = client.post("/api/validate/invoice", json=payload)
        body = resp.json()
        assert body["valid"] is False
        assert any("gap" in e.lower() or "sequence" in e.lower() for e in body["errors"])

    def test_no_gap_when_sequential(self):
        payload = {
            "datum": "15.03.2024",
            "belegnummer": "RE-004",
            "buchungstext": "Test",
            "betrag": "100.00",
            "konto": "4980",
            "gegenkonto": "1600",
            "previous_belegnummer": "RE-003",
        }
        resp = client.post("/api/validate/invoice", json=payload)
        body = resp.json()
        assert body["valid"] is True


# ---------------------------------------------------------------------------
# 9. Math Guardrail
# ---------------------------------------------------------------------------


class TestMathGuardrail:
    def test_correct_math_returns_valid_true(self):
        payload = {
            "netto": 1000.0,
            "mwst_rate": 0.19,
            "brutto": 1190.0,
            "items": [],
        }
        resp = client.post("/math/validate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["traffic_light"] == "green"

    def test_wrong_brutto_returns_invalid(self):
        payload = {
            "netto": 1000.0,
            "mwst_rate": 0.19,
            "brutto": 1500.0,  # Should be 1190
            "items": [],
        }
        resp = client.post("/math/validate", json=payload)
        body = resp.json()
        assert body["valid"] is False
        assert body["traffic_light"] in ("yellow", "red")

    def test_line_item_mismatch_flagged(self):
        payload = {
            "netto": 100.0,
            "mwst_rate": 0.19,
            "brutto": 119.0,
            "items": [
                {"qty": 2.0, "unit_price": 50.0, "total": 90.0}  # Should be 100
            ],
        }
        resp = client.post("/math/validate", json=payload)
        body = resp.json()
        assert body["line_item_results"][0]["valid"] is False

    def test_confidence_score_between_0_and_1(self):
        payload = {
            "netto": 500.0,
            "mwst_rate": 0.07,
            "brutto": 535.0,
            "items": [],
        }
        resp = client.post("/math/validate", json=payload)
        body = resp.json()
        assert 0.0 <= body["confidence"] <= 1.0

    def test_negative_netto_rejected(self):
        payload = {
            "netto": -100.0,
            "mwst_rate": 0.19,
            "brutto": -119.0,
        }
        resp = client.post("/math/validate", json=payload)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 10. PII Sanitizer
# ---------------------------------------------------------------------------


class TestPIISanitizer:
    def test_iban_removed(self):
        payload = {
            "text": "Bitte überweisen Sie auf DE89 3704 0044 0532 0130 00",
            "mode": "mask",
        }
        resp = client.post("/pii/sanitize", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert "DE89" not in body["sanitized_text"]
        assert body["entity_count"] >= 1
        entity_types = [e["type"] for e in body["entities_found"]]
        assert "IBAN" in entity_types

    def test_email_removed(self):
        payload = {
            "text": "Kontakt: max.mustermann@example.de",
            "mode": "mask",
        }
        resp = client.post("/pii/sanitize", json=payload)
        body = resp.json()
        assert "max.mustermann@example.de" not in body["sanitized_text"]
        entity_types = [e["type"] for e in body["entities_found"]]
        assert "EMAIL" in entity_types

    def test_phone_removed(self):
        payload = {
            "text": "Rückruf unter +49 30 12345678",
            "mode": "mask",
        }
        resp = client.post("/pii/sanitize", json=payload)
        body = resp.json()
        entity_types = [e["type"] for e in body["entities_found"]]
        assert "PHONE" in entity_types

    def test_remove_mode_empties_pii(self):
        payload = {
            "text": "Email: test@example.com",
            "mode": "remove",
        }
        resp = client.post("/pii/sanitize", json=payload)
        body = resp.json()
        assert "test@example.com" not in body["sanitized_text"]
        assert body["mode_used"] == "remove"

    def test_tokenize_mode(self):
        payload = {
            "text": "IBAN: DE89 3704 0044 0532 0130 00",
            "mode": "tokenize",
        }
        resp = client.post("/pii/sanitize", json=payload)
        body = resp.json()
        assert body["mode_used"] == "tokenize"
        # Token replacement should start with [IBAN_
        assert "[IBAN_" in body["sanitized_text"]

    def test_no_pii_returns_unchanged_text(self):
        payload = {
            "text": "Keine persoenlichen Daten hier.",
            "mode": "mask",
        }
        resp = client.post("/pii/sanitize", json=payload)
        body = resp.json()
        assert body["entity_count"] == 0
        assert body["sanitized_text"] == payload["text"]


# ---------------------------------------------------------------------------
# 11. Model validators – Decimal parsing
# ---------------------------------------------------------------------------


class TestDecimalParsing:
    """Unit tests for the Decimal parsing validators in models."""

    def test_csv_row_german_decimal(self):
        from models import CSVRow

        row = CSVRow(
            datum="01.01.2024",
            belegnummer="RE-001",
            buchungstext="Test",
            betrag="1.234,56",
            konto="4980",
            gegenkonto="1600",
        )
        assert row.betrag == Decimal("1234.56")

    def test_csv_row_plain_decimal(self):
        from models import CSVRow

        row = CSVRow(
            datum="01.01.2024",
            belegnummer="RE-001",
            buchungstext="Test",
            betrag="999.99",
            konto="4980",
            gegenkonto="1600",
        )
        assert row.betrag == Decimal("999.99")

    def test_csv_row_integer_string(self):
        from models import CSVRow

        row = CSVRow(
            datum="01.01.2024",
            belegnummer="RE-001",
            buchungstext="Test",
            betrag="500",
            konto="4980",
            gegenkonto="1600",
        )
        assert row.betrag == Decimal("500")

    def test_csv_row_negative_german(self):
        from models import CSVRow

        row = CSVRow(
            datum="01.01.2024",
            belegnummer="GU-001",
            buchungstext="Gutschrift",
            betrag="-1.000,00",
            konto="8400",
            gegenkonto="1200",
        )
        assert row.betrag == Decimal("-1000.00")

    def test_csv_row_invalid_betrag_raises(self):
        from models import CSVRow
        import pytest

        with pytest.raises(Exception):
            CSVRow(
                datum="01.01.2024",
                belegnummer="RE-001",
                buchungstext="Test",
                betrag="not-a-number",
                konto="4980",
                gegenkonto="1600",
            )


# ---------------------------------------------------------------------------
# 12. GoBD Prepare – requires_human_approval always True (invariant)
# ---------------------------------------------------------------------------


class TestHumanApprovalInvariant:
    """Ensure requires_human_approval is ALWAYS True, even for valid data."""

    def test_human_approval_true_on_valid(self):
        resp = client.post("/api/gobd/prepare", json=_gobd_payload())
        assert resp.json()["requires_human_approval"] is True

    def test_human_approval_true_on_invalid(self):
        rows = [
            {
                "datum": "01.01.2024",
                "belegnummer": "RE-001",
                "buchungstext": "",  # Missing — will cause violation
                "betrag": "100.00",
                "konto": "4980",
                "gegenkonto": "1600",
                "extra": {},
            }
        ]
        resp = client.post("/api/gobd/prepare", json=rows)
        assert resp.json()["requires_human_approval"] is True
