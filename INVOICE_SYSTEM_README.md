# Invoice Generation System - Implementierungsdokumentation

## Übersicht

Das Invoice Generation System ist ein vollständig implementiertes, GoBD-konformes Rechnungssystem für die Local-Business-Automizer App.

## Implementierte Features

### Phase 1: Kern-Services ✅

#### 1. Invoice Numbering Service (`invoice-numbering-service.js`)
- **GoBD-konforme Nummernvergabe**: Lückenlos, fortlaufend
- **Multi-User Support**: Separate Nummernkreise pro User via IndexedDB
- **Jährlicher Reset**: Automatisch am Jahreswechsel (2026-0001 → 2027-0001)
- **Flexible Formate**:
  - `{PREFIX}-{YEAR}-{NUMBER:4}` → RE-2026-0001
  - `{PREFIX}{YEAR}{NUMBER:4}` → RE20260001
  - `{PREFIX}-{NUMBER:6}` → RE-000001 (fortlaufend)
- **API**:
  - `generateNumber(userId, options)` - Generiert nächste Nummer
  - `previewNext(userId)` - Vorschau ohne Inkrement
  - `updateConfig(userId, config)` - Konfiguration ändern
  - `getCurrentSequence(userId)` - Aktuelle Sequenz abrufen

#### 2. Invoice Template Service (`invoice-template-service.js`)
- **Standard-Template**: "Standard Deutsch" mit allen §14 UStG Pflichtangaben
- **Template-Struktur**:
  - Header (Firmeninfo)
  - Kundenadresse
  - Rechnungsdetails (Nummer, Datum, Fälligkeitsdatum)
  - Positionstabelle
  - Summen (Netto, MwSt, Brutto)
  - Zahlungsbedingungen
  - Rechtliche Informationen
- **Variablen-System**: {{firma.name}}, {{kunde.name}}, {{rechnung.nummer}}, etc.
- **Integration**: Nutzt eInvoiceService.settings.businessData für Firmendaten
- **API**:
  - `render(templateId, data)` - Template mit Daten rendern
  - `getTemplate(templateId)` - Template abrufen
  - `getAllTemplates()` - Alle Templates auflisten

#### 3. PDF Generation Service (`pdf-generation-service.js`)
- **Bibliothek**: pdfmake (Lazy-Load via CDN)
- **CDN**: https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js
- **Features**:
  - `generateInvoicePDF(invoice, templateId)` - PDF-Objekt erstellen
  - `downloadPDF(invoice, templateId, filename)` - PDF herunterladen
  - `openPDF(invoice, templateId)` - PDF in neuem Tab öffnen
  - `getPDFBase64(invoice, templateId)` - Base64 für E-Mail
  - `getPDFBlob(invoice, templateId)` - Blob für Upload
- **Layout**: A4, professionelles Design mit Tabellen und Formatierung
- **Lazy-Loading**: pdfmake wird nur bei erster Nutzung geladen (Performance-Optimierung)

### Phase 2: Orchestrierung ✅

#### 4. Invoice Service (`invoice-service.js`)
- **Zentrale Orchestrierung** aller Invoice-Funktionen
- **API**:
  - `createInvoice(auftrag, options)` - Rechnung aus Auftrag erstellen
    - Optionen: `generatePDF`, `openPDF`, `downloadPDF`, `generateEInvoice`
  - `markAsPaid(invoiceId, paymentData)` - Als bezahlt markieren
  - `cancelInvoice(invoiceId, reason)` - Stornieren
  - `getOverdueInvoices()` - Überfällige Rechnungen
  - `generatePDF(invoiceId, options)` - PDF nachträglich generieren
  - `generateEInvoice(invoiceId, options)` - E-Rechnung nachträglich generieren
  - `getStatistics()` - Rechnungsstatistiken
- **Integration**:
  - store-service.js für Datenspeicherung
  - bookkeeping-service.js für Buchhaltung
  - eInvoice-service.js für XRechnung/ZUGFeRD
  - Activity-Logging

