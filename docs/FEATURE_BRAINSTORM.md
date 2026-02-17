# MHS Workflow - Feature Brainstorm

> Generated 2026-02-17 | Based on codebase analysis + market research

---

## Current State Summary

MHS Workflow is already a comprehensive German craftsmen (Handwerker) business suite with:
- Full quote-to-invoice pipeline
- 85+ services, 14 modules, CRM, bookkeeping, DATEV export
- AI (Gemini), Stripe payments, email automation, PWA/offline
- Inventory, reorder engine, Gantt scheduling, time tracking
- Multi-language (DE/EN), dark/light mode, 481 tests

**The question: what's missing that would make this a market leader?**

---

## HIGH IMPACT - Revenue & Retention Drivers

### 1. AI Agentic Workflows (Autopilot Mode)
**What:** An AI agent that autonomously handles routine tasks -- not just generates text, but *takes action*. For example: "Every morning, check overdue invoices, send reminders, flag high-risk customers, and draft follow-up quotes for leads that haven't responded in 3 days."

**Why:** 96% of enterprises plan to expand AI agent use. This moves Gemini from "text helper" to "business partner." No competitor in the Handwerker space offers this.

**Implementation ideas:**
- Rule-based + AI hybrid: user defines triggers, AI decides actions
- "Morning briefing" agent that summarizes overnight activity
- Auto-draft quotes from inquiry details (already partially built via email-to-angebot)
- Predictive dunning: AI estimates payment likelihood and adjusts reminder tone
- Smart scheduling: AI suggests optimal appointment slots based on travel distance + job duration

---

### 2. Customer Self-Service Portal
**What:** A branded mini-portal where customers can: view their quotes/invoices, approve quotes with e-signature, pay invoices online, book appointments, upload photos of their project, and track job progress.

**Why:** Eliminates back-and-forth phone calls. Housecall Pro and Jobber both have this -- it's expected. Reduces admin work by 30-50% for customer communication.

**Implementation ideas:**
- Shareable link per customer (no login required, token-based)
- Real-time status page: "Your kitchen renovation - Phase 2 of 4"
- Photo upload for before/after documentation
- One-click quote approval + Stripe payment
- Built on existing Supabase auth + edge functions

---

### 3. Mobile Field App (Companion PWA)
**What:** A stripped-down mobile-first view optimized for craftsmen on job sites. Quick time logging, photo capture, material consumption tracking, customer signature capture, and offline-first with sync.

**Why:** Craftsmen spend 80% of their day on-site, not at a desk. The current app is responsive but designed for desktop workflows. A dedicated field mode would dramatically increase daily usage.

**Implementation ideas:**
- `/field` route or toggle in existing PWA
- Big-button UI: clock in, log material, take photo, get signature
- GPS-based automatic job site check-in
- Voice-to-note using Web Speech API
- Camera integration for receipt scanning (extend existing Tesseract OCR)

---

### 4. Automated Marketing & Lead Nurture
**What:** Simple automated marketing workflows -- Google review requests after job completion, seasonal campaign emails ("Time to service your heating system!"), referral program tracking, and social media post drafts.

**Why:** The #1 ROI feature for SMBs is automated lead follow-up (response time from hours to seconds). No FSM tool does marketing well. This bridges the GoHighLevel gap.

**Implementation ideas:**
- Post-job trigger: auto-send Google Review request via SMS/email
- Seasonal reminder engine: define service types + intervals, auto-notify past customers
- AI-generated social media posts from completed project photos
- Simple landing page builder for specific services
- Referral tracking: "Empfohlen von [Customer Name]" discount codes

---

### 5. Visual Drag-and-Drop Workflow Builder
**What:** A no-code canvas where users visually build automation rules: "When [quote approved] -> [create order] -> [reserve materials] -> [schedule in calendar] -> [send confirmation email]."

**Why:** 70% of new applications use low-code/no-code. Current automations are hidden in code. Making them visual and user-configurable is the single biggest UX differentiator.

