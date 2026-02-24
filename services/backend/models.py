"""
Pydantic models for all request/response schemas.
Zone 2 - FreyAI Visions 95/5 Architecture
"""

from __future__ import annotations

from enum import Enum
from typing import Any

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