#### 5. Store-Service Integration
- **Modified**: `completeAuftrag()` → jetzt `async` und nutzt `invoiceService.createInvoice()`
- **Fallback**: Bei fehlender InvoiceService weiterhin einfache Rechnung
- **Optionen**: PDF/E-Rechnung direkt beim Abschluss generieren

### UI-Integration ✅

#### Rechnungen-View (index.html)
- **Neue Buttons in Rechnung-Cards**:
  - 📄 PDF - PDF herunterladen
  - 🔐 E-Rechnung - XRechnung XML generieren
  - ✓ Bezahlt - Als bezahlt markieren
  - 👁 Anzeigen - Details anzeigen
- **Header**: "Generierte Rechnungen (GoBD-konform)"
- **Button**: "⚙️ Vorlagen" → Link zu Einstellungen

#### Settings-View (index.html)
- **Neue Karte**: "📄 Rechnungsvorlagen"
  - Template-Auswahl (aktuell: Standard Deutsch)
- **Neue Karte**: "🔢 Rechnungsnummern"
  - Präfix-Konfiguration
  - Format-Auswahl
  - Nächste Nummer (Live-Vorschau)
  - Jährlicher Reset Toggle
  - ⚠️ GoBD-Hinweis

#### Event-Handler (app.js)
- `downloadInvoicePDF(invoiceId)` - PDF herunterladen
- `generateEInvoice(invoiceId)` - E-Rechnung erstellen
- `markInvoiceAsPaid(invoiceId)` - Bezahlt markieren
- `previewNextInvoiceNumber()` - Vorschau
- `updateInvoiceNumberPreview()` - Settings-Vorschau aktualisieren
- Settings-Handler für Template und Numbering

### Lazy-Loading ✅
- **Integration**: lazy-loader.js erweitert
- **Service-Gruppe**: `finance` enthält alle Invoice-Services
- **Trigger**: Wird geladen bei View "rechnungen" oder "buchhaltung"
- **Performance**: Services nur bei Bedarf geladen

## Technische Details

### Datenspeicherung

#### IndexedDB (via db-service.js)
```javascript
// Rechnungsnummern-Sequenz pro User
{
  key: 'invoice_sequence',
  value: {
    currentYear: 2026,
    currentNumber: 42,
    prefix: 'RE',
    format: '{PREFIX}-{YEAR}-{NUMBER:4}',
    resetYearly: true
  }
}
```

#### Store (via store-service.js)
```javascript
store.rechnungen = [
  {
    id: 'RE-xxxxx',
    nummer: 'RE-2026-0042',        // GoBD-konforme Nummer
    auftragId: 'AUF-xxxxx',
    angebotId: 'ANG-xxxxx',
    kunde: { ... },
    positionen: [ ... ],
    netto: 1000,
    mwst: 190,
    brutto: 1190,
    status: 'offen|bezahlt|storniert',
    datum: '2026-02-15T...',
    faelligkeitsdatum: '2026-03-01T...',
    paidAt: '...',                 // Wenn bezahlt
    pdfGenerated: true,
    eInvoiceGenerated: true,
    eInvoiceRecordId: 'xr-...',
    createdAt: '...'
  }
]
```

### GoBD-Konformität

✅ **Lückenlose Nummerierung**: Sequenzen werden atomar inkrementiert
✅ **Unveränderbarkeit**: Rechnungen werden nur erstellt, nicht überschrieben
✅ **Nachvollziehbarkeit**: Activity-Log für alle Änderungen
✅ **Archivierung**: Rechnungen bleiben im Store, können nicht gelöscht werden
✅ **Zeitstempel**: Alle Rechnungen haben createdAt, paidAt, etc.
⚠️ **Wichtig**: Sequenz-Reset nur bei Jahreswechsel oder mit Dokumentation!

### E-Rechnung Integration

