"""
Pydantic models for all request/response schemas.
Zone 2 - FreyAI Visions 95/5 Architecture
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    version: str
    services: dict[str, str]


# ---------------------------------------------------------------------------
# Math Guardrail
# ---------------------------------------------------------------------------


class LineItem(BaseModel):
    qty: float = Field(..., gt=0, description="Quantity (must be positive)")
    unit_price: float = Field(..., description="Price per unit (net)")
    total: float = Field(..., description="Line total as stated on document")


class MathValidateRequest(BaseModel):
    netto: float = Field(..., description="Net amount (before VAT)")
    mwst_rate: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="VAT rate as decimal, e.g. 0.19 for 19 %",
    )
    brutto: float = Field(..., description="Gross amount (including VAT)")
    items: list[LineItem] = Field(default_factory=list, description="Individual line items")

    @field_validator("brutto", "netto")
    @classmethod
    def must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Amount must be non-negative")
        return v


class TrafficLight(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class LineItemResult(BaseModel):
    index: int
    qty: float
    unit_price: float
    stated_total: float
    computed_total: float
    delta: float
    valid: bool


class MathValidateResponse(BaseModel):
    valid: bool
    confidence: float = Field(..., ge=0.0, le=1.0)
    traffic_light: TrafficLight
    corrected_brutto: float
    stated_brutto: float
    delta_brutto: float
    errors: list[str]
    warnings: list[str]
    line_item_results: list[LineItemResult]


# ---------------------------------------------------------------------------
# PII Sanitizer
# ---------------------------------------------------------------------------


class SanitizeMode(str, Enum):
    MASK = "mask"
    REMOVE = "remove"
    TOKENIZE = "tokenize"


class PiiSanitizeRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to sanitize")
    mode: SanitizeMode = Field(SanitizeMode.MASK, description="Sanitization mode")


class EntityFound(BaseModel):
    type: str = Field(..., description="Entity type, e.g. IBAN, EMAIL, PHONE")
    original: str = Field(..., description="Original matched text")
    replacement: str = Field(..., description="Replacement value applied")
    start: int = Field(..., description="Start character position in original text")
    end: int = Field(..., description="End character position in original text")


class PiiSanitizeResponse(BaseModel):
    sanitized_text: str
    entities_found: list[EntityFound]
    entity_count: int
    mode_used: SanitizeMode


# ---------------------------------------------------------------------------
# Image Processor
# ---------------------------------------------------------------------------


class ImageMetadata(BaseModel):
    width: int
    height: int
    deskew_angle: float = Field(..., description="Detected skew angle in degrees")
    processing_time_ms: float
    original_width: int
    original_height: int
    dpi_target: int = 300


class ImagePreprocessResponse(BaseModel):
    image_base64: str = Field(..., description="Preprocessed image as PNG base64 string")
    content_type: str = "image/png"
    metadata: ImageMetadata


class ImageUrlRequest(BaseModel):
    url: str = Field(..., description="HTTP(S) URL of the image to fetch and preprocess")
    timeout_seconds: float = Field(30.0, gt=0, le=120)


# ---------------------------------------------------------------------------
# Generic error envelope
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ---------------------------------------------------------------------------
# GoBD / CSV / DATEV Models
# ---------------------------------------------------------------------------


class CSVRow(BaseModel):
    """Single parsed CSV transaction row (German locale)."""

    datum: str = Field(..., description="Transaction date in DD.MM.YYYY format")
    belegnummer: str = Field(..., description="Document/invoice number (Belegnummer)")
    buchungstext: str = Field(..., description="Booking description (Buchungstext)")
    betrag: Decimal = Field(..., description="Transaction amount as Decimal")
    konto: str = Field(..., description="Account number (Konto)")
    gegenkonto: str = Field(..., description="Counter-account number (Gegenkonto)")
    # Optional extra fields passed through unchanged
    extra: dict[str, str] = Field(
        default_factory=dict, description="Any additional CSV columns"
    )

    @field_validator("betrag", mode="before")
    @classmethod
    def parse_german_decimal(cls, v: Any) -> Decimal:
        """
        Accept German-locale decimal strings like '1.234,56' or English '999.99'.

        Locale detection:
          - Both comma and dot present: rightmost separator is the decimal sep.
          - Only comma: German decimal comma (e.g. '123,45').
          - Only dot: English decimal point (e.g. '999.99').
        """
        if isinstance(v, Decimal):
            return v
        if isinstance(v, (int, float)):
            return Decimal(str(v))
        s = str(v).strip()
        has_comma = "," in s
        has_dot = "." in s
        if has_comma and has_dot:
            last_comma = s.rfind(",")
            last_dot = s.rfind(".")
            if last_comma > last_dot:
                # German: "1.234,56"
                s = s.replace(".", "").replace(",", ".")
            else:
                # English: "1,234.56"
                s = s.replace(",", "")
        elif has_comma:
            s = s.replace(",", ".")
        # else only dot or plain integer → use as-is
        try:
            return Decimal(s)
        except Exception as exc:
            raise ValueError(
                f"Cannot parse amount '{v}' as Decimal: {exc}"
            ) from exc


class ParseResult(BaseModel):
    """Response from POST /api/csv/parse."""

    rows: list[CSVRow] = Field(..., description="Successfully parsed rows")
    errors: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Validation errors per row: {row_index, field, message}",
    )
    total_rows: int
    valid_rows: int
    invalid_rows: int
    encoding_detected: str = Field("utf-8", description="Detected CSV file encoding")


class GoBDTransaction(BaseModel):
    """GoBD-validated transaction ready for DATEV export."""

    datum: str = Field(..., description="Date in DD.MM.YYYY format")
    belegnummer: str = Field(..., description="Sequential document number")
    buchungstext: str = Field(
        ..., description="Booking text (max 60 chars in DATEV)"
    )
    betrag: Decimal = Field(
        ...,
        description="Amount (always positive; direction indicated by soll_haben)",
    )
    soll_haben: str = Field(
        ...,
        description="Debit/credit indicator: 'S' (Soll) or 'H' (Haben)",
        pattern="^[SH]$",
    )
    konto: str = Field(..., description="Booking account")
    gegenkonto: str = Field(..., description="Counter-account")
    fiscal_year: int = Field(..., description="Fiscal year (YYYY)")
    period: int = Field(..., ge=1, le=12, description="Fiscal period (month 1-12)")
    created_at: Optional[str] = Field(
        None,
        description="ISO-8601 creation timestamp for immutability check",
    )


class DATEVExportRequest(BaseModel):
    """Request body for POST /api/datev/export."""

    transactions: list[GoBDTransaction] = Field(..., min_length=1)
    berater_nummer: str = Field(
        ...,
        description="DATEV consultant number (Beraternummer, 4-7 digits)",
        pattern=r"^\d{4,7}$",
    )
    mandant_nummer: str = Field(
        ...,
        description="DATEV client number (Mandantennummer, 1-5 digits)",
        pattern=r"^\d{1,5}$",
    )
    fiscal_year_begin: str = Field(
        ...,
        description="Start of fiscal year in YYYYMMDD format",
        pattern=r"^\d{8}$",
    )
    sachkonten_laenge: int = Field(
        4,
        ge=4,
        le=8,
        description="Account number length (Sachkontenlaenge), typically 4",
    )
    description: str = Field("", description="Optional export description / Bezeichnung")


class GoBDViolation(BaseModel):
    """A single GoBD compliance violation."""

    violation_type: str = Field(
        ...,
        description=(
            "Type: MISSING_FIELD | INVALID_DATE | SEQUENCE_GAP | "
            "WRONG_PERIOD | IMMUTABILITY_BREACH | INVALID_AMOUNT"
        ),
    )
    row_index: Optional[int] = Field(None, description="Affected row index (0-based)")
    belegnummer: Optional[str] = Field(None, description="Affected document number")
    field_name: Optional[str] = Field(None, description="Affected field name")
    detail: str = Field(..., description="Human-readable description")


class GoBDValidationResult(BaseModel):
    """Response from POST /api/gobd/prepare."""

    valid: bool = Field(..., description="True only when zero violations found")
    violations: list[GoBDViolation] = Field(default_factory=list)
    prepared_rows: list[GoBDTransaction] = Field(default_factory=list)
    summary: dict[str, Any] = Field(
        ...,
        description=(
            "{'total_entries': int, 'total_debit': Decimal, "
            "'total_credit': Decimal, 'period': str}"
        ),
    )
    requires_human_approval: bool = Field(
        True,
        description=(
            "Always True — enforces the 95/5 human-in-the-loop model: "
            "every GoBD export must be reviewed and approved by a human "
            "before submission to DATEV / Steuerberater."
        ),
    )


class InvoiceValidateRequest(BaseModel):
    """Request body for POST /api/validate/invoice."""

    datum: str = Field(..., description="Date string to validate (DD.MM.YYYY)")
    belegnummer: str = Field(..., description="Invoice/document number")
    buchungstext: str = Field(..., description="Booking description")
    betrag: Decimal = Field(..., description="Amount")
    konto: str = Field(..., description="Account")
    gegenkonto: str = Field(..., description="Counter-account")
    previous_belegnummer: Optional[str] = Field(
        None, description="Previous document number for sequential gap check"
    )

    @field_validator("betrag", mode="before")
    @classmethod
    def parse_german_decimal(cls, v: Any) -> Decimal:
        if isinstance(v, Decimal):
            return v
        if isinstance(v, (int, float)):
            return Decimal(str(v))
        s = str(v).strip()
        has_comma = "," in s
        has_dot = "." in s
        if has_comma and has_dot:
            last_comma = s.rfind(",")
            last_dot = s.rfind(".")
            if last_comma > last_dot:
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif has_comma:
            s = s.replace(",", ".")
        try:
            return Decimal(s)
        except Exception as exc:
            raise ValueError(
                f"Cannot parse amount '{v}' as Decimal: {exc}"
            ) from exc


class InvoiceValidateResponse(BaseModel):
    """Response from POST /api/validate/invoice."""

    valid: bool
    errors: list[str] = Field(default_factory=list)
