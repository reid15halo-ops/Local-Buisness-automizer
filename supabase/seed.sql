-- ============================================================
-- FreyAI Visions 95/5 Architecture — Zone 1
-- seed.sql: Development seed data
-- ============================================================
-- IMPORTANT: This seed file uses a fixed test user UUID.
-- In a real dev environment, first create the user via Supabase
-- Auth (Dashboard → Authentication → Users → Add User) and then
-- replace the UUID below with the actual user UUID.
--
-- Fixed dev user UUID (create this user in Auth first):
--   dev-user@freyai.dev / password: TestPassword123!
--
-- Seed inserts are wrapped in a DO block so they can reference
-- a variable for the user UUID throughout the file.
-- ============================================================

DO $$
DECLARE
    -- --------------------------------------------------------
    -- CONFIGURATION: Replace with the real dev user UUID
    -- after creating the user in Supabase Auth Dashboard.
    -- --------------------------------------------------------
    v_user_id           UUID := '00000000-0000-0000-0000-000000000001';

    -- Generated IDs (fixed for reproducibility)
    v_customer_id       UUID := '10000000-0000-0000-0000-000000000001';
    v_quote_id          UUID := '20000000-0000-0000-0000-000000000001';
    v_order_id          UUID := '30000000-0000-0000-0000-000000000001';
    v_invoice_id        UUID := '40000000-0000-0000-0000-000000000001';
    v_material_id       UUID := '50000000-0000-0000-0000-000000000001';
    v_lead_id           UUID := '60000000-0000-0000-0000-000000000001';
    v_comm_id           UUID := '70000000-0000-0000-0000-000000000001';
    v_job_id            UUID := '80000000-0000-0000-0000-000000000001';

