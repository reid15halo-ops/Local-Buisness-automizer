-- ============================================================
-- FreyAI Visions — Founder Brand Campaign Seed
-- Migration: Seed 20 social media posts for founder marketing
-- Created: 2026-03-10
-- ============================================================

-- ============================================================
-- 1. Create the FreyAI Visions founder campaign
-- ============================================================
INSERT INTO marketing_campaigns (
    id, user_id, package, status,
    company_name, trade, city, region,
    usps, posts_per_week, platforms,
    hashtags, posting_times,
    starts_at, ends_at,
    price_cents, paid, notes
) VALUES (
    'a0000001-0000-0000-0000-000000000001',
    '405dea2b-f865-4771-8837-830f43416e77',  -- reid15_halo@proton.me
    'L',
    'scheduled',
    'FreyAI Visions',
    'IT / Digitalisierung',
    'Stuttgart',
    'Baden-Württemberg',
    ARRAY[
        'Premium custom-fit digital backbone for craftsmen',
        'Offline-first PWA',
        'DSGVO-compliant, Made in Germany',
        'AI-powered (Gemini)',
        'Industrial Luxury design'
    ],
    4,
    ARRAY['linkedin', 'instagram', 'facebook']::post_platform[],
    ARRAY['#FreyAIVisions', '#Handwerk', '#Digitalisierung', '#KI', '#Handwerker'],
    '["08:00", "11:00", "17:00"]'::jsonb,
    '2026-03-16',   -- KW12 Monday
    '2026-04-20',   -- KW16 Sunday (5 weeks)
    0,              -- Internal campaign, no charge
    TRUE,
    'Founder brand building campaign — 20 posts over 5 weeks, 4x/week. Images: Gemini Imagen with founder reference photos.'
)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = NOW();

-- ============================================================
-- 2. Seed 20 posts into the pipeline
-- ============================================================

