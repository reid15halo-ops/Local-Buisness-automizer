-- ============================================================
-- FreyAI Visions — Marketing Automation
-- Migration: Seed marketing_templates from Canva Template Library
-- Created: 2026-03-11
--
-- Note: canva_template_id values are NULL placeholders.
-- Update them after creating the corresponding Canva brand templates.
-- See: config/canva-templates/template-mapping.json
-- ============================================================

-- Clear existing templates to avoid duplicates on re-run
DELETE FROM marketing_templates WHERE name LIKE 'FREY_MKT_%';

-- ── 1. Vorher/Nachher ──────────────────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, caption_template, hashtag_groups) VALUES
('vorher_nachher', 'FREY_MKT_VN_POST_01', 'Split-Screen mit Pfeil', 'instagram', 'post', 'S', 10,
 'Von alt zu neu — {{project_title}} in {{city}}. 💪\n\n{{company_name}} hat es wieder geschafft. Swipe für das Ergebnis!\n\n📞 Jetzt anfragen: {{phone}}\n🌐 {{website}}\n\n{{hashtags}}',
 ARRAY['#vorherNachher', '#renovation', '#transformation']),
('vorher_nachher', 'FREY_MKT_VN_POST_02', 'Slider-Look mit Daumen', 'instagram', 'post', 'S', 11,
 'Vorher ➡️ Nachher\n\n{{project_title}} — {{company_name}} macht den Unterschied.\n\n📞 {{phone}}\n\n{{hashtags}}',
 ARRAY['#vorherNachher', '#renovation']),
('vorher_nachher', 'FREY_MKT_VN_POST_03', 'Minimaler Frame', 'facebook', 'post', 'S', 12,
 'Sehen Sie den Unterschied? {{project_title}} in {{city}}.\n\nMehr Projekte auf unserer Seite.\n📞 {{phone}} | 🌐 {{website}}\n\n{{hashtags}}',
 ARRAY['#vorherNachher', '#handwerk']),
('vorher_nachher', 'FREY_MKT_VN_POST_04', 'Grid 2x2', 'instagram', 'post', 'S', 13, NULL, ARRAY['#vorherNachher']),
('vorher_nachher', 'FREY_MKT_VN_POST_05', 'Carousel Start-Slide', 'instagram', 'post', 'S', 14, NULL, ARRAY['#vorherNachher', '#carousel']),
('vorher_nachher', 'FREY_MKT_VN_POST_06', 'Dark Mode Vergleich', 'instagram', 'post', 'S', 15, NULL, ARRAY['#vorherNachher', '#darkmode']);

-- ── 2. Team & Werkstatt ────────────────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, caption_template, hashtag_groups) VALUES
('team', 'FREY_MKT_TEAM_POST_01', 'Mitarbeiter-Spotlight', 'instagram', 'post', 'S', 20,
 'Unser Team macht den Unterschied.\n\nHeute stellen wir {{employee_name}} vor — {{role}} bei {{company_name}}.\n\n#teamwork #handwerkerteam\n\n{{hashtags}}',
 ARRAY['#teamwork', '#meisterteam']),
('team', 'FREY_MKT_TEAM_POST_02', 'Gruppenbild + Quote', 'facebook', 'post', 'S', 21, NULL, ARRAY['#teamwork']),
('team', 'FREY_MKT_TEAM_POST_03', 'Werkstatt-Tour', 'instagram', 'post', 'S', 22, NULL, ARRAY['#werkstatt', '#behindthescenes']),
('team', 'FREY_MKT_TEAM_POST_04', 'Wir stellen ein', 'instagram', 'post', 'S', 23,
 '🔧 Wir suchen Verstärkung!\n\n{{position}} (m/w/d) bei {{company_name}} in {{city}}.\n\nJetzt bewerben: {{phone}} oder {{website}}\n\n{{hashtags}}',
 ARRAY['#jobs', '#stellenangebot', '#handwerk']),
