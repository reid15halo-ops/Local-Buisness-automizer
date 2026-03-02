/* ============================================================
   KONFIGURATION — Hier alle Inhalte der Website anpassen
   Einfach Texte ändern, Datei speichern, fertig.
   ============================================================ */

const CONFIG = {

    /* ── FIRMA ──────────────────────────────────────────── */
    business: {
        name:           "Muster Handwerk GmbH",
        tagline:        "Ihr zuverlässiger Handwerkspartner in München",
        phone:          "+49 89 123 456 78",
        email:          "info@muster-handwerk.de",
        address:        "Musterstraße 1, 80333 München",
        maps_link:      "https://maps.google.com/?q=Musterstraße+1+München",
        founding_year:  2005,
        logo_text:      "MH",           // Wird angezeigt wenn kein Logo-Bild vorhanden
    },

    /* ── HERO (STARTBEREICH) ─────────────────────────────── */
    hero: {
        headline:       "Qualität, die bleibt.",
        subheadline:    "Seit über 20 Jahren Ihr verlässlicher Partner für Handwerksarbeiten aller Art — pünktlich, sauber, fair.",
        cta_text:       "Jetzt kostenlos anfragen",
        hero_image:     "assets/hero.jpg",          // Bild ersetzen: gleichnamige Datei austauschen
    },

    /* ── LEISTUNGEN ──────────────────────────────────────── */
    services: [
        {
            icon:        "🔧",
            title:       "Sanitär & Heizung",
            description: "Von der Reparatur bis zur Komplettinstallation — wir sorgen für warmes Wasser und sichere Heizung."
        },
        {
            icon:        "⚡",
            title:       "Elektroinstallation",
            description: "Fachgerechte Elektroarbeiten nach aktuellen Normen. Sicher, zuverlässig, geprüft."
        },
        {
            icon:        "🏠",
            title:       "Renovierung & Umbau",
            description: "Badezimmer, Küche, Wohnraum — wir gestalten Ihr Zuhause nach Ihren Wünschen."
        },
        {
            icon:        "🪟",
            title:       "Fenster & Türen",
            description: "Einbau, Reparatur und Austausch von Fenstern und Türen aller Art."
        },
        {
            icon:        "🎨",
            title:       "Malerarbeiten",
            description: "Innen- und Außenanstriche mit hochwertigen Materialien für dauerhaften Schutz."
        },
        {
            icon:        "🔨",
            title:       "Allgemeine Reparaturen",
            description: "Der schnelle Handwerker für alle kleineren und größeren Reparaturen im Haus."
        }
    ],

    /* ── ZAHLEN & FAKTEN ─────────────────────────────────── */
    stats: [
        { value: "20+",   label: "Jahre Erfahrung" },
        { value: "500+",  label: "Zufriedene Kunden" },
        { value: "24h",   label: "Reaktionszeit" },
        { value: "100%",  label: "Festpreisgarantie" }
    ],

    /* ── ÜBER UNS ────────────────────────────────────────── */
    about: {
        headline:   "Handwerk mit Herz und Verstand.",
        text:       "Als familiengeführtes Unternehmen in zweiter Generation kennen wir die Werte, auf die es ankommt: Ehrlichkeit, Verlässlichkeit und handwerkliche Perfektion. Jedes Projekt behandeln wir so, als wäre es unser eigenes Zuhause.\n\nUnsere Handwerker sind ausgebildete Fachkräfte mit jahrelanger Erfahrung. Wir arbeiten sauber, pünktlich und halten was wir versprechen — immer zu einem fairen Festpreis.",
        about_image: "assets/about.jpg",    // Teamfoto oder Werkstattfoto
    },

    /* ── KUNDENSTIMMEN ───────────────────────────────────── */
    testimonials: [
        {
            name:   "Klaus M., München",
            text:   "Wir haben das Badezimmer komplett neu machen lassen. Alles wurde pünktlich, sauber und zum vereinbarten Preis fertiggestellt. Absolut empfehlenswert!",
            stars:  5
        },
        {
            name:   "Sabine H., Augsburg",
            text:   "Schnelle Reaktionszeit, freundliche Handwerker und top Ergebnis. Beim nächsten Projekt komme ich definitiv wieder.",
            stars:  5
        },
        {
            name:   "Thomas B., Dachau",
            text:   "Endlich ein Handwerksbetrieb, der auch die Wahrheit sagt und keine versteckten Kosten hat. Sehr vertrauenswürdig.",
            stars:  5
        }
    ],

    /* ── KONTAKT-FORMULAR ────────────────────────────────── */
    contact: {
        headline:       "Kostenlos anfragen",
        subheadline:    "Wir melden uns innerhalb von 24 Stunden bei Ihnen.",
        form_endpoint:  "",     // Formspree-URL eintragen: https://formspree.io/f/XXXX
                                // Oder leer lassen → mailto: Fallback
    },

    /* ── SEO ─────────────────────────────────────────────── */
    seo: {
        title:       "Muster Handwerk GmbH | Ihr Handwerker in München",
        description: "Professionelle Handwerksleistungen in München und Umgebung. Sanitär, Elektro, Renovierung. Festpreisgarantie. ✓ Seit 2005 ✓ 500+ Kunden ✓ 24h Reaktion"
    }
};
