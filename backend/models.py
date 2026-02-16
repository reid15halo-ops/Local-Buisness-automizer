"""FreyAI Core — Pydantic Models

Auto-generated from supabase_schema.sql.
Property names use snake_case matching the database columns.

Tables:
    Profile  — User profile & business settings (1:1 with auth.users)
    Client   — Customer / company records
    Product  — Product & service catalog
    Invoice  — Invoice headers with line-items as JSONB
"""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ────────────────────────────────────────────────────────────
# 1. PROFILE
# ────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    """Fields required / accepted when creating or updating a profile."""

    business_name: str = ""
    full_name: str = ""
    phone: str = ""
    address: str = ""
    tax_id: str = ""
    vat_id: str = ""
    settings_json: dict[str, Any] = Field(default_factory=dict)


class ProfileResponse(ProfileCreate):
    """Full profile row as returned from Supabase."""

    id: str
    created_at: datetime
    updated_at: datetime


# ────────────────────────────────────────────────────────────
# 2. CLIENT
# ────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    """Fields required / accepted when creating or updating a client."""

    company_name: str = ""
    contact_person: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    vat_id: str = ""
    notes: str = ""


class ClientResponse(ClientCreate):
    """Full client row as returned from Supabase."""

    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


# ────────────────────────────────────────────────────────────
# 3. PRODUCT
# ────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    """Fields required / accepted when creating or updating a product."""

    name: str
    description: str = ""
    price_net: float = 0.0
    tax_rate: float = 19.0
    unit: str = "Stk."
    active: bool = True


class ProductResponse(ProductCreate):
    """Full product row as returned from Supabase."""

    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


# ────────────────────────────────────────────────────────────
# 4. INVOICE
# ────────────────────────────────────────────────────────────

class InvoiceItem(BaseModel):
    """A single line-item inside an Invoice's items_json array."""

    description: str = ""
    quantity: float = 0.0
    unit: str = ""
    price_net: float = 0.0
    tax_rate: float = 0.0
    total: float = 0.0


class InvoiceCreate(BaseModel):
    """Fields required / accepted when creating or updating an invoice."""

    client_id: Optional[str] = None
    invoice_number: str
    date: str  # DATE stored as YYYY-MM-DD string
    due_date: str = ""  # DATE stored as YYYY-MM-DD string
    status: str = "draft"
    items_json: List[InvoiceItem] = Field(default_factory=list)
    total_net: float = 0.0
    total_gross: float = 0.0
    notes: str = ""


class InvoiceResponse(InvoiceCreate):
    """Full invoice row as returned from Supabase."""

    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
