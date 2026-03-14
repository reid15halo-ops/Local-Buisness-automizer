---
name: seo-landing
description: |
  SEO and landing page optimization for FreyAI Visions targeting German Handwerker.
  Use this skill when the user mentions: SEO, landing page, meta tags, structured data,
  Google ranking, keywords, Handwerker Software, Handwerkersoftware, page speed,
  Core Web Vitals, schema.org, Schema-Markup, sitemap, robots.txt, Open Graph,
  Twitter Card, Suchmaschinenoptimierung, Google-Platzierung, Sichtbarkeit,
  organischer Traffic, SERP, Meta-Beschreibung, kanonische URL, hreflang,
  Ladezeit, Bildoptimierung, strukturierte Daten, Breadcrumbs, FAQ-Schema,
  lokale Suche, Google My Business, or any question about search engine visibility.
  Be pushy — trigger on anything remotely SEO-related.
---

# SEO & Landeseiten — FreyAI Visions

Suchmaschinenoptimierung und Landeseiten-Erstellung fuer freyaivisions.de. Alles auf Deutsch, keine englischen Lehnwoerter im sichtbaren Inhalt.

## Schluesselwort-Strategie

### Primaere Schluesselwoerter

| Schluesselwort | Suchvolumen (geschaetzt) | Schwierigkeit | Einsatz |
|----------------|--------------------------|---------------|---------|
| Handwerker Software | Hoch | Mittel | Seitentitel, H1, Meta-Beschreibung |
| Handwerkersoftware | Hoch | Mittel | Fliesstext, Alt-Texte, URL-Pfade |
| digitale Handwerkerverwaltung | Mittel | Niedrig | Zwischenueberschriften, Beschreibungen |

### Sekundaere Schluesselwoerter

- **Stadtbezogen:** "Handwerker Software [Stadt]" — z.B. "Handwerker Software Frankfurt", "Handwerker Software Muenchen", "Handwerker Software Berlin"
- **Gewerkbezogen:** "Software fuer [Gewerk]" — z.B. "Rechnungsprogramm Handwerker", "Angebotssoftware Elektriker", "Auftragsplanung Dachdecker"
- **Funktionsbezogen:** "Rechnungsprogramm Handwerker", "Handwerker Buchhaltung", "Kundenverwaltung Handwerksbetrieb", "Auftragsverwaltung Handwerker"
- **Langform:** "beste Verwaltungssoftware fuer kleine Handwerksbetriebe", "digitale Loesung fuer Handwerker mit 5 bis 10 Mitarbeitern"

### Schluesselwort-Platzierung

1. **Seitentitel (title):** Primaeres Schluesselwort am Anfang, Marke am Ende
2. **H1:** Genau ein H1 pro Seite mit primaerem Schluesselwort
3. **Meta-Beschreibung:** Primaeres + sekundaeres Schluesselwort, Handlungsaufforderung
4. **Erster Absatz:** Primaeres Schluesselwort in den ersten 100 Woertern
5. **H2/H3:** Sekundaere Schluesselwoerter in Zwischenueberschriften
6. **Alt-Texte:** Beschreibend mit Schluesselwort, nicht ausgestopft
7. **URL-Pfade:** Kurz, deutsch, mit Schluesselwort: `/handwerker-software/`

## Meta-Vorlagen

### Seitentitel (title)

```html
<!-- Startseite -->
<title>Handwerker Software — Ihr digitaler Betrieb | FreyAI</title>

<!-- Stadtbezogene Landeseite -->
<title>Handwerker Software [Stadt] — Digitale Betriebsfuehrung | FreyAI Visions</title>

<!-- Gewerkbezogene Landeseite -->
<title>Software fuer [Gewerk] — Angebote, Rechnungen, Auftraege | FreyAI Visions</title>
```

Regeln: Maximal 60 Zeichen sichtbar. Primaeres Schluesselwort zuerst. Marke am Ende mit Trennstrich.

### Meta-Beschreibung (description)

```html
<!-- Startseite -->
<meta name="description" content="Handwerkersoftware fuer Betriebe mit 5–10 Mitarbeitern. Angebote, Rechnungen, Auftraege und Kundenverwaltung — massgeschneidert statt Massenware. Jetzt Beratung buchen.">

<!-- Stadtbezogen -->
<meta name="description" content="Handwerker Software in [Stadt]: Digitale Betriebsverwaltung fuer [Gewerk]. Angebote, Rechnungen, Terminplanung — alles aus einer Hand. Kostenlose Erstberatung.">
```