Das System nutzt den bereits vorhandenen `einvoice-service.js`:
- **XRechnung 3.0.1** (UBL 2.1 XML)
- **ZUGFeRD 2.1.1** (Cross Industry Invoice)
- **Validierung**: Basic XML-Validierung
- **Download**: XML-Download für Versand
- **Peppol**: Demo-Support für Peppol-Versand

## Testing

### Test-Datei
`test-invoice-system.html` - Standalone-Testseite für alle Services

**Tests**:
1. ✅ Service Availability - Alle Services geladen?
2. ✅ Number Generation - Nummern generieren
3. ✅ Template Rendering - Template-Engine
4. ✅ PDF Generation - PDF erstellen und öffnen
5. ✅ Full Invoice Creation - Kompletter Workflow

**Nutzung**:
```bash
# Im Browser öffnen
file:///c:/Users/reid1/Documents/Local-Buisness-automizer/test-invoice-system.html
```

### Manuelle Tests in der App

1. **Auftrag abschließen** → Rechnung wird automatisch erstellt mit GoBD-Nummer
2. **PDF generieren** → Button in Rechnung-Card → Download
3. **E-Rechnung** → Button → XRechnung XML
4. **Bezahlt markieren** → Status ändern + Buchhaltung
5. **Settings** → Nummernkreis konfigurieren → Vorschau prüfen

## Verwendung

### Rechnung beim Auftrag-Abschluss erstellen
```javascript
// In completeAuftrag() automatisch
const rechnung = await window.invoiceService.createInvoice(auftrag, {
  generatePDF: false,      // Sofort PDF?
  openPDF: false,          // PDF öffnen?
  downloadPDF: false,      // PDF downloaden?
  generateEInvoice: false, // E-Rechnung?
  paymentTermDays: 14,     // Zahlungsziel
  templateId: 'standard-de'
});
```

### PDF nachträglich generieren
```javascript
await window.invoiceService.generatePDF('RE-xxxxx', {
  download: true,
  templateId: 'standard-de'
});
```

### Rechnung als bezahlt markieren
```javascript
await window.invoiceService.markAsPaid('RE-xxxxx', {
  method: 'Überweisung',
  note: 'Zahlungseingang bestätigt'
});
```

### Nächste Rechnungsnummer vorschauen
```javascript
const preview = await window.invoiceNumberingService.previewNext(userId);
// → "RE-2026-0043"
```

## Dateistruktur

```
/c/Users/reid1/Documents/Local-Buisness-automizer/
├── js/
│   ├── services/
│   │   ├── invoice-numbering-service.js  ← Nummernvergabe
│   │   ├── invoice-template-service.js   ← Templates
│   │   ├── pdf-generation-service.js     ← PDF-Engine
│   │   ├── invoice-service.js            ← Orchestrierung
│   │   ├── einvoice-service.js           ← E-Rechnung (bereits vorhanden)
│   │   ├── store-service.js              ← Modified: async completeAuftrag
│   │   └── lazy-loader.js                ← Modified: finance group
│   └── app.js                             ← Modified: Event-Handler
├── css/
│   └── components.css                     ← Modified: .btn-sm
├── index.html                             ← Modified: UI, Settings
├── test-invoice-system.html               ← NEU: Testseite
└── INVOICE_SYSTEM_README.md               ← Diese Datei
```

## Abhängigkeiten

### Vorhandene Services (genutzt)
- ✅ `db-service.js` - IndexedDB für Sequenzen
- ✅ `store-service.js` - Daten-Store
- ✅ `einvoice-service.js` - XRechnung/ZUGFeRD
- ✅ `bookkeeping-service.js` - Buchhaltung (optional)

### Externe Bibliotheken
- ✅ **pdfmake 0.2.7** - PDF-Generierung (Lazy-Load via CDN)
  - https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js
  - https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js

### Browser-APIs
- IndexedDB (über db-service.js)
- LocalStorage (Settings)
- Blob API (PDF-Download)
- URL.createObjectURL (Downloads)

## Performance-Optimierungen