**Implementation ideas:**
- Simple node-based editor (like n8n but embedded and simplified)
- Pre-built templates: "Standard Auftrag Flow", "Mahnung Escalation", "Nachfass-Automatik"
- Trigger types: time-based, event-based, status-change
- Action types: send email, create record, update status, notify, AI generate
- Connects to existing n8n backend for complex workflows

---

## MEDIUM IMPACT - Operational Excellence

### 6. Route Planning & Dispatch
**What:** Map-based view of all scheduled jobs for the day/week. Optimized route suggestions for multiple job sites. Assign jobs to team members based on location + skill + availability.

**Why:** German craftsmen drive 15,000-25,000 km/year for work. Even 10% route optimization saves significant fuel costs and gains 30-60 min/day.

**Implementation ideas:**
- Integration with OpenRouteService (free, EU-based, GDPR-compliant)
- Map view using Leaflet.js (open source)
- Drag-and-drop job assignment on map
- Travel time estimates between jobs
- Automatic "next job" notification to field workers

---

### 7. Subcontractor / Team Management
**What:** Manage subcontractors and employees -- assign work, track hours, share job details, handle internal billing between Meister and Geselle.

**Why:** Most Handwerker businesses have 2-10 people. Current app is single-user focused. Multi-user team features unlock the 3-10 employee segment (biggest market).

**Implementation ideas:**
- Role system: Meister (admin), Geselle (worker), Azubi (apprentice), Subunternehmer
- Per-job assignment with material lists and instructions
- Subcontractor portal (limited view, similar to customer portal)
- Internal time tracking per worker per job
- Payroll prep export

---

### 8. Photo & Document Management (Job Folders)
**What:** Per-job photo galleries and document folders. Before/after photos, damage documentation, permits, contracts, drawings -- all organized by job.

**Why:** Craftsmen take dozens of photos per job for documentation, warranties, and disputes. Currently there's no structured way to attach media to jobs.

**Implementation ideas:**
- Camera integration with auto-tagging (job ID, date, GPS)
- Supabase Storage for cloud sync
- Image compression for offline storage
- PDF report generation from photo galleries ("Baudokumentation")
- Integration with existing contract service

---

### 9. Supplier Marketplace / Price Comparison
**What:** Connect to supplier APIs (Grosshandel) to check real-time material prices, compare across suppliers, and auto-generate purchase orders at best price.

**Why:** Material costs are 40-60% of job costs for Handwerker. Small price differences across suppliers add up fast. This directly impacts profitability.

**Implementation ideas:**
- Integration with German wholesaler APIs (if available) or web scraping
- Price history tracking per material
- "Best price" recommendations when creating quotes
- Auto-update quote line items when material prices change
- Bulk ordering across multiple jobs for volume discounts

---

### 10. Warranty & Maintenance Tracking (Proactive)
**What:** Extend existing warranty service into a proactive maintenance engine. Track installed products, warranty expiry dates, and recommended maintenance intervals. Auto-notify customers when service is due.

**Why:** Recurring revenue from maintenance contracts is the most profitable segment for Handwerker. Turning one-time jobs into ongoing relationships.

**Implementation ideas:**
- Product registry per customer (e.g., "Heizung Viessmann 200-W, installed 2024-03")
- Maintenance schedule templates per product type
- Auto-generate service reminders (email/SMS)
- Maintenance contract management with recurring invoicing
- QR code on installed products linking to service history

---

## QUICK WINS - Low Effort, High Value

### 11. WhatsApp Business API Integration
**What:** Two-way WhatsApp messaging directly from the app. Send quotes, invoices, appointment reminders, and receive customer responses -- all in the existing communication hub.

**Why:** 95% of Germans use WhatsApp. The current WhatsApp-style UI is internal only. Connecting to actual WhatsApp is the single most requested feature in every Handwerker forum.

**Implementation ideas:**
- WhatsApp Business API via official Cloud API or 360dialog
- Template messages for quotes, invoices, reminders (pre-approved)
- Incoming message routing to correct customer record
- Media sharing (photos, PDFs)
- Existing communication-service.js already has the UI pattern

---