('team', 'FREY_MKT_TEAM_POST_05', 'Jubiläum/Geburtstag', 'facebook', 'post', 'S', 24, NULL, ARRAY['#jubiläum']),
('team', 'FREY_MKT_TEAM_POST_06', 'Fun Fact Friday', 'instagram', 'post', 'S', 25, NULL, ARRAY['#funfact', '#friday']),
('team', 'FREY_MKT_TEAM_STORY_01', 'Meet the Team Serie', 'instagram', 'story', 'M', 26, NULL, ARRAY['#meettheteam']),
('team', 'FREY_MKT_TEAM_STORY_02', 'Behind the Scenes', 'instagram', 'story', 'M', 27, NULL, ARRAY['#behindthescenes']);

-- ── 3. Tipps & Tricks ──────────────────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, caption_template, hashtag_groups) VALUES
('tipps', 'FREY_MKT_TIPPS_POST_01', '3 Fehler bei...', 'instagram', 'post', 'S', 30,
 '{{tip_title}} — 3 Dinge, die Sie wissen sollten:\n\n1️⃣ {{tip_1}}\n2️⃣ {{tip_2}}\n3️⃣ {{tip_3}}\n\nFragen? {{company_name}} berät Sie gerne.\n📞 {{phone}}\n\n{{hashtags}}',
 ARRAY['#handwerkertipps', '#expertentipp']),
('tipps', 'FREY_MKT_TIPPS_POST_02', 'Wussten Sie schon?', 'facebook', 'post', 'S', 31, NULL, ARRAY['#wusstensieschon']),
('tipps', 'FREY_MKT_TIPPS_POST_03', 'Checkliste', 'instagram', 'post', 'S', 32, NULL, ARRAY['#checkliste', '#tipps']),
('tipps', 'FREY_MKT_TIPPS_POST_04', 'Schritt-für-Schritt', 'instagram', 'post', 'S', 33, NULL, ARRAY['#tutorial', '#howto']),
('tipps', 'FREY_MKT_TIPPS_POST_05', 'Profi vs. DIY', 'instagram', 'post', 'S', 34, NULL, ARRAY['#profivsdiy']),
('tipps', 'FREY_MKT_TIPPS_POST_06', 'Saisonaler Tipp', 'facebook', 'post', 'S', 35, NULL, ARRAY['#saisonaltipp']);

-- ── 4. Kundenstimmen ───────────────────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, caption_template, hashtag_groups) VALUES
('kundenstimmen', 'FREY_MKT_KS_POST_01', 'Zitat + 5 Sterne', 'instagram', 'post', 'S', 40,
 '⭐⭐⭐⭐⭐\n\n"{{quote}}"\n— {{customer_name}}\n\nDanke für Ihr Vertrauen! Auch Sie können von unserer Arbeit profitieren.\n📞 {{phone}} | 🌐 {{website}}\n\n{{hashtags}}',
 ARRAY['#kundenmeinung', '#bewertung', '#zufriedeneKunden']),
('kundenstimmen', 'FREY_MKT_KS_POST_02', 'Google Review Screenshot', 'facebook', 'post', 'S', 41, NULL, ARRAY['#googlereview']),
('kundenstimmen', 'FREY_MKT_KS_POST_03', 'Projekt + Kundenfeedback', 'instagram', 'post', 'S', 42, NULL, ARRAY['#kundenfeedback']),
('kundenstimmen', 'FREY_MKT_KS_POST_04', 'Danke für Ihr Vertrauen', 'facebook', 'post', 'S', 43, NULL, ARRAY['#danke']),
('kundenstimmen', 'FREY_MKT_KS_POST_05', 'Video-Thumbnail Testimonial', 'instagram', 'post', 'S', 44, NULL, ARRAY['#testimonial']),
('kundenstimmen', 'FREY_MKT_KS_POST_06', 'Vorher/Nachher + Review', 'instagram', 'post', 'S', 45, NULL, ARRAY['#vorherNachher', '#review']);