Regeln: 140–160 Zeichen. Handlungsaufforderung am Ende. Kein Ausrufezeichen-Spam.

### Kanonische URL

```html
<link rel="canonical" href="https://freyaivisions.de/handwerker-software/">
```

Jede Seite braucht genau eine kanonische URL. Immer mit abschliessendem Schraegstrich. HTTPS erzwingen.

### Open-Graph-Auszeichnung

```html
<meta property="og:title" content="Handwerker Software — FreyAI Visions">
<meta property="og:description" content="Massgeschneiderte Verwaltungssoftware fuer Handwerksbetriebe. Angebote, Rechnungen, Auftraege — digital und effizient.">
<meta property="og:image" content="https://freyaivisions.de/img/og-handwerker-software.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://freyaivisions.de/handwerker-software/">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="FreyAI Visions">
```

### Kurznachrichtenkarten-Auszeichnung (Twitter Card)

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Handwerker Software — FreyAI Visions">
<meta name="twitter:description" content="Massgeschneiderte Verwaltungssoftware fuer Handwerksbetriebe.">
<meta name="twitter:image" content="https://freyaivisions.de/img/og-handwerker-software.webp">
```

## Strukturierte Daten (Schema.org)

### Programmanwendung (SoftwareApplication)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FreyAI Visions Handwerkersoftware",
  "description": "Massgeschneiderte Verwaltungssoftware fuer Handwerksbetriebe mit 5 bis 10 Mitarbeitern",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, Android, iOS",
  "url": "https://freyaivisions.de",
  "author": {
    "@type": "Organization",
    "name": "FreyAI Visions"
  },
  "offers": {
    "@type": "Offer",
    "price": "300",
    "priceCurrency": "EUR",
    "description": "Monatlicher Betreuungstarif ab 300 EUR"
  }
}
```

### Organisation

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "FreyAI Visions",
  "url": "https://freyaivisions.de",
  "logo": "https://freyaivisions.de/img/logo.webp",
  "founder": {
    "@type": "Person",
    "name": "Jonas Glawion"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Grabenstrasse 135",
    "addressLocality": "Grossostheim",
    "postalCode": "63762",
    "addressCountry": "DE"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+49-163-6727787",
    "email": "kontakt@freyaivisions.de",
    "contactType": "Vertrieb"
  }
}
```

### Haeufig gestellte Fragen (FAQPage)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Was kostet die Handwerkersoftware von FreyAI Visions?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Die Einrichtung kostet zwischen 3.500 und 7.500 EUR, danach fallen monatlich 300 bis 500 EUR Betreuungsgebuehr an. Keine versteckten Kosten, kein Kleingedrucktes."
      }
    },
    {
      "@type": "Question",
      "name": "Fuer welche Handwerksbetriebe ist FreyAI geeignet?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "FreyAI Visions ist massgeschneidert fuer Handwerksbetriebe mit 5 bis 10 Mitarbeitern — vom Fliesenleger ueber Elektriker bis zum Dachdecker."
      }
    }
  ]
}
```