-- Helper: campaign ID
DO $$
DECLARE
    v_campaign_id UUID := 'a0000001-0000-0000-0000-000000000001';
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id FROM marketing_campaigns WHERE id = v_campaign_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Campaign % not found — run tables migration first', v_campaign_id;
    END IF;

    -- Idempotency: skip if posts already exist for this campaign
    IF EXISTS (SELECT 1 FROM marketing_posts WHERE campaign_id = v_campaign_id LIMIT 1) THEN
        RAISE NOTICE 'Posts already exist for campaign %, skipping seed', v_campaign_id;
        RETURN;
    END IF;

    -- ======== WEEK 1 (KW12) ========

    -- Post 1: "Der Anfang" (Morning Ritual) — Mo 16.03.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Mein Tag beginnt um 5:30. Kaffee. Dashboard. Zahlen.\n\nNicht weil ich muss — weil ich weiß, dass meine Kunden um 7:00 auf der Baustelle stehen. Und bis dahin muss ihr System laufen.\n\nFreyAI Visions baut keine Software, die „irgendwann fertig" ist. Wir bauen Systeme, die laufen, bevor der erste Nagel gesetzt wird.\n\nHandwerk verdient Präzision. Auch digital.',
     ARRAY['#FreyAIVisions', '#Handwerk', '#Digitalisierung', '#Morgenroutine', '#Unternehmer'],
     'img/Gemini_Generated_Image_bt033hbt033hbt03.png',
     '2026-03-16 08:00:00+01', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Mein Tag beginnt um 5:30. Kaffee. Dashboard. Zahlen.\n\nNicht weil ich muss — weil ich weiß, dass meine Kunden um 7:00 auf der Baustelle stehen. Und bis dahin muss ihr System laufen.\n\nFreyAI Visions baut keine Software, die „irgendwann fertig" ist. Wir bauen Systeme, die laufen, bevor der erste Nagel gesetzt wird.\n\nHandwerk verdient Präzision. Auch digital.',
     ARRAY['#FreyAIVisions', '#Handwerk', '#Digitalisierung', '#Morgenroutine', '#Unternehmer', '#GründerMindset', '#Handwerker', '#OfflineFirst', '#Meister', '#StartupDE', '#B2B', '#Effizienz', '#Automatisierung', '#KI', '#BuiltDifferent'],
     'img/Gemini_Generated_Image_bt033hbt033hbt03.png',
     '2026-03-16 08:00:00+01', 'approved');

    -- Post 2: "Zwei Welten" (Dual World) — Mi 18.03.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Links: Realität in 80% der Handwerksbüros.\nRechts: Was möglich ist.\n\nKein Hexenwerk. Kein teures ERP. Kein 12-monatiges IT-Projekt.\n\nEin System. Einmal aufgesetzt. Läuft.\nOffline. DSGVO-konform. Made in Germany.\n\nWelche Seite wählst du?',
     ARRAY['#FreyAIVisions', '#VorherNachher', '#Handwerk', '#Digitalisierung', '#Transformation'],
     'img/Gemini_Generated_Image_la436ola436ola43.png',
     '2026-03-18 08:00:00+01', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Links: Realität in 80% der Handwerksbüros.\nRechts: Was möglich ist.\n\nKein Hexenwerk. Kein teures ERP. Kein 12-monatiges IT-Projekt.\n\nEin System. Einmal aufgesetzt. Läuft.\nOffline. DSGVO-konform. Made in Germany.\n\nWelche Seite wählst du?',
     ARRAY['#FreyAIVisions', '#VorherNachher', '#Handwerk', '#Digitalisierung', '#KeinPapierkram', '#Transformation', '#Handwerker', '#Büro', '#Digital', '#Effizienz', '#Meister', '#Mittelstand', '#B2B', '#Innovation', '#Gründer'],
     'img/Gemini_Generated_Image_la436ola436ola43.png',
     '2026-03-18 08:00:00+01', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Links: Realität in 80% der Handwerksbüros.\nRechts: Was möglich ist.\n\nKein Hexenwerk. Kein teures ERP. Kein 12-monatiges IT-Projekt.\n\nEin System. Einmal aufgesetzt. Läuft.\nOffline. DSGVO-konform. Made in Germany.\n\nWelche Seite wählst du?',
     ARRAY['#FreyAIVisions', '#Handwerk', '#Digitalisierung', '#VorherNachher', '#Transformation'],
     'img/Gemini_Generated_Image_la436ola436ola43.png',
     '2026-03-18 08:00:00+01', 'approved');

    -- Post 3: "Code & Craft" — Fr 20.03.2026 17:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Code trifft Handwerk.\n\nDieses Tablet zeigt nicht Instagram. Es zeigt:\n→ 14 offene Angebote\n→ 3 überfällige Rechnungen\n→ Lagerbestand unter Mindestmenge\n\nAlles auf einen Blick. Auch auf der Baustelle. Auch ohne Internet.\n\nDas ist FreyAI.',
     ARRAY['#FreyAIVisions', '#CodeAndCraft', '#Handwerker', '#OfflineFirst', '#Dashboard', '#Digitalisierung', '#Handwerk', '#Meister', '#Tablet', '#App', '#KI', '#Automatisierung', '#B2B', '#Effizienz', '#BuiltDifferent'],
     'img/Gemini_Generated_Image_oi4wlxoi4wlxoi4w.png',
     '2026-03-20 17:00:00+01', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Code trifft Handwerk.\n\nDieses Tablet zeigt nicht Instagram. Es zeigt:\n→ 14 offene Angebote\n→ 3 überfällige Rechnungen\n→ Lagerbestand unter Mindestmenge\n\nAlles auf einen Blick. Auch auf der Baustelle. Auch ohne Internet.\n\nDas ist FreyAI.',
     ARRAY['#FreyAIVisions', '#CodeAndCraft', '#Handwerk', '#OfflineFirst', '#Dashboard'],
     'img/Gemini_Generated_Image_oi4wlxoi4wlxoi4w.png',
     '2026-03-20 17:00:00+01', 'approved');

    -- Post 4: "Die Zukunft" (Keynote) — So 22.03.2026 11:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'"Die Zukunft des Handwerks ist digital."\n\nKein Buzzword. Eine Notwendigkeit.\n\n67% der Handwerksbetriebe haben keinen digitalen Prozess für Angebote.\n43% verwalten Kundendaten in Excel — oder im Kopf.\nUnd 9 von 10 verlieren Aufträge, weil sie zu langsam antworten.\n\nDas ist kein Zukunftsproblem. Das ist jetzt.\n\nFreyAI Visions existiert, um genau das zu lösen. Für Betriebe, die es ernst meinen.',
     ARRAY['#FreyAIVisions', '#ZukunftHandwerk', '#Digitalisierung', '#Keynote', '#Innovation'],
     'img/Gemini_Generated_Image_mcpgejmcpgejmcpg.png',
     '2026-03-22 11:00:00+01', 'approved');

    -- ======== WEEK 2 (KW13) ========

    -- Post 5: "After Hours" — Mo 23.03.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'23:47. Die Stadt schläft. Ich nicht.\n\nNicht weil ich Workaholic bin. Sondern weil gerade ein Elektriker in Nürnberg morgen früh um 6 sein erstes automatisches Angebot verschicken wird — und ich will, dass es perfekt funktioniert.\n\nFreiheit heißt nicht weniger arbeiten. Freiheit heißt an den richtigen Dingen arbeiten.',
     ARRAY['#FreyAIVisions', '#AfterHours', '#Gründerleben', '#Unternehmer', '#Handwerk'],
     'img/Gemini_Generated_Image_qaef1fqaef1fqaef.png',
     '2026-03-23 08:00:00+01', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'23:47. Die Stadt schläft. Ich nicht.\n\nNicht weil ich Workaholic bin. Sondern weil gerade ein Elektriker in Nürnberg morgen früh um 6 sein erstes automatisches Angebot verschicken wird — und ich will, dass es perfekt funktioniert.\n\nFreiheit heißt nicht weniger arbeiten. Freiheit heißt an den richtigen Dingen arbeiten.',
     ARRAY['#FreyAIVisions', '#AfterHours', '#Gründerleben', '#Unternehmer', '#Handwerk', '#Nachtschicht', '#FounderLife', '#Automatisierung', '#Handwerker', '#StartupDE', '#B2B', '#Effizienz', '#KI', '#BuiltDifferent', '#Gründer'],
     'img/Gemini_Generated_Image_qaef1fqaef1fqaef.png',
     '2026-03-23 08:00:00+01', 'approved');

    -- Post 6: "Blueprint Revolution" — Mi 25.03.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Die Blaupause bleibt. Die Methode ändert sich.\n\nHandwerk war schon immer Innovation. Von der Wasserwaage zum Laser-Nivellier. Vom Zollstock zum 3D-Scanner.\n\nDer nächste Schritt? Vom Papierordner zum intelligenten System.\n\nFreyAI nimmt, was funktioniert — und gibt dir die Werkzeuge für das, was kommt.',
     ARRAY['#FreyAIVisions', '#BlueprintRevolution', '#Handwerk', '#Innovation', '#Digital', '#Zukunft', '#Handwerker', '#Meister', '#Automatisierung', '#Digitalisierung', '#Tradition', '#Technik', '#B2B', '#BuiltDifferent', '#Effizienz'],
     'img/Gemini_Generated_Image_nzon2cnzon2cnzon.png',
     '2026-03-25 08:00:00+01', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Die Blaupause bleibt. Die Methode ändert sich.\n\nHandwerk war schon immer Innovation. Von der Wasserwaage zum Laser-Nivellier. Vom Zollstock zum 3D-Scanner.\n\nDer nächste Schritt? Vom Papierordner zum intelligenten System.\n\nFreyAI nimmt, was funktioniert — und gibt dir die Werkzeuge für das, was kommt.',
     ARRAY['#FreyAIVisions', '#BlueprintRevolution', '#Handwerk', '#Innovation', '#Zukunft'],
     'img/Gemini_Generated_Image_nzon2cnzon2cnzon.png',
     '2026-03-25 08:00:00+01', 'approved');

    -- Post 7: "First Principles" — Fr 27.03.2026 17:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Jedes System beginnt mit einem Flowchart.\n\nCRM Entry → Angebot → Auftrag → Rechnung → Zahlung → DATEV.\n\n6 Schritte. 3 davon manuell in den meisten Betrieben. 0 davon manuell mit FreyAI.\n\nWir denken nicht in Features. Wir denken in Prozessen. Und dann automatisieren wir sie.\n\nFirst Principles. Keine Kompromisse.',
     ARRAY['#FreyAIVisions', '#FirstPrinciples', '#Prozessoptimierung', '#Handwerk', '#Automatisierung'],
     'img/Gemini_Generated_Image_x7y2a4x7y2a4x7y2.png',
     '2026-03-27 17:00:00+01', 'approved');

    -- Post 8: "Break the Mold" — So 29.03.2026 11:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Schluss mit Zettelwirtschaft.\n\n→ 47 Ordner im Regal? Weg.\n→ 3 Excel-Listen für Kundendaten? Weg.\n→ Rechnungen per Hand schreiben? Weg.\n\nNicht irgendwann. Jetzt.\n\nEin Klick: Angebot → Auftrag → Rechnung → DATEV-Export.\n\nDein Büro verdient den gleichen Anspruch wie deine Arbeit auf der Baustelle.',
     ARRAY['#FreyAIVisions', '#BreakTheMold', '#KeinPapierkram', '#Handwerk', '#Digitalisierung', '#Effizienz', '#Handwerker', '#Meister', '#Automatisierung', '#B2B', '#DATEV', '#Buchhaltung', '#Rechnungen', '#BuiltDifferent', '#Digital'],
     'img/Gemini_Generated_Image_5gg5he5gg5he5gg5.png',
     '2026-03-29 11:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Schluss mit Zettelwirtschaft.\n\n→ 47 Ordner im Regal? Weg.\n→ 3 Excel-Listen für Kundendaten? Weg.\n→ Rechnungen per Hand schreiben? Weg.\n\nNicht irgendwann. Jetzt.\n\nEin Klick: Angebot → Auftrag → Rechnung → DATEV-Export.\n\nDein Büro verdient den gleichen Anspruch wie deine Arbeit auf der Baustelle.',
     ARRAY['#FreyAIVisions', '#BreakTheMold', '#KeinPapierkram', '#Handwerk', '#Digitalisierung'],
     'img/Gemini_Generated_Image_5gg5he5gg5he5gg5.png',
     '2026-03-29 11:00:00+02', 'approved');

    -- ======== WEEK 3 (KW14) ========

    -- Post 9: "The Dashboard" — Mo 30.03.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Dein Betrieb. Ein Blick.\n\nUmsatz. Offene Posten. Auslastung. Lagerbestand. Terminkalender.\n\nKein Tab-Hopping. Kein "Wo war nochmal die Datei?"\n\nEin Dashboard. Alles drin. Echtzeit.\n\nSo sieht Kontrolle aus — wenn dein System für dich arbeitet.',
     ARRAY['#FreyAIVisions', '#Dashboard', '#Handwerk', '#Echtzeit', '#BusinessIntelligence'],
     'img/Gemini_Generated_Image_1lef191lef191lef.png',
     '2026-03-30 08:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Dein Betrieb. Ein Blick.\n\nUmsatz. Offene Posten. Auslastung. Lagerbestand. Terminkalender.\n\nKein Tab-Hopping. Kein "Wo war nochmal die Datei?"\n\nEin Dashboard. Alles drin. Echtzeit.\n\nSo sieht Kontrolle aus — wenn dein System für dich arbeitet.',
     ARRAY['#FreyAIVisions', '#Dashboard', '#Handwerk', '#Echtzeit', '#BusinessIntelligence', '#Kontrolle', '#Handwerker', '#Digitalisierung', '#App', '#KI', '#B2B', '#Effizienz', '#BuiltDifferent', '#Meister', '#Automatisierung'],
     'img/Gemini_Generated_Image_1lef191lef191lef.png',
     '2026-03-30 08:00:00+02', 'approved');

    -- Post 10: "The Mentor" — Mi 01.04.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Wissen weitergeben. Aber smarter.\n\nDer Meister zeigt. Der Azubi lernt. Das Tablet dokumentiert.\n\nAufmaße, Materiallisten, Arbeitsschritte — alles digital. Nicht auf einem Zettel, der morgen verloren ist.\n\nFreyAI macht Handwerkswissen persistent. Damit es bleibt, auch wenn der Meister in Rente geht.',
     ARRAY['#FreyAIVisions', '#Meister', '#Azubi', '#Wissenstransfer', '#Handwerk', '#DigitalesLernen', '#Handwerker', '#Tradition', '#Innovation', '#Tablet', '#Digitalisierung', '#Ausbildung', '#B2B', '#Zukunft', '#BuiltDifferent'],
     'img/Gemini_Generated_Image_ieafjcieafjcieaf.png',
     '2026-04-01 08:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Wissen weitergeben. Aber smarter.\n\nDer Meister zeigt. Der Azubi lernt. Das Tablet dokumentiert.\n\nAufmaße, Materiallisten, Arbeitsschritte — alles digital. Nicht auf einem Zettel, der morgen verloren ist.\n\nFreyAI macht Handwerkswissen persistent. Damit es bleibt, auch wenn der Meister in Rente geht.',
     ARRAY['#FreyAIVisions', '#Meister', '#Azubi', '#Wissenstransfer', '#Handwerk'],
     'img/Gemini_Generated_Image_ieafjcieafjcieaf.png',
     '2026-04-01 08:00:00+02', 'approved');

    -- Post 11: "The War Room" — Fr 03.04.2026 17:00
    -- NOTE: Image needs to be generated with Gemini Imagen first
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Strategie ist kein Meeting. Strategie ist Klarheit.\n\nWenn ich einen neuen Handwerksbetrieb digitalisiere, sitze ich hier. Allein. Und denke den gesamten Prozess durch — von der Kundenanfrage bis zur letzten Mahnung.\n\nErst wenn jeder Schritt sitzt, wird eine einzige Zeile Code geschrieben.\n\nDas ist der Unterschied zwischen einer App und einem System.',
     ARRAY['#FreyAIVisions', '#Strategie', '#SystemDesign', '#Handwerk', '#Digitalisierung'],
     NULL, -- Image TBD: generate with "The War Room" prompt
     '2026-04-03 17:00:00+02', 'draft');

    -- Post 12: "AI Copilot" — So 05.04.2026 11:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Dein KI-Copilot. Immer dabei. Nie im Weg.\n\n→ "Erstelle ein Angebot für Müller, Badsanierung, 12m²" — fertig in 4 Sekunden.\n→ "Wann hat Schmidt seinen nächsten Termin?" — Kalender checkt sich selbst.\n→ "Welches Material brauche ich für den Auftrag?" — Lager prüft, bestellt nach.\n\nKein Tippen. Kein Suchen. Kein Warten.\n\nHandwerk + KI = FreyAI.',
     ARRAY['#FreyAIVisions', '#KI', '#AICopilot', '#Handwerk', '#Automatisierung'],
     'img/Gemini_Generated_Image_7n1dan7n1dan7n1d (1).png',
     '2026-04-05 11:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Dein KI-Copilot. Immer dabei. Nie im Weg.\n\n→ "Erstelle ein Angebot für Müller, Badsanierung, 12m²" — fertig in 4 Sekunden.\n→ "Wann hat Schmidt seinen nächsten Termin?" — Kalender checkt sich selbst.\n→ "Welches Material brauche ich für den Auftrag?" — Lager prüft, bestellt nach.\n\nKein Tippen. Kein Suchen. Kein Warten.\n\nHandwerk + KI = FreyAI.',
     ARRAY['#FreyAIVisions', '#KI', '#AICopilot', '#Handwerk', '#Automatisierung', '#GeminiAI', '#Handwerker', '#Digitalisierung', '#OfflineFirst', '#B2B', '#Innovation', '#Effizienz', '#BuiltDifferent', '#Meister', '#Zukunft'],
     'img/Gemini_Generated_Image_7n1dan7n1dan7n1d (1).png',
     '2026-04-05 11:00:00+02', 'approved');

    -- ======== WEEK 4 (KW15) ========

    -- Post 13: "Night Grind" — Mo 06.04.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Leise Nächte. Laute Ergebnisse.\n\nWährend die Welt scrollt, baue ich Systeme, die morgen früh Rechnungen verschicken, Termine bestätigen und Lagerbestände prüfen — ohne dass ein Mensch einen Finger rührt.\n\nAutomatisierung ist kein Luxus. Es ist der Standard, den dein Betrieb verdient.',
     ARRAY['#FreyAIVisions', '#NightGrind', '#Automatisierung', '#Handwerk', '#Gründer', '#BuildInSilence', '#Handwerker', '#Digitalisierung', '#FounderLife', '#StartupDE', '#B2B', '#KI', '#BuiltDifferent', '#Effizienz', '#Nachtschicht'],
     'img/Gemini_Generated_Image_51m38351m38351m3.png',
     '2026-04-06 08:00:00+02', 'approved');

    -- Post 14: "Meister & Technik" — Mi 08.04.2026 08:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'"Das haben wir schon immer so gemacht."\n\nDer gefährlichste Satz im Handwerk. Nicht weil Tradition schlecht ist — sondern weil sie allein nicht reicht.\n\nDer Meister, der seinem Azubi heute ein 3D-Modell auf dem Tablet zeigt, baut den Betrieb von morgen.\n\nFreyAI gibt dir die Werkzeuge. Den Meister-Spirit hast du schon.',
     ARRAY['#FreyAIVisions', '#Tradition', '#Innovation', '#Meister', '#Handwerk'],
     'img/Gemini_Generated_Image_kgurhwkgurhwkgur.png',
     '2026-04-08 08:00:00+02', 'approved');

    -- Post 15: "One Tap Away" — Fr 10.04.2026 17:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Ein Tap. Ein Angebot. Ein Auftrag.\n\nSo einfach sollte es sein. Und mit FreyAI ist es das.\n\nKein Laptop nötig. Kein Büro nötig. Kein "Ich mach das morgen."\n\nDein Betrieb in deiner Hosentasche. 24/7. Auch offline.',
     ARRAY['#FreyAIVisions', '#OneTapAway', '#Mobile', '#OfflineFirst', '#Handwerk', '#PWA', '#Handwerker', '#Digitalisierung', '#App', '#Smartphone', '#B2B', '#Effizienz', '#BuiltDifferent', '#KI', '#Innovation'],
     'img/Gemini_Generated_Image_wwqlqfwwqlqfwwql.png',
     '2026-04-10 17:00:00+02', 'approved');

    -- Post 16: "The Disruptor" — So 12.04.2026 11:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Eine neue Ära beginnt.\n\nKeine Science-Fiction. Kein Hollywood.\n\nEinfach ein Handwerker, der seinen Papierkram verbrennt — und ein System bekommt, das für ihn arbeitet.\n\nBereit für den Wandel?\n\n→ DM oder Kommentar. Kein Verkaufsgespräch. Nur Klartext.',
     ARRAY['#FreyAIVisions', '#TheDisruptor', '#NeueÄra', '#Handwerk', '#Disruption', '#NoMorePaperwork', '#Handwerker', '#Digitalisierung', '#Transformation', '#B2B', '#Innovation', '#BuiltDifferent', '#Automatisierung', '#Gründer', '#Zukunft'],
     'img/Gemini_Generated_Image_ddrtetddrtetddrt.png',
     '2026-04-12 11:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Eine neue Ära beginnt.\n\nKeine Science-Fiction. Kein Hollywood.\n\nEinfach ein Handwerker, der seinen Papierkram verbrennt — und ein System bekommt, das für ihn arbeitet.\n\nBereit für den Wandel?\n\n→ Nachricht oder Kommentar. Kein Verkaufsgespräch. Nur Klartext.',
     ARRAY['#FreyAIVisions', '#TheDisruptor', '#Handwerk', '#Disruption', '#Transformation'],
     'img/Gemini_Generated_Image_ddrtetddrtetddrt.png',
     '2026-04-12 11:00:00+02', 'approved');

    -- ======== WEEK 5 (KW16) ========

    -- Post 17: "Chess, Not Checkers" — Mo 13.04.2026 08:00
    -- NOTE: Image needs to be generated with Gemini Imagen first
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Dein Wettbewerber postet auf Instagram.\nDu hast ein System, das automatisch Angebote nachfasst.\n\nDein Wettbewerber sucht Mitarbeiter.\nDu hast Prozesse, die 2 Vollzeitkräfte ersetzen.\n\nDein Wettbewerber spart am Marketing.\nDu investierst in Infrastruktur.\n\nSchach, nicht Dame.',
     ARRAY['#FreyAIVisions', '#Strategie', '#Wettbewerb', '#Handwerk', '#Vorsprung'],
     NULL, -- Image TBD: generate with "Chess, Not Checkers" prompt
     '2026-04-13 08:00:00+02', 'draft');

    -- Post 18: "The Prototype" — Mi 15.04.2026 08:00
    -- NOTE: Image needs to be generated with Gemini Imagen first
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Gebaut, nicht gekauft.\n\nFreyAI ist kein White-Label-Produkt. Kein umgelabeltes SaaS. Jede Zeile Code, jede Funktion, jeder Pixel — handgefertigt.\n\nWie ein Meisterstück im Handwerk: Kein Kompromiss. Kein Shortcut.\n\nWeil dein Betrieb kein Standardprodukt verdient.',
     ARRAY['#FreyAIVisions', '#Handmade', '#Prototype', '#Handwerk', '#CustomBuilt', '#Engineering', '#Handwerker', '#Digitalisierung', '#Code', '#BuiltDifferent', '#Meister', '#B2B', '#Innovation', '#Gründer', '#NoCompromise'],
     NULL, -- Image TBD: generate with "The Prototype" prompt
     '2026-04-15 08:00:00+02', 'draft');

    -- Post 19: "Digital Handshake" — Fr 17.04.2026 17:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Handschlag 2.0.\n\nIm Handwerk zählt der Handschlag. Vertrauen. Wort halten.\n\nBei FreyAI auch. Nur dass unser Handschlag ein System ist, das nie vergisst:\n→ Kein Angebot bleibt liegen\n→ Keine Rechnung wird vergessen\n→ Kein Termin fällt durch\n\nDigitales Vertrauen. Analog gebaut.',
     ARRAY['#FreyAIVisions', '#DigitalHandshake', '#Vertrauen', '#Handwerk', '#Zuverlässigkeit'],
     'img/Gemini_Generated_Image_p49mtrp49mtrp49m.png',
     '2026-04-17 17:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Handschlag 2.0.\n\nIm Handwerk zählt der Handschlag. Vertrauen. Wort halten.\n\nBei FreyAI auch. Nur dass unser Handschlag ein System ist, das nie vergisst:\n→ Kein Angebot bleibt liegen\n→ Keine Rechnung wird vergessen\n→ Kein Termin fällt durch\n\nDigitales Vertrauen. Analog gebaut.',
     ARRAY['#FreyAIVisions', '#DigitalHandshake', '#Vertrauen', '#Handwerk', '#Zuverlässigkeit', '#System', '#Handwerker', '#Digitalisierung', '#B2B', '#BuiltDifferent', '#Innovation', '#Automatisierung', '#Meister', '#Trust', '#Effizienz'],
     'img/Gemini_Generated_Image_p49mtrp49mtrp49m.png',
     '2026-04-17 17:00:00+02', 'approved');

    -- Post 20: "Built Different" (Finale) — So 19.04.2026 11:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Built different.\n\n→ Andere bauen Tools. Wir bauen Systeme.\n→ Andere verkaufen Abos. Wir liefern Infrastruktur.\n→ Andere versprechen "einfach". Wir liefern "funktioniert".\n\nFreyAI Visions. Das digitale Rückgrat für Deutschlands Handwerk.\n\n3-5 Pilotplätze offen. DM für Details.',
     ARRAY['#FreyAIVisions', '#BuiltDifferent', '#Handwerk', '#Premium', '#Infrastruktur'],
     'img/Gemini_Generated_Image_bek6z4bek6z4bek6.png',
     '2026-04-19 11:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'instagram', 'post',
     E'Built different.\n\n→ Andere bauen Tools. Wir bauen Systeme.\n→ Andere verkaufen Abos. Wir liefern Infrastruktur.\n→ Andere versprechen "einfach". Wir liefern "funktioniert".\n\nFreyAI Visions. Das digitale Rückgrat für Deutschlands Handwerk.\n\n3-5 Pilotplätze offen. DM für Details.',
     ARRAY['#FreyAIVisions', '#BuiltDifferent', '#Handwerk', '#Premium', '#Infrastruktur', '#DigitalesRückgrat', '#Handwerker', '#Digitalisierung', '#B2B', '#Innovation', '#KI', '#Automatisierung', '#Meister', '#Gründer', '#NoCompromise'],
     'img/Gemini_Generated_Image_bek6z4bek6z4bek6.png',
     '2026-04-19 11:00:00+02', 'approved'),
    (v_campaign_id, v_user_id, 'facebook', 'post',
     E'Built different.\n\n→ Andere bauen Tools. Wir bauen Systeme.\n→ Andere verkaufen Abos. Wir liefern Infrastruktur.\n→ Andere versprechen "einfach". Wir liefern "funktioniert".\n\nFreyAI Visions. Das digitale Rückgrat für Deutschlands Handwerk.\n\n3-5 Pilotplätze offen. Nachricht für Details.',
     ARRAY['#FreyAIVisions', '#BuiltDifferent', '#Handwerk', '#Premium', '#DigitalesRückgrat'],
     'img/Gemini_Generated_Image_bek6z4bek6z4bek6.png',
     '2026-04-19 11:00:00+02', 'approved');

    -- ============================================================
    -- ENGLISH LINKEDIN POSTS (+2h after German LinkedIn posts)
    -- For international audience reach
    -- ============================================================

    -- Post 1 EN: "The Beginning" — Mo 16.03.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'My day starts at 5:30 AM. Coffee. Dashboard. Numbers.\n\nNot because I have to — because I know my clients are on-site by 7. And their system needs to be running by then.\n\nFreyAI Visions doesn''t build software that''s "eventually ready." We build systems that run before the first nail is driven.\n\nCraftsmanship deserves precision. Digitally, too.',
     ARRAY['#FreyAIVisions', '#Craftsmanship', '#Digitalization', '#MorningRoutine', '#Entrepreneur'],
     'img/Gemini_Generated_Image_bt033hbt033hbt03.png',
     '2026-03-16 10:00:00+01', 'approved');

    -- Post 2 EN: "Two Worlds" — Mi 18.03.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Left: Reality in 80% of craft business offices.\nRight: What''s possible.\n\nNo magic. No expensive ERP. No 12-month IT project.\n\nOne system. Set up once. Runs.\nOffline. GDPR-compliant. Made in Germany.\n\nWhich side do you choose?',
     ARRAY['#FreyAIVisions', '#BeforeAfter', '#Craftsmanship', '#Digitalization', '#Transformation'],
     'img/Gemini_Generated_Image_la436ola436ola43.png',
     '2026-03-18 10:00:00+01', 'approved');

    -- Post 4 EN: "The Future" (Keynote) — So 22.03.2026 13:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'"The future of craftsmanship is digital."\n\nNot a buzzword. A necessity.\n\n67% of craft businesses have no digital quoting process.\n43% manage customer data in Excel — or in their heads.\nAnd 9 out of 10 lose jobs because they respond too slowly.\n\nThis isn''t a future problem. It''s now.\n\nFreyAI Visions exists to solve exactly this. For businesses that mean it.',
     ARRAY['#FreyAIVisions', '#FutureOfCraft', '#Digitalization', '#Keynote', '#Innovation'],
     'img/Gemini_Generated_Image_mcpgejmcpgejmcpg.png',
     '2026-03-22 13:00:00+01', 'approved');

    -- Post 5 EN: "After Hours" — Mo 23.03.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'11:47 PM. The city sleeps. I don''t.\n\nNot because I''m a workaholic. Because an electrician in Nuremberg will send his first automated quote at 6 AM tomorrow — and I want it to work flawlessly.\n\nFreedom isn''t working less. Freedom is working on the right things.',
     ARRAY['#FreyAIVisions', '#AfterHours', '#FounderLife', '#Entrepreneur', '#Craftsmanship'],
     'img/Gemini_Generated_Image_qaef1fqaef1fqaef.png',
     '2026-03-23 10:00:00+01', 'approved');

    -- Post 7 EN: "First Principles" — Fr 27.03.2026 19:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Every system starts with a flowchart.\n\nCRM Entry → Quote → Order → Invoice → Payment → DATEV.\n\n6 steps. 3 of them manual in most businesses. 0 of them manual with FreyAI.\n\nWe don''t think in features. We think in processes. Then we automate them.\n\nFirst principles. No compromises.',
     ARRAY['#FreyAIVisions', '#FirstPrinciples', '#ProcessOptimization', '#Craftsmanship', '#Automation'],
     'img/Gemini_Generated_Image_x7y2a4x7y2a4x7y2.png',
     '2026-03-27 19:00:00+01', 'approved');

    -- Post 9 EN: "The Dashboard" — Mo 30.03.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Your business. One glance.\n\nRevenue. Outstanding invoices. Capacity. Inventory. Calendar.\n\nNo tab-hopping. No "Where was that file again?"\n\nOne dashboard. Everything. Real-time.\n\nThis is what control looks like — when your system works for you.',
     ARRAY['#FreyAIVisions', '#Dashboard', '#Craftsmanship', '#RealTime', '#BusinessIntelligence'],
     'img/Gemini_Generated_Image_1lef191lef191lef.png',
     '2026-03-30 10:00:00+02', 'approved');

    -- Post 11 EN: "The War Room" — Fr 03.04.2026 19:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Strategy isn''t a meeting. Strategy is clarity.\n\nWhen I digitize a new craft business, I sit here. Alone. And think through the entire process — from customer inquiry to final payment reminder.\n\nNot a single line of code is written until every step is locked.\n\nThat''s the difference between an app and a system.',
     ARRAY['#FreyAIVisions', '#Strategy', '#SystemDesign', '#Craftsmanship', '#Digitalization'],
     NULL, -- Image TBD
     '2026-04-03 19:00:00+02', 'draft');

    -- Post 12 EN: "AI Copilot" — So 05.04.2026 13:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Your AI copilot. Always there. Never in the way.\n\n→ "Create a quote for Müller, bathroom renovation, 12m²" — done in 4 seconds.\n→ "When is Schmidt''s next appointment?" — calendar checks itself.\n→ "What materials do I need for this order?" — inventory checks, reorders.\n\nNo typing. No searching. No waiting.\n\nCraft + AI = FreyAI.',
     ARRAY['#FreyAIVisions', '#AI', '#AICopilot', '#Craftsmanship', '#Automation'],
     'img/Gemini_Generated_Image_7n1dan7n1dan7n1d (1).png',
     '2026-04-05 13:00:00+02', 'approved');

    -- Post 17 EN: "Chess, Not Checkers" — Mo 13.04.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Your competitor posts on Instagram.\nYou have a system that auto-follows up on quotes.\n\nYour competitor hires more people.\nYou have processes that replace 2 full-time roles.\n\nYour competitor cuts marketing.\nYou invest in infrastructure.\n\nChess, not checkers.',
     ARRAY['#FreyAIVisions', '#Strategy', '#Competition', '#Craftsmanship', '#SystemsThinking'],
     NULL, -- Image TBD
     '2026-04-13 10:00:00+02', 'draft');

    -- Post 19 EN: "Digital Handshake" — Fr 17.04.2026 19:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Handshake 2.0.\n\nIn the trades, the handshake matters. Trust. Keeping your word.\n\nAt FreyAI, too. Except our handshake is a system that never forgets:\n→ No quote left pending\n→ No invoice forgotten\n→ No appointment missed\n\nDigital trust. Built analog.',
     ARRAY['#FreyAIVisions', '#DigitalHandshake', '#Trust', '#Craftsmanship', '#Reliability'],
     'img/Gemini_Generated_Image_p49mtrp49mtrp49m.png',
     '2026-04-17 19:00:00+02', 'approved');

    -- Post 20 EN: "Built Different" (Finale) — So 19.04.2026 13:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Built different.\n\n→ Others build tools. We build systems.\n→ Others sell subscriptions. We deliver infrastructure.\n→ Others promise "simple." We deliver "it works."\n\nFreyAI Visions. The digital backbone for Germany''s craftsmen.\n\n3-5 pilot spots open. DM for details.',
     ARRAY['#FreyAIVisions', '#BuiltDifferent', '#Craftsmanship', '#Premium', '#DigitalBackbone'],
     'img/Gemini_Generated_Image_bek6z4bek6z4bek6.png',
     '2026-04-19 13:00:00+02', 'approved');

    -- Posts that only had DE on non-LinkedIn — add EN LinkedIn versions:

    -- Post 3 EN: "Code & Craft" — Fr 20.03.2026 19:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Code meets craft.\n\nThat tablet doesn''t show Instagram. It shows:\n→ 14 open quotes\n→ 3 overdue invoices\n→ Inventory below minimum\n\nEverything at a glance. On-site. Even offline.\n\nThat''s FreyAI.',
     ARRAY['#FreyAIVisions', '#CodeAndCraft', '#Craftsmen', '#OfflineFirst', '#Dashboard'],
     'img/Gemini_Generated_Image_oi4wlxoi4wlxoi4w.png',
     '2026-03-20 19:00:00+01', 'approved');

    -- Post 6 EN: "Blueprint Revolution" — Mi 25.03.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'The blueprint stays. The method changes.\n\nCraftsmanship has always been innovation. From spirit levels to laser tools. From tape measures to 3D scanners.\n\nNext step? From paper binders to intelligent systems.\n\nFreyAI takes what works — and gives you the tools for what''s next.',
     ARRAY['#FreyAIVisions', '#BlueprintRevolution', '#Craftsmanship', '#Innovation', '#Digital'],
     'img/Gemini_Generated_Image_nzon2cnzon2cnzon.png',
     '2026-03-25 10:00:00+01', 'approved');

    -- Post 8 EN: "Break the Mold" — So 29.03.2026 13:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Done with paperwork chaos.\n\n→ 47 binders on the shelf? Gone.\n→ 3 Excel sheets for customer data? Gone.\n→ Writing invoices by hand? Gone.\n\nNot someday. Now.\n\nOne click: Quote → Order → Invoice → DATEV export.\n\nYour office deserves the same standard as your work on-site.',
     ARRAY['#FreyAIVisions', '#BreakTheMold', '#NoPaperwork', '#Craftsmanship', '#Efficiency'],
     'img/Gemini_Generated_Image_5gg5he5gg5he5gg5.png',
     '2026-03-29 13:00:00+02', 'approved');

    -- Post 10 EN: "The Mentor" — Mi 01.04.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Passing on knowledge. But smarter.\n\nThe master shows. The apprentice learns. The tablet documents.\n\nMeasurements, material lists, work steps — all digital. Not on a note that''s lost tomorrow.\n\nFreyAI makes craft knowledge persistent. So it stays, even when the master retires.',
     ARRAY['#FreyAIVisions', '#Master', '#Apprentice', '#KnowledgeTransfer', '#Craftsmanship'],
     'img/Gemini_Generated_Image_ieafjcieafjcieaf.png',
     '2026-04-01 10:00:00+02', 'approved');

    -- Post 13 EN: "Night Grind" — Mo 06.04.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Quiet nights. Loud results.\n\nWhile the world scrolls, I build systems that send invoices, confirm appointments, and check inventory tomorrow morning — without a human lifting a finger.\n\nAutomation isn''t luxury. It''s the standard your business deserves.',
     ARRAY['#FreyAIVisions', '#NightGrind', '#Automation', '#Craftsmanship', '#BuildInSilence'],
     'img/Gemini_Generated_Image_51m38351m38351m3.png',
     '2026-04-06 10:00:00+02', 'approved');

    -- Post 14 EN: "Master & Tech" — Mi 08.04.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'"We''ve always done it this way."\n\nThe most dangerous sentence in the trades. Not because tradition is bad — but because it alone isn''t enough.\n\nThe master showing a 3D model on a tablet today is building tomorrow''s business.\n\nFreyAI gives you the tools. You already have the master spirit.',
     ARRAY['#FreyAIVisions', '#Tradition', '#Innovation', '#Master', '#Craftsmanship'],
     'img/Gemini_Generated_Image_kgurhwkgurhwkgur.png',
     '2026-04-08 10:00:00+02', 'approved');

    -- Post 15 EN: "One Tap Away" — Fr 10.04.2026 19:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'One tap. One quote. One order.\n\nIt should be that simple. And with FreyAI, it is.\n\nNo laptop needed. No office needed. No "I''ll do it tomorrow."\n\nYour business in your pocket. 24/7. Even offline.',
     ARRAY['#FreyAIVisions', '#OneTapAway', '#Mobile', '#OfflineFirst', '#Craftsmanship'],
     'img/Gemini_Generated_Image_wwqlqfwwqlqfwwql.png',
     '2026-04-10 19:00:00+02', 'approved');

    -- Post 16 EN: "The Disruptor" — So 12.04.2026 13:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'A new era begins.\n\nNot science fiction. Not Hollywood.\n\nJust a craftsman burning his paperwork — and getting a system that works for him.\n\nReady for the change?\n\n→ DM or comment. No sales pitch. Just straight talk.',
     ARRAY['#FreyAIVisions', '#TheDisruptor', '#NewEra', '#Craftsmanship', '#Disruption'],
     'img/Gemini_Generated_Image_ddrtetddrtetddrt.png',
     '2026-04-12 13:00:00+02', 'approved');

    -- Post 18 EN: "The Prototype" — Mi 15.04.2026 10:00
    INSERT INTO marketing_posts (campaign_id, user_id, platform, format, caption, hashtags, image_url, scheduled_at, status)
    VALUES
    (v_campaign_id, v_user_id, 'linkedin', 'post',
     E'Built, not bought.\n\nFreyAI isn''t a white-label product. Not a relabeled SaaS. Every line of code, every function, every pixel — handcrafted.\n\nLike a masterpiece in the trades: No compromise. No shortcut.\n\nBecause your business doesn''t deserve an off-the-shelf product.',
     ARRAY['#FreyAIVisions', '#Handmade', '#Prototype', '#Craftsmanship', '#CustomBuilt'],
     NULL, -- Image TBD
     '2026-04-15 10:00:00+02', 'draft');

    RAISE NOTICE 'Founder campaign seeded with EN LinkedIn posts. Total posts: %',
        (SELECT COUNT(*) FROM marketing_posts WHERE campaign_id = v_campaign_id);

END $$;

-- ============================================================
-- Summary:
-- - 1 campaign: "FreyAI Visions Founder Brand"
-- - 20 unique posts → 31 DE platform variants + 20 EN LinkedIn posts = 51 total
-- - EN LinkedIn posts scheduled +2h after DE LinkedIn posts
-- - Posts with existing images: status = approved
-- - 4 posts awaiting Gemini Imagen generation: status = draft
--   → Post 11: "The War Room" (DE + EN)
--   → Post 17: "Chess, Not Checkers" (DE + EN)
--   → Post 18: "The Prototype" (DE + EN)
-- - Schedule: KW12-KW16 (2026-03-16 to 2026-04-19)
-- - DE cadence: Mo 08:00, Mi 08:00, Fr 17:00, So 11:00
-- - EN cadence: Mo 10:00, Mi 10:00, Fr 19:00, So 13:00
-- ============================================================