-- ── 5. Saisonale Posts ─────────────────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, is_seasonal, season_months, caption_template, hashtag_groups) VALUES
('saisonal', 'FREY_MKT_SAISON_POST_01', 'Frühling', 'instagram', 'post', 'S', 50, TRUE, ARRAY[3,4,5], NULL, ARRAY['#frühling', '#frühjahrscheck']),
('saisonal', 'FREY_MKT_SAISON_POST_02', 'Sommer', 'instagram', 'post', 'S', 51, TRUE, ARRAY[6,7,8], NULL, ARRAY['#sommer']),
('saisonal', 'FREY_MKT_SAISON_POST_03', 'Herbst', 'facebook', 'post', 'S', 52, TRUE, ARRAY[9,10,11], NULL, ARRAY['#herbst', '#winterfest']),
('saisonal', 'FREY_MKT_SAISON_POST_04', 'Winter', 'facebook', 'post', 'S', 53, TRUE, ARRAY[12,1,2], NULL, ARRAY['#winter', '#heizungscheck']),
('saisonal', 'FREY_MKT_SAISON_POST_05', 'Weihnachten', 'instagram', 'post', 'S', 54, TRUE, ARRAY[12], NULL, ARRAY['#weihnachten', '#frohefeiertage']),
('saisonal', 'FREY_MKT_SAISON_POST_06', 'Neujahr', 'instagram', 'post', 'S', 55, TRUE, ARRAY[1], NULL, ARRAY['#neuesjahr', '#guterstart']);

-- ── 6. Behind the Scenes ───────────────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, hashtag_groups) VALUES
('behind_scenes', 'FREY_MKT_BTS_POST_01', 'Werkzeug des Tages', 'instagram', 'post', 'S', 60, ARRAY['#werkzeug', '#handwerkskunst']),
('behind_scenes', 'FREY_MKT_BTS_POST_02', 'Baustellen-Update', 'facebook', 'post', 'S', 61, ARRAY['#baustelle', '#fortschritt']),
('behind_scenes', 'FREY_MKT_BTS_POST_03', 'Material-Spotlight', 'instagram', 'post', 'S', 62, ARRAY['#material', '#qualität']),
('behind_scenes', 'FREY_MKT_BTS_POST_04', 'Morgenroutine', 'instagram', 'post', 'S', 63, ARRAY['#morgenroutine', '#handwerkeralltag']),
('behind_scenes', 'FREY_MKT_BTS_POST_05', 'So arbeiten wir', 'instagram', 'post', 'S', 64, ARRAY['#soarbeitenwir']),
('behind_scenes', 'FREY_MKT_BTS_POST_06', 'Fuhrpark/Equipment', 'facebook', 'post', 'S', 65, ARRAY['#fuhrpark', '#equipment']);

-- ── 7. Angebote & Aktionen (ab Paket M) ────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, caption_template, hashtag_groups) VALUES
('angebote', 'FREY_MKT_AKT_POST_01', 'Prozent-Rabatt', 'instagram', 'post', 'M', 70,
 '🔥 {{discount_percent}}% Rabatt auf {{service}}!\n\nNur bis {{valid_until}}.\n\n📞 Jetzt anfragen: {{phone}}\n\n{{hashtags}}',
 ARRAY['#angebot', '#rabatt', '#aktion']),
