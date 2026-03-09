# Canva Template Library — FreyAI Marketing Pakete

**Stand: März 2026**

---

## Template-Struktur

Jede Kategorie hat Master-Templates in Canva, die per API geklont und mit Kundendaten personalisiert werden.

### Namenskonvention

```
FREY_MKT_{KATEGORIE}_{FORMAT}_{NR}
```

Beispiele:
- `FREY_MKT_VORHER_NACHHER_POST_01`
- `FREY_MKT_TEAM_STORY_03`
- `FREY_MKT_TIPPS_REEL_COVER_01`

---

## Kategorien & Templates

### 1. Vorher/Nachher (`vorher_nachher`)
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_VN_POST_01 | 1080x1080 Post | Split-Screen mit Pfeil | `{{project_photo_before}}`, `{{project_photo_after}}`, `{{company_name}}`, `{{logo}}` |
| FREY_MKT_VN_POST_02 | 1080x1080 Post | Slider-Look mit Daumen | `{{project_photo_before}}`, `{{project_photo_after}}`, `{{project_title}}`, `{{logo}}` |
| FREY_MKT_VN_POST_03 | 1080x1080 Post | Minimaler Frame | `{{project_photo_before}}`, `{{project_photo_after}}`, `{{company_name}}` |
| FREY_MKT_VN_POST_04 | 1080x1080 Post | Grid 2x2 | `{{photos[4]}}`, `{{company_name}}`, `{{logo}}` |
| FREY_MKT_VN_POST_05 | 1080x1080 Post | Carousel Start-Slide | `{{project_title}}`, `{{company_name}}`, `{{brand_color}}` |
| FREY_MKT_VN_POST_06 | 1080x1080 Post | Dark Mode Vergleich | `{{project_photo_before}}`, `{{project_photo_after}}`, `{{logo}}` |

### 2. Team & Werkstatt (`team`)
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_TEAM_POST_01 | 1080x1080 Post | Mitarbeiter-Spotlight | `{{employee_photo}}`, `{{employee_name}}`, `{{role}}`, `{{company_name}}` |
| FREY_MKT_TEAM_POST_02 | 1080x1080 Post | Gruppenbild + Quote | `{{team_photo}}`, `{{quote}}`, `{{company_name}}` |
| FREY_MKT_TEAM_POST_03 | 1080x1080 Post | Werkstatt-Tour | `{{workshop_photo}}`, `{{company_name}}`, `{{logo}}` |
| FREY_MKT_TEAM_POST_04 | 1080x1080 Post | "Wir stellen ein" | `{{position}}`, `{{company_name}}`, `{{city}}`, `{{logo}}` |
| FREY_MKT_TEAM_POST_05 | 1080x1080 Post | Jubiläum/Geburtstag | `{{employee_name}}`, `{{years}}`, `{{company_name}}` |
| FREY_MKT_TEAM_POST_06 | 1080x1080 Post | Fun Fact Friday | `{{fun_fact}}`, `{{employee_photo}}`, `{{logo}}` |
| FREY_MKT_TEAM_STORY_01 | 1080x1920 Story | "Meet the Team" Serie | `{{employee_photo}}`, `{{employee_name}}`, `{{fun_fact}}` |
| FREY_MKT_TEAM_STORY_02 | 1080x1920 Story | Behind the Scenes | `{{workshop_photo}}`, `{{company_name}}` |

### 3. Tipps & Tricks (`tipps`)
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_TIPPS_POST_01 | 1080x1080 Post | "3 Fehler bei..." | `{{topic}}`, `{{tip_1}}`, `{{tip_2}}`, `{{tip_3}}`, `{{logo}}` |
| FREY_MKT_TIPPS_POST_02 | 1080x1080 Post | "Wussten Sie schon?" | `{{fact}}`, `{{company_name}}`, `{{brand_color}}` |
| FREY_MKT_TIPPS_POST_03 | 1080x1080 Post | Checkliste | `{{checklist_items[5]}}`, `{{topic}}`, `{{logo}}` |
| FREY_MKT_TIPPS_POST_04 | 1080x1080 Post | Schritt-für-Schritt | `{{steps[4]}}`, `{{topic}}`, `{{company_name}}` |
| FREY_MKT_TIPPS_POST_05 | 1080x1080 Post | Profi vs. DIY | `{{comparison_photo}}`, `{{topic}}`, `{{logo}}` |
| FREY_MKT_TIPPS_POST_06 | 1080x1080 Post | Saisonaler Tipp | `{{season}}`, `{{tip}}`, `{{company_name}}` |

