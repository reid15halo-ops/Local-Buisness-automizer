/* ============================================================
   FreyAI Core — JSDoc Type Definitions
   ============================================================
   Auto-generated from supabase_schema.sql.
   These typedefs mirror the Supabase tables using camelCase
   property names (matching the store-service.js mapping pattern).

   Tables:
     Profile  — User profile & business settings (1:1 with auth.users)
     Client   — Customer / company records
     Product  — Product & service catalog
     Invoice  — Invoice headers with line-items as JSONB
   ============================================================ */

// ────────────────────────────────────────────────────────────
// 1. PROFILE
// ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Profile
 * @property {string} id               - UUID (references auth.users)
 * @property {string} businessName     - Company / business name
 * @property {string} fullName         - Owner / contact full name
 * @property {string} phone            - Phone number
 * @property {string} address          - Street address
 * @property {string} taxId            - Tax identification number
 * @property {string} vatId            - VAT identification number
 * @property {Object} settingsJson     - Arbitrary settings (theme, etc.)
 * @property {string} createdAt        - ISO 8601 timestamp
 * @property {string} updatedAt        - ISO 8601 timestamp
 */

// ────────────────────────────────────────────────────────────
// 2. CLIENT
// ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Client
 * @property {string} id               - UUID primary key
 * @property {string} userId           - UUID (owner, references auth.users)
 * @property {string} companyName      - Client company name
 * @property {string} contactPerson    - Primary contact person
 * @property {string} address          - Street address
 * @property {string} email            - Email address
 * @property {string} phone            - Phone number
 * @property {string} vatId            - VAT identification number
 * @property {string} notes            - Free-text notes
 * @property {string} createdAt        - ISO 8601 timestamp
 * @property {string} updatedAt        - ISO 8601 timestamp
 */

// ────────────────────────────────────────────────────────────
// 3. PRODUCT
// ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Product
 * @property {string}  id              - UUID primary key
 * @property {string}  userId          - UUID (owner, references auth.users)
 * @property {string}  name            - Product / service name
 * @property {string}  description     - Longer description
 * @property {number}  priceNet        - Net price (NUMERIC 12,2)
 * @property {number}  taxRate         - Tax rate percentage (NUMERIC 5,2)
 * @property {string}  unit            - Unit of measure (e.g. "Stk.")
 * @property {boolean} active          - Whether the product is active
 * @property {string}  createdAt       - ISO 8601 timestamp
 * @property {string}  updatedAt       - ISO 8601 timestamp
 */

// ────────────────────────────────────────────────────────────
// 4. INVOICE
// ────────────────────────────────────────────────────────────

/**
 * A single line-item inside an Invoice's itemsJson array.
 *
 * @typedef {Object} InvoiceItem
 * @property {string} description      - Line-item description
 * @property {number} quantity         - Quantity
 * @property {string} unit             - Unit of measure
 * @property {number} priceNet         - Net unit price
 * @property {number} taxRate          - Tax rate percentage
 * @property {number} total            - Computed line total
 */

/**
 * @typedef {Object} Invoice
 * @property {string}        id             - UUID primary key
 * @property {string}        userId         - UUID (owner, references auth.users)
 * @property {string|null}   clientId       - UUID (references clients, nullable)
 * @property {string}        invoiceNumber  - Human-readable invoice number
 * @property {string}        date           - Invoice date (YYYY-MM-DD)
 * @property {string}        dueDate        - Payment due date (YYYY-MM-DD)
 * @property {'draft'|'sent'|'paid'|'overdue'|'cancelled'} status - Invoice status
 * @property {InvoiceItem[]} itemsJson      - Array of line-item objects
 * @property {number}        totalNet       - Sum net amount (NUMERIC 12,2)
 * @property {number}        totalGross     - Sum gross amount (NUMERIC 12,2)
 * @property {string}        notes          - Free-text notes
 * @property {string}        createdAt      - ISO 8601 timestamp
 * @property {string}        updatedAt      - ISO 8601 timestamp
 */