### 12. Voice Commands & Dictation
**What:** "Hey MHS, erstelle einen Termin bei Müller am Freitag um 14 Uhr" -- voice input for creating records, logging time, and adding notes. Especially useful on job sites with dirty hands.

**Why:** Web Speech API is free and works offline in Chrome. Zero infrastructure cost. Huge UX improvement for field use.

**Implementation ideas:**
- Web Speech API for speech-to-text
- Gemini for intent parsing ("create appointment" vs "log material" vs "add note")
- Voice-activated timer for time tracking
- Dictation mode for long notes and descriptions
- Language: German (de-DE) primary, English fallback

---

### 13. Dashboard Widgets & KPI Customization
**What:** Let users customize their dashboard -- choose which metrics to display, set personal targets, compare periods (this month vs last month), and add quick-access widgets.

**Why:** Current dashboard has 4 fixed metrics. Every business cares about different KPIs. Personalization increases daily app engagement.

**Implementation ideas:**
- Draggable widget grid (CSS Grid + drag API)
- Widget library: revenue, open quotes, overdue invoices, calendar, recent activity, cashflow chart, conversion rate, avg job value
- Comparison mode: "vs last month" / "vs last year"
- Target setting with progress bars
- Export dashboard as PDF report

---

### 14. Offline Sync Conflict Resolution UI
**What:** When offline edits conflict with cloud data, show a clear diff view and let the user choose which version to keep (or merge).

**Why:** Current app is offline-first but conflict resolution is automatic (last-write-wins). For business data like invoices, silent overwrites can cause real problems.

**Implementation ideas:**
- Conflict detection in existing db-service.js sync
- Side-by-side diff view for conflicting records
- "Keep mine" / "Keep cloud" / "Merge" options
- Conflict log for audit trail
- Background sync status indicator in header

---

### 15. Zapier / Make / n8n Public Integration
**What:** Publish the app as a trigger/action in Zapier, Make, or at minimum provide a well-documented webhook API so users can connect MHS to any other tool.

**Why:** Zapier has 7,000+ apps. Being listed there makes MHS discoverable and eliminates "but it doesn't connect to my accounting software" objections.

**Implementation ideas:**
- Document existing webhook endpoints as public API
- Create Zapier app (triggers: new invoice, new customer, status change; actions: create quote, add customer)
- OAuth2 for third-party authentication
- Rate limiting already exists in security-service.js
- Existing n8n integration can be template for Zapier/Make

---

## DIFFERENTIATORS - Unique to Handwerker Market

### 16. Aufmass (Site Measurement) Tool
**What:** Digital measurement recording for construction/renovation jobs. Input room dimensions, calculate area/volume, auto-populate quote line items with correct quantities.

**Why:** Aufmass is a daily task for every Handwerker. No app in this space does it digitally with quote integration. This alone would win customers.

**Implementation ideas:**
- Room dimension input (L x W x H) with visual preview
- Auto-calculate: wall area, floor area, volume, perimeter
- Deductions for windows/doors
- Direct integration with Angebot: "120m2 Wandfläche x Preis/m2"
- Save measurements per room per job
- Future: AR measurement via phone camera (experimental)

---

### 17. Bautagebuch (Construction Diary)
**What:** Daily digital construction log -- weather, workers present, work performed, materials used, incidents, photos. Auto-generated from time tracking + photos.

**Why:** Legally required for many construction projects in Germany (VOB/B). Currently done on paper. Digital version saves time and is more reliable.

**Implementation ideas:**
- Daily log template auto-populated from time tracking entries
- Weather API integration (OpenWeatherMap)
- Worker attendance from team check-ins
- Photo attachment with timestamps
- PDF export in standard Bautagebuch format
- Signature field for Bauleiter confirmation

---

### 18. SHK/Elektro Calculation Templates
**What:** Industry-specific calculation templates for common trades: plumbing (SHK), electrical, painting, flooring, roofing. Pre-built formulas for standard tasks.

**Why:** Each trade has standard calculation methods (e.g., paint coverage per m2, cable length per room). Pre-built templates save hours of quote preparation.