1. **Lazy-Loading**: pdfmake nur bei Bedarf (~300KB gespart)
2. **Service-Gruppen**: Invoice-Services nur bei Rechnungen-View
3. **Async/Await**: Nicht-blockierende Operationen
4. **Caching**: Templates werden gecacht
5. **IndexedDB**: Effiziente User-spezifische Sequenzen

## Sicherheit & Compliance

### GoBD-Konformität
✅ Unveränderbarkeit der Rechnungen
✅ Lückenlose Nummerierung
✅ Vollständige Dokumentation
✅ Zeitstempel für alle Vorgänge
✅ Nachvollziehbarkeit durch Activity-Log

### Datenschutz
✅ Lokale Speicherung (keine Cloud)
✅ User-Trennung in IndexedDB
✅ Keine externen API-Calls (außer CDN für pdfmake)

### §14 UStG Pflichtangaben
✅ Name und Anschrift des Unternehmens
✅ Steuernummer / USt-IdNr
✅ Rechnungsdatum
✅ Fortlaufende Rechnungsnummer
✅ Name und Anschrift des Kunden
✅ Leistungsbeschreibung
✅ Nettobetrag, Steuersatz, Steuerbetrag
✅ Zahlungsbedingungen

## Bekannte Einschränkungen

1. **Template-Customization**: Aktuell nur "Standard Deutsch" vorhanden
   - Erweiterbar durch `invoiceTemplateService.createTemplate()`

2. **PDF-Fonts**: Nur Roboto (pdfmake default)
   - Custom Fonts möglich über vfs_fonts.js

3. **Multi-Currency**: Nur EUR implementiert
   - Erweiterbar in Template-Service

4. **E-Mail-Versand**: PDF als Base64 verfügbar, aber kein direkter Versand
   - Integration mit n8n Webhook möglich

5. **Batch-Verarbeitung**: Einzelne Rechnungen
   - Batch-PDF-Generierung nicht implementiert

## Erweiterungsmöglichkeiten

### Kurzfristig
- [ ] Weitere Templates (z.B. "Modern", "Minimal")
- [ ] Rechnungs-Vorschau im Modal
- [ ] Batch-PDF-Download
- [ ] Automatischer E-Mail-Versand

### Mittelfristig
- [ ] Mahnung-Templates
- [ ] Gutschriften / Stornorechnungen
- [ ] Wiederkehrende Rechnungen
- [ ] Multi-Currency Support
- [ ] Custom PDF-Layouts

### Langfristig
- [ ] ZUGFeRD PDF-Embedding (pdf-lib Integration)
- [ ] DATEV-Export für Rechnungen
- [ ] REST API für externe Systeme
- [ ] Cloud-Sync für Rechnungen

## Support & Wartung

### Logs prüfen
```javascript
// Console
console.log(window.invoiceService.getStatistics());
console.log(await window.invoiceNumberingService.getCurrentSequence('userId'));
```

### Service-Status
```javascript
// Alle Services geladen?
console.log(window.lazyLoader.getStats());
```

### Troubleshooting

**Problem**: PDF wird nicht generiert
- **Lösung**: Prüfe Browser-Console auf pdfmake-Fehler
- **CDN erreichbar?**: Teste https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js

**Problem**: Rechnungsnummern springen
- **Lösung**: Prüfe IndexedDB → user_xxx_data → invoice_sequence
- **Reset**: `invoiceNumberingService.resetSequence(userId, 0)`

**Problem**: E-Rechnung fehlt
- **Lösung**: eInvoiceService.settings.businessData prüfen/setzen

## Changelog

### Version 1.0.0 (2026-02-15)
- ✅ Initial Release
- ✅ Phase 1: Kern-Services implementiert
- ✅ Phase 2: Orchestrierung implementiert
- ✅ UI-Integration abgeschlossen
- ✅ Lazy-Loading konfiguriert
- ✅ Test-Suite erstellt
- ✅ Dokumentation erstellt

---

**Implementiert von**: Claude (Anthropic)
**Datum**: 2026-02-15
**Status**: ✅ Produktionsbereit
