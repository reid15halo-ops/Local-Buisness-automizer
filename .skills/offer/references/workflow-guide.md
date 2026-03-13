# FreyAI Visions — Offer Workflow Guide

## Full Lifecycle

```
Anfrage (Inquiry)
  ↓ User reviews, decides to create offer
Angebot (Quote) — status: entwurf
  ↓ User reviews, approves
Angebot — status: offen (sent to customer)
  ↓ Customer reviews via email / portal
  ├─→ angenommen (accepted) → auto-creates Auftrag
  └─→ abgelehnt (rejected) → optional follow-up
Auftrag (Order) — status: in_bearbeitung
  ↓ Work completed
Rechnung (Invoice) — status: offen
  ↓ Customer pays
Rechnung — status: bezahlt
  ↓ If not paid
Mahnung (Reminder) → escalation
```

## Status Values

### Angebot Status
| Status | German | Meaning |
|--------|--------|---------|
| `entwurf` | Entwurf | Draft, not yet sent |
| `offen` | Offen | Sent to customer, awaiting response |
| `angenommen` | Angenommen | Customer accepted → triggers Auftrag creation |
| `abgelehnt` | Abgelehnt | Customer rejected |
| `vorläufig_gesendet` | Vorläufig gesendet | Preliminary version sent |

### Auftrag Status
| Status | German | Meaning |
|--------|--------|---------|
| `neu` | Neu | New order, just created |
| `in_bearbeitung` | In Bearbeitung | Work in progress |
| `abgeschlossen` | Abgeschlossen | Work completed |
| `storniert` | Storniert | Cancelled |

## Supabase Tables Involved

### angebote
```sql
id TEXT PRIMARY KEY,
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
anfrage_id TEXT REFERENCES anfragen(id),
kunde_name TEXT NOT NULL,
kunde_email TEXT,
kunde_telefon TEXT,
leistungsart TEXT,
positionen JSONB DEFAULT '[]',
angebots_text TEXT,
netto DECIMAL(12,2) DEFAULT 0,
mwst DECIMAL(12,2) DEFAULT 0,
brutto DECIMAL(12,2) DEFAULT 0,
status TEXT DEFAULT 'offen',
gueltig_bis DATE,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### auftraege
```sql
id TEXT PRIMARY KEY,
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
angebot_id TEXT REFERENCES angebote(id),
kunde_name TEXT NOT NULL,
kunde_email TEXT,
kunde_telefon TEXT,
leistungsart TEXT,
positionen JSONB DEFAULT '[]',
netto DECIMAL(12,2) DEFAULT 0,
mwst DECIMAL(12,2) DEFAULT 0,
brutto DECIMAL(12,2) DEFAULT 0,
status TEXT DEFAULT 'neu',
startdatum DATE,
enddatum DATE,
created_at TIMESTAMPTZ DEFAULT NOW()
```

## Key Code Paths

### Creating an Angebot
```
User clicks "Neues Angebot" in UI
  → js/modules/angebote.js: createAngebotFromAnfrage() or new form
  → Positions built via addPosition() or template picker
  → updateAngebotSummary() calculates totals
  → store.addAngebot(angebot) persists to IndexedDB + Supabase
  → anfrage.status updated to 'angebot-erstellt'
```

### AI-Powered Quote Generation
```
Anfrage exists with description
  → js/services/quote-intelligence-service.js: generateSmartQuote(anfrageId)
  → Gemini API: analyzes request → extracts scope, materials, complexity
  → _matchPositions(): selects from 40+ trade templates
  → _getPriceIntelligence(): historical price data from Supabase RPC
  → _generateQuoteText(): professional German text via Gemini
  → Returns complete angebot object ready for review
```

### Sending an Angebot
```
User marks as 'offen' (sent)
  → js/services/email-template-service.js: getAngebotEmail(angebot, company)
  → HTML email with positions table, totals, Kleinunternehmer notice
  → Send via email relay (VPS) or Supabase Edge Function
  → Optional: Create portal token for customer self-service approval
```

### Accepting an Angebot
```
Customer clicks "Annehmen" in portal / user manually accepts
  → portal_approve_quote(token, angebot_id) OR store.acceptAngebot(id)
  → angebot.status = 'angenommen'
  → Auto-creates Auftrag with same data
  → Auftrag appears in "In Bearbeitung" tab
```

## Customer Portal Flow

1. **Token generation**: When Angebot is sent, a `portal_token` is created
2. **Customer access**: Link in email → `buchung.freyaivisions.de/portal?token=xxx`
3. **Actions available**: View Angebot details, Approve (angenommen), Reject with reason (abgelehnt)
4. **DSGVO**: Portal logs response with anonymized IP, no tracking cookies
5. **Token scope**: `quote` scope only allows quote actions, not invoice actions

## Integration Points

| System | Integration |
|--------|------------|
| **n8n** | Workflow triggers on status change (angebot-created, accepted, rejected) |
| **Email** | Auto-send on status → offen, reminder on approaching gueltig_bis |
| **Calendar** | Optional: create Termin when Auftrag starts |
| **DATEV** | Not directly — only after Rechnung is created from Auftrag |
| **Telegram** | Bot notification on new Anfrage / accepted Angebot |
