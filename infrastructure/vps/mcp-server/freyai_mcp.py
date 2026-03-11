#!/usr/bin/env python3
"""
FreyAI Visions MCP Server — Model Context Protocol for AI-native access to business data.
Provides tools for customers, invoices, quotes, tickets, and scheduling.

Run: /opt/freyai-mcp/venv/bin/python freyai_mcp.py
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://incbhhaiiayohrjqevog.supabase.co")
SUPABASE_KEY = ""
_sk_path = "/home/openclaw/.openclaw/env/supabase_service_key"
if os.path.exists(_sk_path):
    with open(_sk_path) as f:
        SUPABASE_KEY = f.read().strip()

mcp = FastMCP(
    "FreyAI Visions",
    description="MCP Server for FreyAI business data (Kunden, Rechnungen, Angebote, Tickets)",
)

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------


async def supabase_get(table: str, select: str = "*", params: str = "", limit: int = 50) -> list | str:
    """Query Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit={limit}{params}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            url,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
    if resp.status_code != 200:
        return f"Fehler: {resp.status_code} {resp.text[:200]}"
    return resp.json()


def fmt_eur(val) -> str:
    """Format number as EUR string."""
    try:
        return f"{float(val):,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "0,00 EUR"


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------


@mcp.tool()
async def get_customers(search: str = "") -> str:
    """Suche Kunden nach Name, Firma oder Ort. Ohne Parameter: alle Kunden."""
    params = "&order=firma.asc"
    if search:
        params += f"&or=(firma.ilike.%25{search}%25,name.ilike.%25{search}%25,ort.ilike.%25{search}%25)"
    rows = await supabase_get("kunden", "id,firma,name,email,telefon,ort,strasse", params)
    if isinstance(rows, str):
        return rows
    if not rows:
        return "Keine Kunden gefunden."
    lines = [f"Kunden ({len(rows)}):\n"]
    for k in rows:
        lines.append(
            f"- {k.get('firma') or k.get('name', '?')} | {k.get('ort', '')} | {k.get('email', '')} | ID: {k['id']}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_customer_detail(customer_id: str) -> str:
    """Detailansicht eines Kunden mit allen Feldern."""
    rows = await supabase_get("kunden", "*", f"&id=eq.{customer_id}", 1)
    if isinstance(rows, str):
        return rows
    if not rows:
        return "Kunde nicht gefunden."
    k = rows[0]
    return json.dumps(k, indent=2, ensure_ascii=False, default=str)


@mcp.tool()
async def search_invoices(status: str = "", customer_id: str = "", limit: int = 20) -> str:
    """Suche Rechnungen. Filter: status (offen/bezahlt/storniert), customer_id."""
    params = "&order=created_at.desc"
    if status:
        params += f"&status=eq.{status}"
    if customer_id:
        params += f"&kunde_id=eq.{customer_id}"
    rows = await supabase_get(
        "rechnungen",
        "id,rechnungsnummer,kunde_id,brutto,netto,status,created_at,zahlungsziel_tage",
        params,
        limit,
    )
    if isinstance(rows, str):
        return rows
    if not rows:
        return "Keine Rechnungen gefunden."
    lines = [f"Rechnungen ({len(rows)}):\n"]
    for r in rows:
        datum = (r.get("created_at") or "")[:10]
        lines.append(
            f"- {r.get('rechnungsnummer', '?')} | {fmt_eur(r.get('brutto'))} | {r.get('status', '?')} | {datum}"
        )
    total = sum(float(r.get("brutto") or 0) for r in rows)
    lines.append(f"\nGesamt: {fmt_eur(total)}")
    return "\n".join(lines)


@mcp.tool()
async def get_quotes(status: str = "", limit: int = 20) -> str:
    """Angebote auflisten. Filter: status (offen/angenommen/abgelehnt)."""
    params = "&order=created_at.desc"
    if status:
        params += f"&status=eq.{status}"
    rows = await supabase_get(
        "angebote",
        "id,angebotsnummer,kunde_id,brutto,status,created_at,gueltig_bis",
        params,
        limit,
    )
    if isinstance(rows, str):
        return rows
    if not rows:
        return "Keine Angebote gefunden."
    lines = [f"Angebote ({len(rows)}):\n"]
    for a in rows:
        datum = (a.get("created_at") or "")[:10]
        lines.append(
            f"- {a.get('angebotsnummer', '?')} | {fmt_eur(a.get('brutto'))} | {a.get('status', '?')} | {datum}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_tickets(status: str = "offen") -> str:
    """Support-Tickets auflisten. Default: offene Tickets."""
    params = "&order=created_at.desc"
    if status:
        params += f"&status=eq.{status}"
    rows = await supabase_get(
        "support_tickets",
        "id,ticket_nummer,betreff,status,priority,created_at",
        params,
        50,
    )
    if isinstance(rows, str):
        return rows
    if not rows:
        return "Keine Tickets gefunden."
    lines = [f"Tickets ({len(rows)}):\n"]
    for t in rows:
        datum = (t.get("created_at") or "")[:10]
        prio = t.get("priority", "")
        prio_icon = {"hoch": "!!", "dringend": "!!!"}.get(prio, "")
        lines.append(
            f"- {t.get('ticket_nummer', '?')} {prio_icon} | {t.get('betreff', '')} | {t.get('status', '?')} | {datum}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_schedule(days: int = 7) -> str:
    """Termine der naechsten N Tage (Standard: 7)."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    params = f"&datum=gte.{now[:10]}&order=datum.asc"
    rows = await supabase_get("termine", "id,titel,datum,uhrzeit,kunde_id,ort,notizen", params, 50)
    if isinstance(rows, str):
        return rows
    if not rows:
        return f"Keine Termine in den naechsten {days} Tagen."
    lines = [f"Termine ({len(rows)}):\n"]
    for t in rows:
        lines.append(
            f"- {t.get('datum', '?')} {t.get('uhrzeit', '')} | {t.get('titel', '')} | {t.get('ort', '')}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_revenue_summary() -> str:
    """Umsatz-Zusammenfassung: Monat, Quartal, Jahr."""
    rows = await supabase_get(
        "rechnungen",
        "brutto,status,created_at",
        "&status=eq.bezahlt",
        1000,
    )
    if isinstance(rows, str):
        return rows
    now = datetime.now()
    month_total = 0.0
    quarter_total = 0.0
    year_total = 0.0
    for r in rows:
        brutto = float(r.get("brutto") or 0)
        created = (r.get("created_at") or "")[:10]
        try:
            dt = datetime.strptime(created, "%Y-%m-%d")
        except ValueError:
            continue
        if dt.year == now.year:
            year_total += brutto
            if dt.month == now.month:
                month_total += brutto
            q_now = (now.month - 1) // 3
            q_inv = (dt.month - 1) // 3
            if q_now == q_inv:
                quarter_total += brutto

    return (
        f"Umsatz-Zusammenfassung ({now.strftime('%d.%m.%Y')}):\n\n"
        f"Monat ({now.strftime('%B %Y')}): {fmt_eur(month_total)}\n"
        f"Quartal Q{(now.month - 1) // 3 + 1}/{now.year}: {fmt_eur(quarter_total)}\n"
        f"Jahr {now.year}: {fmt_eur(year_total)}"
    )


@mcp.tool()
async def get_overdue_invoices() -> str:
    """Ueberfaellige Rechnungen auflisten."""
    rows = await supabase_get(
        "rechnungen",
        "id,rechnungsnummer,kunde_id,brutto,status,created_at,zahlungsziel_tage",
        "&status=neq.bezahlt&status=neq.storniert",
        500,
    )
    if isinstance(rows, str):
        return rows
    today = datetime.now().date()
    overdue = []
    for r in rows:
        try:
            created = datetime.strptime((r.get("created_at") or "")[:10], "%Y-%m-%d").date()
            zt = int(r.get("zahlungsziel_tage") or 14)
            from datetime import timedelta

            faellig = created + timedelta(days=zt)
            if faellig < today:
                days_over = (today - faellig).days
                overdue.append((r, days_over))
        except (ValueError, TypeError):
            continue
    if not overdue:
        return "Keine ueberfaelligen Rechnungen."
    overdue.sort(key=lambda x: -x[1])
    lines = [f"Ueberfaellige Rechnungen ({len(overdue)}):\n"]
    total = 0.0
    for r, days in overdue:
        total += float(r.get("brutto") or 0)
        lines.append(
            f"- {r.get('rechnungsnummer', '?')} | {fmt_eur(r.get('brutto'))} | {days} Tage ueberfaellig"
        )
    lines.append(f"\nGesamt ueberfaellig: {fmt_eur(total)}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