### Brotkrumen-Navigation (BreadcrumbList)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Startseite", "item": "https://freyaivisions.de/" },
    { "@type": "ListItem", "position": 2, "name": "Handwerker Software", "item": "https://freyaivisions.de/handwerker-software/" },
    { "@type": "ListItem", "position": 3, "name": "Elektriker Frankfurt", "item": "https://freyaivisions.de/handwerker-software/elektriker-frankfurt/" }
  ]
}
```

## Landeseiten-Textstruktur

Jede Landeseite folgt diesem Aufbau. **Kein einziges englisches Wort im sichtbaren Text.**

### 1. Heldenbereich (Hero)

- H1 mit primaerem Schluesselwort
- Untertitel: Konkreter Nutzen in einem Satz (max. 20 Woerter)
- Handlungsaufforderung: "Kostenlose Erstberatung buchen" oder "Jetzt Warteliste beitreten"
- Hintergrundbild: Handwerker bei der Arbeit (WebP, komprimiert)

### 2. Schmerzpunkte

- 3 konkrete Probleme des Zielgewerks benennen
- Spezifisch, nicht generisch: "Sie tippen Angebote noch in Word?" statt "Ineffiziente Prozesse"
- Jeder Schmerzpunkt mit kurzer Beschreibung (2-3 Saetze)

### 3. Funktionsuebersicht

- 4-6 Kernfunktionen mit Symbolen
- Jede Funktion: Ueberschrift + 1-Satz-Beschreibung + konkreter Nutzen
- Kein Funktionslisten-Friedhof — Transformation verkaufen, nicht Eigenschaften

### 4. Vertrauen und Beweise

- Gruendergeschichte: Steinmetz → Ingenieur → Gruender (Jonas versteht das Handwerk)
- Zahlen: "6 Stunden pro Woche gespart", "Null Papierchaos"
- Branchenspezifische Referenzen (wenn vorhanden, sonst "[Beispiel]" markieren)

### 5. Handlungsaufforderung (Abschluss)

- Wiederholung des Hauptnutzens
- Klare Aufforderung: "Beratung buchen" mit Verweis auf buchung.freyaivisions.de
- Verknappung: "Nur 10 Plaetze in der Testphase"

### Stadtbezogene Landeseiten

Fuer jede Zielstadt eine eigene Unterseite: `/handwerker-software/[stadt]/`

Inhaltlich anpassen:
- Stadtname in H1, Titel, Meta-Beschreibung
- Lokale Bezuege: "Handwerksbetriebe in [Stadt] und Umgebung"
- Regionale Besonderheiten erwaehnen wenn moeglich
- Eigene kanonische URL pro Stadtseite

## Kernnetzwerte (Core Web Vitals)

Zielwerte fuer die PWA:

| Metrik | Ziel | Massnahme |
|--------|------|-----------|
| LCP (Groesste sichtbare Darstellung) | < 2,5 Sekunden | Heldenbild als WebP, kritisches CSS inline, Schriften vorladen |
| FID (Erste Eingabeverzoegerung) | < 100 ms | JS-Buendel aufteilen, keine render-blockierenden Skripte |
| CLS (Kumulative Layoutverschiebung) | < 0,1 | Feste Bild-Abmessungen, Schriftarten-Anzeige: Tausch, kein nachladen ohne Platzhalter |
| INP (Reaktion auf naechste Eingabe) | < 200 ms | Lange Aufgaben aufteilen, Ereignisbehandlung entprellen |
| TTFB (Zeit bis zum ersten Byte) | < 800 ms | Statische Dateien, CDN nicht noetig bei Hostinger KVM |

### Umsetzung

```html
<!-- Kritische Schriften vorladen -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

<!-- Kritisches CSS inline -->
<style>/* Oberer sichtbarer Bereich hier inline */</style>

<!-- Nicht-kritisches CSS verzoegert laden -->
<link rel="stylesheet" href="/css/core.css" media="print" onload="this.media='all'">

<!-- Bilder mit festen Abmessungen -->
<img src="/img/hero.webp" width="1200" height="600" alt="Handwerker Software Verwaltungsoberflaeche" loading="eager">
```

## Technische Suchmaschinenoptimierung

### sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://freyaivisions.de/</loc>
    <lastmod>2026-03-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://freyaivisions.de/handwerker-software/</loc>
    <lastmod>2026-03-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <!-- Stadtbezogene Seiten -->
  <url>
    <loc>https://freyaivisions.de/handwerker-software/frankfurt/</loc>
    <lastmod>2026-03-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

### robots.txt

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth
Disallow: /js/services/
Sitemap: https://freyaivisions.de/sitemap.xml
```

### hreflang

```html
<link rel="alternate" hreflang="de-DE" href="https://freyaivisions.de/">
<link rel="alternate" hreflang="x-default" href="https://freyaivisions.de/">
```

Nur `de-DE` — keine englische Version. `x-default` zeigt auf die deutsche Seite.

### Kanonische URLs

- Immer HTTPS
- Immer mit abschliessendem Schraegstrich
- Keine URL-Parameter in kanonischen URLs
- Jede Seite hat genau eine kanonische URL

## DSGVO-konforme Analyse