**Implementation ideas:**
- Template library per trade
- Standard formulas: "Malerarbeiten: m2 x Anstriche x Preis/m2"
- Material auto-calculation from quantities
- Integration with material-service.js for stock checking
- Community template sharing (future)

---

### 19. E-Rechnung (XRechnung / ZUGFeRD) Compliance
**What:** Generate legally compliant electronic invoices in XRechnung or ZUGFeRD format, as required for B2G (business-to-government) transactions in Germany since 2025.

**Why:** As of 2025, electronic invoicing is mandatory for government contracts in Germany. By 2028, it will likely extend to B2B. Early compliance is a competitive advantage.

**Implementation ideas:**
- ZUGFeRD PDF/A-3 generation (embed XML in PDF)
- XRechnung XML generation for government contracts
- Leitweg-ID field in customer records
- Validation against EN 16931 standard
- Extend existing pdf-generation-service.js

---

### 20. Apprentice Training Tracker
**What:** Track Azubi (apprentice) progress: skills learned, hours logged per skill area, Berichtsheft (weekly report) generation, and exam preparation milestones.

**Why:** Most Handwerker businesses train apprentices. The weekly Berichtsheft is a hated paperwork task. Auto-generating it from time tracking data is a killer feature.

**Implementation ideas:**
- Berichtsheft template auto-populated from time entries
- Skill matrix per trade (mapped to IHK/HWK requirements)
- Progress tracking with visual skill radar chart
- PDF export for submission to Kammer
- Reminder system for weekly report completion

---

## Priority Matrix

| Priority | Feature | Effort | Impact | Revenue Potential |
|----------|---------|--------|--------|-------------------|
| P0 | Customer Self-Service Portal | Medium | Very High | Direct (reduces churn) |
| P0 | WhatsApp Business Integration | Low-Med | Very High | Direct (engagement) |
| P0 | E-Rechnung Compliance | Medium | High | Mandatory by law |
| P1 | AI Agentic Workflows | High | Very High | Premium tier feature |
| P1 | Mobile Field App | Medium | Very High | Usage multiplier |
| P1 | Visual Workflow Builder | High | High | Premium tier feature |
| P1 | Aufmass Tool | Medium | High | Unique differentiator |
| P2 | Automated Marketing | Medium | High | Upsell opportunity |
| P2 | Route Planning | Medium | Medium | Time savings |
| P2 | Team Management | High | High | Unlocks larger customers |
| P2 | Voice Commands | Low | Medium | UX improvement |
| P2 | Dashboard Customization | Low | Medium | Engagement |
| P3 | Photo Management | Medium | Medium | Quality of life |
| P3 | Supplier Marketplace | High | Medium | Long-term play |
| P3 | Bautagebuch | Medium | Medium | Niche but valuable |
| P3 | Warranty/Maintenance Engine | Medium | Medium | Recurring revenue |
| P3 | Zapier Integration | Medium | Medium | Distribution |
| P3 | Calculation Templates | Low-Med | Medium | Trade-specific value |
| P3 | Apprentice Tracker | Low | Low-Med | Niche |
| P3 | Sync Conflict UI | Low | Low | Technical debt |

---

## Recommended Roadmap

**Phase 1 -- "Must-Have" (Next)**
1. E-Rechnung (XRechnung/ZUGFeRD) -- legal compliance, non-optional
2. Customer Self-Service Portal -- biggest admin time saver
3. WhatsApp Business Integration -- highest user demand

**Phase 2 -- "Growth" (After Phase 1)**
4. Mobile Field App mode -- unlock daily active usage
5. Aufmass Tool -- unique differentiator, no competitor has it
6. AI Agentic Workflows -- premium tier, market buzz

**Phase 3 -- "Scale" (Future)**
7. Team Management + Subcontractors -- move upmarket
8. Visual Workflow Builder -- power users, agencies
9. Automated Marketing -- recurring revenue from customer base
10. Route Planning + Voice -- operational excellence

---

*This document is a living brainstorm. Features should be validated with actual Handwerker users before implementation.*