BEGIN

    -- ========================================================
    -- COMPANY SETTINGS
    -- ========================================================
    INSERT INTO company_settings (
        id, user_id,
        company_name, company_address,
        tax_id, iban, bic, bank_name,
        invoice_prefix, quote_prefix,
        default_tax_rate
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        'FreyAI Visions GmbH',
        'Musterstraße 42, 80331 München',
        'DE123456789',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'Commerzbank AG',
        'RE-',
        'AN-',
        0.19
    )
    ON CONFLICT (user_id) DO UPDATE
        SET company_name    = EXCLUDED.company_name,
            updated_at      = NOW();

    -- ========================================================
    -- CUSTOMER: Mustermann GmbH
    -- ========================================================
    INSERT INTO customers (
        id, user_id,
        company_name, contact_name,
        email, phone,
        address, city, zip, country,
        tax_id, notes
    ) VALUES (
        v_customer_id,
        v_user_id,
        'Mustermann GmbH',
        'Max Mustermann',
        'max@mustermann-gmbh.de',
        '+49 89 12345678',
        'Industriestraße 7',
        'München',
        '80339',
        'DE',
        'DE987654321',
        'Stammkunde seit 2022. Zahlt zuverlässig innerhalb 14 Tagen.'
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- LEAD: Potential new client
    -- ========================================================
    INSERT INTO leads (
        id, user_id,
        name, email, phone,
        source, status, notes
    ) VALUES (
        v_lead_id,
        v_user_id,
        'Anna Schmidt',
        'anna.schmidt@techfirma.de',
        '+49 30 9876543',
        'website',
        'qualified',
        'Interessiert an Metallbau-Dienstleistungen. Anfrage über Kontaktformular am 20.02.2026.'
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- QUOTE: Angebot AN-2026-001
    -- ========================================================
    INSERT INTO quotes (
        id, user_id, customer_id,
        quote_number, title, description,
        items,
        subtotal, tax_rate, tax_amount, total,
        status, valid_until
    ) VALUES (
        v_quote_id,
        v_user_id,
        v_customer_id,
        'AN-2026-001',
        'Stahlkonstruktion Lagerhalle',
        'Planung und Fertigung einer Stahlkonstruktion für Lagerhalle Standort München-Nord.',
        '[
            {
                "pos": 1,
                "description": "Stahlrahmen HEB 200, 12m Spannweite",
                "quantity": 8,
                "unit": "Stk",
                "unit_price": 1250.00,
                "total": 10000.00
            },
            {
                "pos": 2,
                "description": "Montage und Verschweißen vor Ort",
                "quantity": 40,
                "unit": "Std",
                "unit_price": 95.00,
                "total": 3800.00
            },
            {
                "pos": 3,
                "description": "Korrosionsschutz (2-lagig)",
                "quantity": 1,
                "unit": "Pausch",
                "unit_price": 1200.00,
                "total": 1200.00
            }
        ]'::JSONB,
        15000.00,
        0.19,
        2850.00,
        17850.00,
        'sent',
        CURRENT_DATE + INTERVAL '30 days'
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- ORDER: Auftrag AUF-2026-001 (converted from quote)
    -- ========================================================
    INSERT INTO orders (
        id, user_id, customer_id, quote_id,
        order_number, title, description,
        items,
        subtotal, tax_amount, total,
        status, scheduled_date
    ) VALUES (
        v_order_id,
        v_user_id,
        v_customer_id,
        v_quote_id,
        'AUF-2026-001',
        'Wartung Hydraulikanlage Q1/2026',
        'Vierteljährliche Wartung der Hydraulikpresse und Prüfung aller Druckleitungen.',
        '[
            {
                "pos": 1,
                "description": "Hydrauliköl-Wechsel HLP 46",
                "quantity": 50,
                "unit": "Liter",
                "unit_price": 4.80,
                "total": 240.00
            },
            {
                "pos": 2,
                "description": "Dichtungssatz tauschen",
                "quantity": 1,
                "unit": "Satz",
                "unit_price": 180.00,
                "total": 180.00
            },
            {
                "pos": 3,
                "description": "Arbeitsstunden Techniker",
                "quantity": 6,
                "unit": "Std",
                "unit_price": 95.00,
                "total": 570.00
            }
        ]'::JSONB,
        990.00,
        188.10,
        1178.10,
        'in_progress',
        CURRENT_DATE + INTERVAL '3 days'
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- INVOICE: Rechnung RE-2026-001
    -- Status: 'pending_approval' — triggers the 5% approval flow
    -- math_confidence: 0.97 (AI validated the arithmetic)
    -- ========================================================
    INSERT INTO invoices (
        id, user_id, customer_id, order_id,
        invoice_number, title,
        items,
        subtotal, tax_rate, tax_amount, total,
        status, due_date,
        math_confidence,
        ocr_raw
    ) VALUES (
        v_invoice_id,
        v_user_id,
        v_customer_id,
        v_order_id,
        'RE-2026-001',
        'Wartung Hydraulikanlage Q1/2026 — Rechnung',
        '[
            {
                "pos": 1,
                "description": "Hydrauliköl-Wechsel HLP 46",
                "quantity": 50,
                "unit": "Liter",
                "unit_price": 4.80,
                "total": 240.00
            },
            {
                "pos": 2,
                "description": "Dichtungssatz tauschen",
                "quantity": 1,
                "unit": "Satz",
                "unit_price": 180.00,
                "total": 180.00
            },
            {
                "pos": 3,
                "description": "Arbeitsstunden Techniker",
                "quantity": 6,
                "unit": "Std",
                "unit_price": 95.00,
                "total": 570.00
            }
        ]'::JSONB,
        990.00,
        0.19,
        188.10,
        1178.10,
        'pending_approval',
        CURRENT_DATE + INTERVAL '14 days',
        0.970,
        '{
            "source": "ocr_gemini",
            "raw_text": "Rechnung RE-2026-001 ... Netto 990,00 EUR MwSt 19% 188,10 EUR Brutto 1.178,10 EUR",
            "extracted_at": "2026-02-24T08:00:00Z",
            "confidence": 0.97,
            "fields": {
                "invoice_number": {"value": "RE-2026-001", "confidence": 0.99},
                "subtotal": {"value": 990.00, "confidence": 0.98},
                "tax_rate": {"value": 0.19, "confidence": 1.0},
                "tax_amount": {"value": 188.10, "confidence": 0.97},
                "total": {"value": 1178.10, "confidence": 0.97}
            }
        }'::JSONB
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- MATERIAL: Hydrauliköl HLP 46
    -- ========================================================
    INSERT INTO materials (
        id, user_id,
        name, sku, description,
        unit, unit_price,
        stock_quantity, reorder_threshold,
        supplier
    ) VALUES (
        v_material_id,
        v_user_id,
        'Hydrauliköl HLP 46',
        'HYD-HLP46-20L',
        'Mineralisches Hydrauliköl ISO VG 46, 20-Liter-Kanister',
        'Liter',
        4.80,
        120.0,
        50.0,
        'Fuchs Petrolub SE'
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- COMMUNICATION: Sample inbound email
    -- ========================================================
    INSERT INTO communications (
        id, user_id, customer_id,
        channel, direction,
        subject, body,
        ai_draft,
        status, intent
    ) VALUES (
        v_comm_id,
        v_user_id,
        v_customer_id,
        'email',
        'inbound',
        'Anfrage: Reparatur Schweißgerät',
        'Guten Tag, wir haben ein defektes Schweißgerät (Fronius TransSynergic 3200) '
        'und benötigen dringend einen Servicetermin. Können Sie nächste Woche? '
        'MfG, Max Mustermann',
        'Sehr geehrter Herr Mustermann, vielen Dank für Ihre Anfrage. '
        'Wir können gerne einen Servicetermin für Ihr Fronius TransSynergic 3200 vereinbaren. '
        'Nächste Woche hätten wir Dienstag, den 03.03.2026 ab 09:00 Uhr frei. '
        'Bitte bestätigen Sie diesen Termin oder nennen Sie einen alternativen Zeitraum. '
        'Mit freundlichen Grüßen, FreyAI Visions GmbH',
        'draft',
        'service_request'
    )
    ON CONFLICT DO NOTHING;

    -- ========================================================
    -- JOB QUEUE: Sample pending job (invoice OCR validation)
    -- ========================================================
    INSERT INTO jobs_queue (
        id, user_id,
        job_type,
        payload,
        status, priority,
        attempts, max_attempts
    ) VALUES (
        v_job_id,
        v_user_id,
        'invoice_ocr',
        jsonb_build_object(
            'invoice_id',   v_invoice_id,
            'customer_id',  v_customer_id,
            'source',       'manual_upload',
            'file_url',     'https://storage.supabase.co/object/public/invoices/RE-2026-001.pdf',
            'validate_math', true,
            'extract_pii',  true
        ),
        'pending',
        3,
        0,
        3
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Seed data inserted successfully for dev user %', v_user_id;
    RAISE NOTICE 'Customer: % (ID: %)', 'Mustermann GmbH', v_customer_id;
    RAISE NOTICE 'Quote: AN-2026-001 (ID: %)', v_quote_id;
    RAISE NOTICE 'Order: AUF-2026-001 (ID: %)', v_order_id;
    RAISE NOTICE 'Invoice: RE-2026-001 status=pending_approval (ID: %)', v_invoice_id;
    RAISE NOTICE 'Job queued: invoice_ocr (ID: %)', v_job_id;

END;
$$;