### 4. Kundenstimmen (`kundenstimmen`)
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_KS_POST_01 | 1080x1080 Post | Zitat + 5 Sterne | `{{customer_name}}`, `{{quote}}`, `{{stars}}`, `{{logo}}` |
| FREY_MKT_KS_POST_02 | 1080x1080 Post | Google Review Screenshot | `{{review_screenshot}}`, `{{company_name}}` |
| FREY_MKT_KS_POST_03 | 1080x1080 Post | Projekt + Kundenfeedback | `{{project_photo}}`, `{{quote}}`, `{{customer_name}}` |
| FREY_MKT_KS_POST_04 | 1080x1080 Post | "Danke für Ihr Vertrauen" | `{{customer_count}}`, `{{company_name}}`, `{{logo}}` |
| FREY_MKT_KS_POST_05 | 1080x1080 Post | Video-Thumbnail Testimonial | `{{customer_photo}}`, `{{quote}}`, `{{company_name}}` |
| FREY_MKT_KS_POST_06 | 1080x1080 Post | Vorher/Nachher + Review | `{{before}}`, `{{after}}`, `{{quote}}`, `{{logo}}` |

### 5. Saisonale Posts (`saisonal`)
| Template ID | Format | Monate | Dynamische Felder |
|-------------|--------|--------|-------------------|
| FREY_MKT_SAISON_POST_01 | 1080x1080 Post | 3,4,5 (Frühling) | `{{spring_service}}`, `{{company_name}}`, `{{phone}}` |
| FREY_MKT_SAISON_POST_02 | 1080x1080 Post | 6,7,8 (Sommer) | `{{summer_service}}`, `{{company_name}}`, `{{phone}}` |
| FREY_MKT_SAISON_POST_03 | 1080x1080 Post | 9,10,11 (Herbst) | `{{autumn_service}}`, `{{company_name}}`, `{{phone}}` |
| FREY_MKT_SAISON_POST_04 | 1080x1080 Post | 12,1,2 (Winter) | `{{winter_service}}`, `{{company_name}}`, `{{phone}}` |
| FREY_MKT_SAISON_POST_05 | 1080x1080 Post | 12 (Weihnachten) | `{{company_name}}`, `{{logo}}`, `{{greeting}}` |
| FREY_MKT_SAISON_POST_06 | 1080x1080 Post | 1 (Neujahr) | `{{company_name}}`, `{{logo}}`, `{{new_year_message}}` |

### 6. Behind the Scenes (`behind_scenes`)
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_BTS_POST_01 | 1080x1080 Post | Werkzeug des Tages | `{{tool_photo}}`, `{{tool_name}}`, `{{company_name}}` |
| FREY_MKT_BTS_POST_02 | 1080x1080 Post | Baustellen-Update | `{{site_photo}}`, `{{project_name}}`, `{{logo}}` |
| FREY_MKT_BTS_POST_03 | 1080x1080 Post | Material-Spotlight | `{{material_photo}}`, `{{material_name}}`, `{{why_we_use_it}}` |
| FREY_MKT_BTS_POST_04 | 1080x1080 Post | Morgenroutine | `{{morning_photo}}`, `{{company_name}}` |
| FREY_MKT_BTS_POST_05 | 1080x1080 Post | "So arbeiten wir" | `{{process_photos[3]}}`, `{{company_name}}` |
| FREY_MKT_BTS_POST_06 | 1080x1080 Post | Fuhrpark/Equipment | `{{vehicle_photo}}`, `{{company_name}}`, `{{logo}}` |

### 7. Angebote & Aktionen (`angebote`) — ab Paket M
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_AKT_POST_01 | 1080x1080 Post | Prozent-Rabatt | `{{discount_percent}}`, `{{service}}`, `{{valid_until}}`, `{{phone}}` |
| FREY_MKT_AKT_POST_02 | 1080x1080 Post | Festpreis-Angebot | `{{price}}`, `{{service}}`, `{{company_name}}`, `{{phone}}` |
| FREY_MKT_AKT_POST_03 | 1080x1080 Post | Bundle-Deal | `{{services[3]}}`, `{{bundle_price}}`, `{{company_name}}` |
| FREY_MKT_AKT_POST_04 | 1080x1080 Post | "Jetzt anfragen" CTA | `{{service}}`, `{{phone}}`, `{{website}}`, `{{logo}}` |
| FREY_MKT_AKT_POST_05 | 1080x1080 Post | Gutschein-Code | `{{code}}`, `{{discount}}`, `{{valid_until}}`, `{{logo}}` |
| FREY_MKT_AKT_POST_06 | 1080x1080 Post | Limited Time Offer | `{{service}}`, `{{countdown_date}}`, `{{company_name}}` |

