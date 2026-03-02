# FreyAI Visions — Mini-Tools Produktstrategie
**Stand: März 2026 · Intern — nicht an Kunden weitergeben**

---

## 1. Das Problem

Handwerker kaufen keine Software — sie kaufen **Ergebnisse**.

Das Hauptprodukt (Website-Paket €119/Monat) ist für viele Handwerker zu abstrakt:
- *"Brauche ich eine Website?"* → Unsicher
- *"Was bringt mir das?"* → Nicht greifbar
- *"119 Euro im Monat?"* → Zu teuer ohne Beweis

**Lösung:** Wir bieten einzelne Mini-Tools an, die ein konkretes Problem lösen.
Der Handwerker sieht sofort den Nutzen, zahlt wenig, und gewöhnt sich an digitale Tools.

---

## 2. Die Produkt-Leiter

```
┌─────────────────────────────────────────────────────────┐
│  STUFE 0 — KOSTENLOS                                    │
│  Online-Auftritt-Check (Lead Magnet)                    │
│  → E-Mail-Adresse eingesammelt, Vertrauen aufgebaut     │
├─────────────────────────────────────────────────────────┤
│  STUFE 1 — €29/Monat                                    │
│  Google Review Booster ODER Morgenblick                  │
│  → Erstes digitales Tool, Gewohnheit entsteht           │
├─────────────────────────────────────────────────────────┤
│  STUFE 2 — €49/Monat                                    │
│  Schnell-Angebot (PDF-Generator)                        │
│  → Arbeitszeit-Ersparnis, Profi-Wirkung                │
├─────────────────────────────────────────────────────────┤
│  STUFE 3 — €79/Monat (Bundle)                           │
│  Alle 3 Tools zusammen (-25% Rabatt)                    │
│  → Abhängigkeit von digitalem Workflow                  │
├─────────────────────────────────────────────────────────┤
│  STUFE 4 — €119/Monat (Website-Paket)                   │
│  Professionelle One-Pager Website + alle Tools           │
│  → Volldigitaler Handwerksbetrieb                       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Preisübersicht

| Tool | Einzelpreis | Im Bundle | Im Website-Paket |
|---|---|---|---|
| Online-Auftritt-Check | **Kostenlos** | — | Inklusive |
| Google Review Booster | **€29/Monat** | €22/Monat | Inklusive |
| Morgenblick (Tagesplanung) | **€29/Monat** | €22/Monat | Inklusive |
| Schnell-Angebot (PDF) | **€49/Monat** | €35/Monat | Inklusive |
| **Bundle (alle 3)** | ~~€107~~ | **€79/Monat** | — |
| **Website-Paket (alles)** | — | — | **€119/Monat** |

**Setup-Gebühren:** Keine. Einstiegshürde so niedrig wie möglich.

**Kündigungsfrist:** Monatlich kündbar. Kein Risiko = kein Widerstand.

---

## 4. Kundenreise (Customer Journey)

```
Handwerker sieht Werbung / wird empfohlen
         │
         ▼
  ┌──────────────┐
  │ Auftritt-    │  Kostenlos — E-Mail wird eingesammelt
  │ Check machen │  → "So sieht Ihre Online-Präsenz aus"
  └──────┬───────┘  → "Das könnten Sie verbessern"
         │
         ▼
  ┌──────────────┐
  │ 30 Tage      │  Tool kostenlos testen
  │ Gratis-Test  │  → Täglich Mehrwert erleben
  └──────┬───────┘  → E-Mail nach 7/14/21/28 Tagen
         │
         ▼
  ┌──────────────┐
  │ Einzeltool   │  €29-49/Monat — Monatlich kündbar
  │ buchen       │  → "Läuft ja, mach ich weiter"
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ Bundle oder  │  Cross-Sell im Dashboard:
  │ 2. Tool      │  "Sie nutzen den Review Booster — mit dem
  └──────┬───────┘   Morgenblick sparen Sie 45 Min/Tag"
         │
         ▼
  ┌──────────────┐
  │ Website-     │  "Sie haben schon 3 Tools — die Website
  │ Paket        │   kommt für nur €40 mehr dazu"
  └──────────────┘
```

---

## 5. Technische Umsetzung

Jedes Tool ist **vollständig standalone** und besteht aus:
- Einer eigenen Landing Page (Verkaufsseite)
- Einer Kunden-Oberfläche (das eigentliche Tool)
- Einem Admin-Panel (für Jonas: Kunden verwalten)
- Einem Node.js Backend (Express)

**Shared Components** (einmal gebaut, überall genutzt):
- Auth-System (Login per E-Mail + Passwort)
- Stripe-Integration (Abo-Abrechnung)
- E-Mail-Versand (Nodemailer / Resend)
- FreyAI-Branding (CSS-Theme)

---

## 6. Verkaufs-Kanäle

| Kanal | Strategie |
|---|---|
| **Google Ads** | Keyword: "handwerker bewertungen bekommen", "angebot schreiben handwerker" |
| **Direktansprache** | Handwerker in der Region besuchen, Auftritt-Check zeigen |
| **Empfehlung** | "Empfehlen Sie uns → 1 Monat gratis" |
| **Social Media** | Vorher/Nachher-Posts (Google-Profil vorher vs. nachher) |
| **Handwerkskammer** | Kooperationspartner für Digitalisierungsworkshops |

---

## 7. KPIs & Ziele (Monat 1–6)

| Metrik | Ziel Monat 3 | Ziel Monat 6 |
|---|---|---|
| Online-Auftritt-Checks | 50 | 200 |
| E-Mail-Liste | 30 | 100 |
| Zahlende Kunden (Einzeltools) | 5 | 15 |
| Zahlende Kunden (Bundle) | 2 | 8 |
| Upgrade auf Website-Paket | 1 | 5 |
| **MRR (Monthly Recurring Revenue)** | **€290** | **€1.450** |

---

*FreyAI Visions · Jonas Frey · Intern*