- **Umami** unter `analytics.freyaivisions.de` — selbst gehostet, keine Drittanbieter-Kekse
- **Kein Google Analytics** — DSGVO-Verstoss ohne ausdrueckliche Einwilligung
- **Keine externen Schriften** — alle Schriften selbst gehostet unter `/fonts/`
- **Keine externen Skripte** — kein CDN, kein jQuery von aussen
- **Kekse-Hinweis** nur wenn tatsaechlich Kekse gesetzt werden (Umami ist keksfrei)

## Bildoptimierung

- **Format:** WebP fuer alle Bilder, AVIF als Fortschrittsoption
- **Verzoegertes Laden:** `loading="lazy"` fuer alle Bilder unterhalb des sichtbaren Bereichs
- **Sofortiges Laden:** `loading="eager"` nur fuer Heldenbild und erstes sichtbares Bild
- **Feste Abmessungen:** Immer `width` und `height` Attribute setzen (verhindert Layoutverschiebung)
- **Alt-Texte:** Beschreibend, auf Deutsch, mit Schluesselwort wenn natuerlich passend
- **Komprimierung:** Qualitaet 80-85% fuer WebP, maximale Dateigroesse 150 KB fuer Heldenbilder
- **Responsive:** `srcset` und `sizes` fuer verschiedene Bildschirmgroessen

```html
<picture>
  <source srcset="/img/hero-400.webp 400w, /img/hero-800.webp 800w, /img/hero-1200.webp 1200w"
          sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
          type="image/webp">
  <img src="/img/hero-800.jpg" width="1200" height="600"
       alt="FreyAI Handwerkersoftware Verwaltungsoberflaeche auf Bildschirm und Mobilgeraet"
       loading="eager">
</picture>
```

## Sprachregeln — Kein Englisch

Dieselben Regeln wie im Marketinginhalt. Null englische Woerter im sichtbaren Seiteninhalt.

| Verboten | Erlaubt |
|----------|---------|
| Software | Programm / Verwaltungsloesung (Ausnahme: "Handwerkersoftware" als eingedeutschter Fachbegriff fuer Suchmaschinen) |
| Features | Funktionen |
| Dashboard | Uebersicht / Verwaltungsoberflaeche |
| Tool | Werkzeug |
| Update | Aktualisierung |
| App | Anwendung |
| Landing Page | Landeseite |
| Call to Action | Handlungsaufforderung |
| Link | Verweis |
| Feedback | Rueckmeldung |
| Download | Herunterladen |
| Newsletter | Rundschreiben |
| Blog | Fachbeitraege / Ratgeber |
| Startup | Gruendung / junges Unternehmen |
| Cloud | Netzwerk-Speicher |
| Responsive | Bildschirmangepasst |
| Cookie | Keks (in technischem Kontext) |
| Team | Mannschaft / Belegschaft |

**Ausnahme:** "Handwerker Software" und "Handwerkersoftware" als Schluesselwoerter sind erlaubt, weil Nutzer genau danach suchen. Der Begriff "Software" ist in diesem Zusammenhang eingedeutscht und das primaere Suchschluesselwort.

## Qualitaetspruefung vor Veroeffentlichung

Vor jeder Landeseiten-Veroeffentlichung pruefen:

- [ ] Seitentitel unter 60 Zeichen, primaeres Schluesselwort am Anfang
- [ ] Meta-Beschreibung 140–160 Zeichen, mit Handlungsaufforderung
- [ ] Kanonische URL gesetzt (HTTPS, mit Schraegstrich)
- [ ] Open-Graph-Auszeichnung vollstaendig (Titel, Beschreibung, Bild 1200x630)
- [ ] Strukturierte Daten fehlerfrei (schema.org-Pruefwerkzeug)
- [ ] Genau ein H1 pro Seite
- [ ] Alle Bilder mit Alt-Text, festen Abmessungen, WebP-Format
- [ ] Null englische Woerter im sichtbaren Inhalt
- [ ] Schriften selbst gehostet (kein Google Fonts)
- [ ] Kein externes Nachladen (keine CDN-Skripte, keine Drittanbieter-Bilder)
- [ ] Ladezeit unter 2,5 Sekunden (LCP)
- [ ] robots.txt und sitemap.xml aktualisiert