('angebote', 'FREY_MKT_AKT_POST_02', 'Festpreis-Angebot', 'facebook', 'post', 'M', 71, NULL, ARRAY['#festpreis']),
('angebote', 'FREY_MKT_AKT_POST_03', 'Bundle-Deal', 'instagram', 'post', 'M', 72, NULL, ARRAY['#bundle', '#sparen']),
('angebote', 'FREY_MKT_AKT_POST_04', 'Jetzt anfragen CTA', 'instagram', 'post', 'M', 73, NULL, ARRAY['#jetztanfragen']),
('angebote', 'FREY_MKT_AKT_POST_05', 'Gutschein-Code', 'instagram', 'post', 'M', 74, NULL, ARRAY['#gutschein']),
('angebote', 'FREY_MKT_AKT_POST_06', 'Limited Time Offer', 'facebook', 'post', 'M', 75, NULL, ARRAY['#limitiert', '#nurjetzt']);

-- ── 8. Lokaler Bezug (ab Paket M) ──────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, caption_template, hashtag_groups) VALUES
('lokal', 'FREY_MKT_LOKAL_POST_01', 'Ihr Gewerk in Stadt', 'instagram', 'post', 'M', 80,
 'Ihr {{trade}} in {{city}} — seit {{years}} Jahren.\n\n{{company_name}} steht für Qualität und Zuverlässigkeit.\n\n📞 {{phone}} | 🌐 {{website}}\n\n{{hashtags}}',
 ARRAY['#regional', '#lokalerHandwerker']),
('lokal', 'FREY_MKT_LOKAL_POST_02', 'Lokales Projekt', 'facebook', 'post', 'M', 81, NULL, ARRAY['#ausDerRegion']),
('lokal', 'FREY_MKT_LOKAL_POST_03', 'Karte/Einzugsgebiet', 'instagram', 'post', 'M', 82, NULL, ARRAY['#einzugsgebiet']),
('lokal', 'FREY_MKT_LOKAL_POST_04', 'Lokale Partnerschaft', 'facebook', 'post', 'M', 83, NULL, ARRAY['#partnerschaft']),
('lokal', 'FREY_MKT_LOKAL_POST_05', 'Stadtfest/Event', 'instagram', 'post', 'M', 84, NULL, ARRAY['#event']),
('lokal', 'FREY_MKT_LOKAL_POST_06', 'X Jahre in Stadt', 'facebook', 'post', 'M', 85, NULL, ARRAY['#jubiläum', '#tradition']);

-- ── 9. Meilensteine (nur Paket L) ──────────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, hashtag_groups) VALUES
('meilensteine', 'FREY_MKT_MILE_POST_01', 'Follower-Meilenstein', 'instagram', 'post', 'L', 90, ARRAY['#meilenstein', '#danke']),
('meilensteine', 'FREY_MKT_MILE_POST_02', 'Projekt-Meilenstein', 'facebook', 'post', 'L', 91, ARRAY['#meilenstein']),
('meilensteine', 'FREY_MKT_MILE_POST_03', 'Firmenjubiläum', 'instagram', 'post', 'L', 92, ARRAY['#jubiläum', '#tradition']),
('meilensteine', 'FREY_MKT_MILE_POST_04', 'Award/Zertifizierung', 'linkedin', 'post', 'L', 93, ARRAY['#auszeichnung', '#zertifiziert']);

-- ── 10. Wissen/Infografik (nur Paket L) ────────────────────
INSERT INTO marketing_templates (category, name, description, platform, format, min_package, sort_order, hashtag_groups) VALUES
('wissen', 'FREY_MKT_WISSEN_POST_01', 'So funktioniert...', 'instagram', 'post', 'L', 100, ARRAY['#wissenswertes', '#infografik']),
('wissen', 'FREY_MKT_WISSEN_POST_02', 'Vergleichstabelle', 'linkedin', 'post', 'L', 101, ARRAY['#vergleich']),
('wissen', 'FREY_MKT_WISSEN_POST_03', 'Kosten-Rechner Visual', 'instagram', 'post', 'L', 102, ARRAY['#kosten', '#transparent']),
('wissen', 'FREY_MKT_WISSEN_POST_04', 'Normen & Vorschriften', 'linkedin', 'post', 'L', 103, ARRAY['#normen', '#compliance']);
