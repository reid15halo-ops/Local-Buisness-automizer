# Schema Guide — FreyAI Visions Supabase

Complete catalog of database tables, their columns, relationships, and naming conventions.

## Naming Conventions

- **Business tables**: German names (kunden, rechnungen, angebote, auftraege, anfragen, termine)
- **System tables**: English names (profiles, waitlist, automation_log, client_errors)
- **Column names**: German for domain fields (kunde_name, leistungsart, netto, brutto), English for system fields (id, user_id, created_at, status)
- **Primary keys**: TEXT (client-generated UUIDs via `crypto.randomUUID()`) for offline-first tables, UUID with `uuid_generate_v4()` for server-only tables
- **Foreign keys**: Always named `[related_table_singular]_id` (e.g., `kunde_id`, `angebot_id`)

## Table Catalog

### Core Business Tables

| Table | Purpose | PK Type | Key Columns |
|-------|---------|---------|-------------|
| `kunden` | Customers/CRM | TEXT | name, email, telefon, adresse, stadt, plz, kategorie, status |
| `anfragen` | Inquiries/Leads | TEXT | kunde_name, kunde_email, leistungsart, beschreibung, budget, termin, status |
| `angebote` | Quotes | TEXT | anfrage_id→anfragen, kunde_name, positionen(JSONB), netto, mwst, brutto, status, gueltig_bis |
| `auftraege` | Orders/Jobs | TEXT | angebot_id→angebote, kunde_name, positionen(JSONB), netto, mwst, arbeitszeit, status |
| `rechnungen` | Invoices | TEXT | auftrag_id→auftraege, kunde_name, positionen(JSONB), netto, mwst, brutto, status, faellig_am |
| `buchungen` | Bookkeeping entries | TEXT | rechnungs_id, betrag, kategorie, buchungsdatum, typ(einnahme/ausgabe) |

### Supporting Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `materialien` | Materials/inventory | name, einheit, preis, menge, mindestbestand, lieferant |
| `termine` | Calendar/appointments | titel, kunde_id, datum, uhrzeit_von, uhrzeit_bis, typ, notizen |
| `aufgaben` | Tasks/todos | titel, beschreibung, prioritaet, faellig_am, erledigt |
| `zeiteintraege` | Time tracking | auftrag_id, datum, stunden, beschreibung |
| `dokumente` | Document metadata | name, typ, pfad, groesse, zuordnung_typ, zuordnung_id |

### System Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles (extends auth.users) | company_name, full_name, phone, plan, stripe_customer_id |
| `waitlist` | Landing page signups | email, source, converted |
| `automation_log` | n8n workflow logs | action, entity_type, entity_id, details(JSONB), triggered_by |
| `notifications` | User notifications | title, message, type, read, channel |
| `client_errors` | Frontend error tracking | message, stack, url, user_agent |
| `gobd_audit_log` | GoBD-compliant audit trail | action, entity_type, entity_id, old_value, new_value (append-only) |

### Specialized Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `purchase_orders` | Purchase orders | supplier_id, items(JSONB), total, status |
| `suppliers` | Supplier directory | name, kontakt, email, telefon, kategorie |
| `stock_movements` | Inventory movements | material_id, menge, typ(eingang/ausgang), referenz |
| `material_reservations` | Reserved materials | material_id, auftrag_id, menge, status |
| `communication_log` | Email/SMS/call log | kunde_id, kanal, richtung, inhalt, status |
| `portal_tokens` | Customer portal access | kunde_id, token, gueltig_bis, used |
| `portal_responses` | Customer portal submissions | token_id, antwort(JSONB) |
| `stripe_payments` | Stripe payment records | rechnungs_id, stripe_payment_intent_id, amount, status |
| `call_summaries` | Call recording transcriptions | call_id, zusammenfassung, stichpunkte, sentiment |
| `inbound_emails` | Inbound email processing | from_email, subject, body, processed, matched_kunde_id |
| `email_routing` | Email routing rules | pattern, action, destination |
| `admin_settings` | Per-user app settings | key, value(JSONB) |
| `bautagebuch_entries` | Construction diary | auftrag_id, datum, wetter, arbeiten, bemerkungen, fotos(JSONB) |

## Relationships

```
anfragen ──→ angebote ──→ auftraege ──→ rechnungen ──→ buchungen
                                    ├──→ zeiteintraege
                                    ├──→ bautagebuch_entries
                                    └──→ material_reservations ──→ materialien
                                                                       ↑
                                                              stock_movements
                                                                       ↑
                                                              purchase_orders ──→ suppliers

kunden ──→ termine
       ──→ communication_log
       ──→ portal_tokens ──→ portal_responses
       ──→ inbound_emails

rechnungen ──→ stripe_payments

profiles (1:1 with auth.users)
```

## Common Column Patterns

### Financial columns
```sql
netto DECIMAL(12,2) DEFAULT 0,
mwst DECIMAL(12,2) DEFAULT 0,
brutto DECIMAL(12,2) DEFAULT 0,
```
Note: FreyAI is Kleinunternehmer (§19 UStG) — MwSt is 0% but the columns exist for future use.

### Status enums (use CHECK constraints)
```sql
status TEXT DEFAULT 'offen' CHECK (status IN ('offen', 'versendet', 'angenommen', 'abgelehnt', 'storniert'))
```

Common status values by table:
- **kunden**: aktiv, inaktiv, gesperrt
- **anfragen**: neu, in_bearbeitung, angebot_erstellt, abgelehnt
- **angebote**: offen, versendet, angenommen, abgelehnt, abgelaufen
- **auftraege**: aktiv, in_bearbeitung, abgeschlossen, storniert
- **rechnungen**: offen, versendet, bezahlt, ueberfaellig, storniert, teilbezahlt

### Positionen (line items as JSONB)
```json
[
  {
    "pos": 1,
    "beschreibung": "Fliesenarbeiten Bad EG",
    "menge": 12.5,
    "einheit": "m²",
    "einzelpreis": 85.00,
    "gesamt": 1062.50
  }
]
```