### 8. Lokaler Bezug (`lokal`) — ab Paket M
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_LOKAL_POST_01 | 1080x1080 Post | "Ihr [Gewerk] in [Stadt]" | `{{trade}}`, `{{city}}`, `{{company_name}}`, `{{logo}}` |
| FREY_MKT_LOKAL_POST_02 | 1080x1080 Post | Lokales Projekt | `{{project_photo}}`, `{{neighborhood}}`, `{{company_name}}` |
| FREY_MKT_LOKAL_POST_03 | 1080x1080 Post | Karte/Einzugsgebiet | `{{region_map}}`, `{{cities_served}}`, `{{company_name}}` |
| FREY_MKT_LOKAL_POST_04 | 1080x1080 Post | Lokale Partnerschaft | `{{partner_name}}`, `{{partner_logo}}`, `{{company_name}}` |
| FREY_MKT_LOKAL_POST_05 | 1080x1080 Post | Stadtfest/Event | `{{event_name}}`, `{{date}}`, `{{company_name}}` |
| FREY_MKT_LOKAL_POST_06 | 1080x1080 Post | "X Jahre in [Stadt]" | `{{years}}`, `{{city}}`, `{{company_name}}`, `{{logo}}` |

### 9. Meilensteine (`meilensteine`) — nur Paket L
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_MILE_POST_01 | 1080x1080 Post | Follower-Meilenstein | `{{count}}`, `{{company_name}}`, `{{logo}}` |
| FREY_MKT_MILE_POST_02 | 1080x1080 Post | Projekt-Meilenstein | `{{project_count}}`, `{{company_name}}` |
| FREY_MKT_MILE_POST_03 | 1080x1080 Post | Firmenjubiläum | `{{years}}`, `{{company_name}}`, `{{founding_year}}` |
| FREY_MKT_MILE_POST_04 | 1080x1080 Post | Award/Zertifizierung | `{{award_name}}`, `{{year}}`, `{{logo}}` |

### 10. Wissen/Infografik (`wissen`) — nur Paket L
| Template ID | Format | Beschreibung | Dynamische Felder |
|-------------|--------|-------------|-------------------|
| FREY_MKT_WISSEN_POST_01 | 1080x1080 Post | "So funktioniert..." | `{{topic}}`, `{{diagram}}`, `{{company_name}}` |
| FREY_MKT_WISSEN_POST_02 | 1080x1080 Post | Vergleichstabelle | `{{option_a}}`, `{{option_b}}`, `{{data}}`, `{{logo}}` |
| FREY_MKT_WISSEN_POST_03 | 1080x1080 Post | Kosten-Rechner Visual | `{{service}}`, `{{price_range}}`, `{{factors}}` |
| FREY_MKT_WISSEN_POST_04 | 1080x1080 Post | Normen & Vorschriften | `{{regulation}}`, `{{what_it_means}}`, `{{company_name}}` |

---

## Caption-Templates

Jedes Post-Template hat eine zugehörige Caption mit Platzhaltern:

```
Kategorie: vorher_nachher
Caption: "Von alt zu neu — {{project_title}} in {{city}}. 💪

{{company_name}} hat es wieder geschafft. Swipe für das Ergebnis!

📞 Jetzt anfragen: {{phone}}
🌐 {{website}}

{{hashtags}}"
```

```
Kategorie: tipps
Caption: "{{tip_title}} — 3 Dinge, die Sie wissen sollten:

1️⃣ {{tip_1}}
2️⃣ {{tip_2}}
3️⃣ {{tip_3}}

Fragen? {{company_name}} berät Sie gerne.
📞 {{phone}}

{{hashtags}}"
```

```
Kategorie: kundenstimmen
Caption: "⭐⭐⭐⭐⭐

\"{{quote}}\"
— {{customer_name}}

Danke für Ihr Vertrauen! Auch Sie können von unserer Arbeit profitieren.
📞 {{phone}} | 🌐 {{website}}

{{hashtags}}"
```

---

## Canva API Integration

### Workflow: Template personalisieren

1. **Clone Master Template** → `POST /v1/designs` (from template)
2. **Update Brand Kit** → Farben, Fonts, Logo ersetzen
3. **Fill Dynamic Fields** → Text-Elemente mit Kundendaten ersetzen
4. **Export as PNG** → `POST /v1/designs/{id}/exports`
5. **Upload to Supabase Storage** → `marketing-posts/{campaign_id}/{post_id}.png`

### Erforderliche Canva Scopes

- `design:content:read`
- `design:content:write`
- `design:meta:read`
- `brandtemplate:content:read`
- `brandtemplate:meta:read`
- `asset:read`
- `folder:read`
- `folder:write`

---

*FreyAI Visions · Template Library v1.0*
