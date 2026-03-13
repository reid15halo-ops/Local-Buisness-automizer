/* ============================================
   Angebote Module
   Angebote (quotes) CRUD and UI
   ============================================ */
(function() {

const { store, saveStore, addActivity, generateId, formatDate, formatCurrency, getLeistungsartLabel, openModal, closeModal, switchView, h, showToast } = window.AppUtils;

// Filter and search state
let currentAngeboteFilter = 'alle';
let currentAngeboteSearch = '';
let angeboteSearchDebounceTimer = null;

// ============================================
// Predefined position description templates
// ============================================
const POSITION_TEMPLATES = [
    // ── HEIZUNG ──────────────────────────────────────────────────────────
    {
        category: 'Heizung',
        beschreibung: 'Heizkessel austauschen',
        einheit: 'Pauschal',
        details: 'Fachgerechte Demontage des alten Heizkessels inkl. Entsorgung. Montage und Anschluss des neuen Heizkessels an alle vorhandenen Leitungen (Gas/Öl/Wasser/Abgas). Einstellung der Betriebsparameter, Inbetriebnahme und vollständiger Funktionstest. Übergabe inkl. Bedienungseinweisung und Abnahmeprotokoll.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Heizungsanlage warten (Jahresinspektion)',
        einheit: 'Pauschal',
        details: 'Vollständige Jahreswartung der Heizungsanlage: Reinigung des Brenners und Wärmetauschers, Kontrolle aller Sicherheitseinrichtungen (Sicherheitsventil, Druckbegrenzer, STB), Messung und Einstellung der Verbrennungswerte, Überprüfung von Betriebsdruck und Ausdehnungsgefäß, Kontrolle aller Dichtungen. Ausstellung eines Wartungsberichts.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Heizkörper montieren',
        einheit: 'Stk.',
        details: 'Montage des neuen Heizkörpers inkl. Wandhalterungen an der vorgesehenen Position. Anschluss an Vor- und Rücklauf mit neuen Thermostatventil und Rücklaufsperrventil, Entlüftung, Dichtheitsprüfung bei Betriebsdruck und hydraulische Einregulierung. Inkl. Befestigungsmaterial.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Heizkörper demontieren und entsorgen',
        einheit: 'Stk.',
        details: 'Absperren der Ventile und vollständiges Entleeren des Heizkörpers. Lösen aller Verbindungen und Wandbefestigungen. Absicherung der offenen Rohranschlüsse mit Verschlusskappen. Fachgerechte Entsorgung des Heizkörpers oder saubere Bereitstellung zur weiteren Verwendung nach Kundenwunsch.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Thermostatventil austauschen',
        einheit: 'Stk.',
        details: 'Absperren des Heizkreises, Demontage des alten Ventils, Montage des neuen Thermostatventils mit voreinstellbarer Rücklaufeinstellung, Befüllen und Entlüften. Einstellung der Durchflussmenge gemäß hydraulischem Abgleich. Dichtigkeitsprüfung und Funktionstest inklusive.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Fußbodenheizung installieren',
        einheit: 'm²',
        details: 'Verlegung der Fußbodenheizungsrohre nach Verlegeplan: Randdämmstreifen setzen, Trittschalldämmung verlegen, Heizrohre mit Clips befestigen. Anschluss an den Verteiler, Druckprüfung des Kreises mit Protokoll, Spülung, Inbetriebnahme und hydraulischer Abgleich. Dokumentation der Rohrlage für Bestandsunterlagen.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Ausdehnungsgefäß tauschen',
        einheit: 'Stk.',
        details: 'Druckablassung und Entleerung der Anlage, Demontage des alten Ausdehnungsgefäßes, Montage des neuen Gefäßes in korrekter Größe für den Anlageninhalt, Vordruck einstellen, Wiederbefüllen, Entlüften, Betriebsdruck prüfen. Dichtigkeitskontrolle aller neuen Verbindungen.'
    },
    {
        category: 'Heizung',
        beschreibung: 'Umwälzpumpe tauschen',
        einheit: 'Stk.',
        details: 'Absperren der Pumpe, Entleeren des Pumpenabschnitts, Demontage der defekten Pumpe. Montage der Ersatzpumpe mit neuen Dichtungen, Wiederbefüllen, Entlüften, Einstellung der Pumpenstufe auf den Anlagenbedarf. Funktionstests unter Betriebsbedingungen und Protokollierung der eingestellten Parameter.'
    },

    // ── SANITÄR ──────────────────────────────────────────────────────────
    {
        category: 'Sanitär',
        beschreibung: 'Wasserleitung verlegen',
        einheit: 'm',
        details: 'Fachgerechte Verlegung von Trinkwasserleitungen (Kalt-/Warmwasser) inkl. aller Fittings, Rohrhalterungen und Wärmedämmung gemäß DVGW- und Trinkwasserverordnung. Druckprüfung nach DIN EN 1282 mit Messprotokoll. Anschluss an das bestehende Leitungsnetz und Dichtheitsprüfung.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'WC / Toilette montieren',
        einheit: 'Stk.',
        details: 'Komplette Montage der WC-Einheit: Aufhängen der Keramik an der Wand (Vorwandinstallation) oder Aufstellung auf dem Boden, Anschluss an Spülkasten-Zufluss und Abwasseranschluss, Montage des WC-Sitzes, Dichtigkeitsprüfung und vollständiger Funktionstest. Inkl. Anschlussschläuche und Befestigungsmaterial.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Waschbecken / Waschtisch montieren',
        einheit: 'Stk.',
        details: 'Montage des Waschbeckens mit Wandhalterungen oder auf Unterschrank, Anschluss der Armatur, Kalt-/Warmwasserleitungen und des Geruchsverschlusses an den Abfluss, Einstellung des Überlaufs, Silikonfuge am Wandanschluss. Dichtigkeitsprüfung und Funktionstest aller Zu- und Abläufe.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Badewanne / Duschwanne installieren',
        einheit: 'Stk.',
        details: 'Aufstellung und Nivellierung der Wanne auf Wannenfüßen oder Wannenträger. Anschluss von Ablauf und Überlauf an die Abwasserleitung, Montage der Wannenarmatur, vollflächige Silikonfuge an allen Wand-Wanne-Übergängen. Dichtigkeitsprüfung und Probelauf.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Wasserhahn / Armatur wechseln',
        einheit: 'Stk.',
        details: 'Absperren der Hauptleitung, Demontage des alten Wasserhahns/der alten Armatur. Reinigung der Anschlussstellen, Montage der neuen Armatur mit passenden Dichtungen und flexiblen Anschlussschläuchen. Wiederinbetriebnahme, Dichtigkeitsprüfung und Einstellung des Wasserdrucks und Durchflusses.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Rohrbruch / Leckage reparieren',
        einheit: 'Pauschal',
        details: 'Lokalisierung der Schadstelle mittels Drucktest oder Sichtprüfung. Absperren des betroffenen Leitungsabschnitts, fachgerechte Reparatur (Austausch des Rohrabschnitts oder Reparatur-Fitting), Wiederinbetriebnahme unter Betriebsdruck, Dichtigkeitsprüfung und Protokollierung der Maßnahme. Umliegende Bauteile werden auf Folgeschäden geprüft.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Abfluss reinigen / Verstopfung beseitigen',
        einheit: 'Pauschal',
        details: 'Beseitigung der Rohrverstopfung mittels Rohrspirale, Sauger oder Hochdruckspülung. Vollständige Reinigung des Siphons und Abflussrohres bis zum Anschluss. Kontrolle des Gefälles und der Dichtigkeit. Bei starker Verschmutzung oder Schäden: Kamerabegehung und schriftliche Dokumentation des Befunds.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Duschkabine montieren',
        einheit: 'Stk.',
        details: 'Aufbau der Duschkabine nach Montageanleitung des Herstellers. Nivellierung des Rahmens und Profilschienen, Einsetzen der Türscheiben und Duschabtrennungen, Einstellung der Türmagnete und -scharniere auf Leichtgängigkeit, lückenlose Silikonfuge rund um alle Wand- und Bodenkontakte. Dichtigkeitstest mit Wasser.'
    },
    {
        category: 'Sanitär',
        beschreibung: 'Wasserfilteranlage einbauen',
        einheit: 'Stk.',
        details: 'Installation der Wasserfilteranlage (Feinfilter, Enthärtungsanlage oder Umkehrosmose) inkl. aller Absperrventile, By-pass und Manometer. Einstellung der Filterparameter nach Herstellervorgabe und Wasseranalyse, Erstbefüllung, Spülung und Funktionskontrolle. Einweisung des Kunden in Betrieb und Wartungsintervalle mit Wartungsaufkleber.'
    },

    // ── ELEKTRO ──────────────────────────────────────────────────────────
    {
        category: 'Elektro',
        beschreibung: 'Steckdosen / Lichtschalter installieren',
        einheit: 'Stk.',
        details: 'Fachgerechte Installation der Steckdosen oder Schalter nach VDE 0100. Verlegung der Zuleitung in Unterputz-Leerrohren oder vorhandenen Schlitzen, Verdrahtung (Phase, Null, PE), Beschriftung im Schaltschrank, Überprüfung der Erdung und korrekten Absicherung. Abnahmeprüfung mit Messprotokoll.'
    },
    {
        category: 'Elektro',
        beschreibung: 'Lampe / Leuchte montieren',
        einheit: 'Stk.',
        details: 'Montage der Leuchte an der vorhandenen Unterputzdose oder Deckenbefestigung. Fachgerechte Verdrahtung aller Leiter (L, N, PE) und Zugentlastung. Prüfung der korrekten Absicherung im Verteilerkasten. Funktionstest und Einstellung von Bewegungsmelder oder Dimmfunktion bei entsprechenden Geräten.'
    },
    {
        category: 'Elektro',
        beschreibung: 'Kabelverlegung',
        einheit: 'm',
        details: 'Verlegung von Elektrokabeln (NYM-J oder gleichwertig) in vorhandenen Leerrohren, Kabelkanälen oder neugefrästen Wandschlitzen. Zugentlastung, Kennzeichnung beider Kabelenden nach Schaltplan, Eintrag in die Dokumentation. Prüfung des Isolationswiderstands nach VDE 0100 Teil 600 mit Protokoll.'
    },
    {
        category: 'Elektro',
        beschreibung: 'Verteilerkasten / Sicherungsanlage prüfen',
        einheit: 'Pauschal',
        details: 'Sichtprüfung und Funktionstest aller Leitungsschutzschalter und FI-Schutzschalter. Kontrolle der Kabelquerschnitte, Klemmsitze und Beschriftung. Messung aller Erdungswiderstände, Schleifenimpedanzen und Isolationswiderstände. Auslösetest FI-Schalter. Übergabe eines vollständigen Prüfprotokolls nach DIN VDE 0105.'
    },
    {
        category: 'Elektro',
        beschreibung: 'Außenbeleuchtung installieren',
        einheit: 'Stk.',
        details: 'Montage und Verkabelung der Außenleuchten mit UV-beständigem Erdkabel (NYY-J) oder Fassadenkabel. Eigene Sicherungsgruppe mit FI-Schutzschalter, Schutzart mind. IP44. Einstellung von Dämmerungsschalter oder Bewegungsmelder auf die gewünschte Auslöseschwelle. Vollständiger Funktionstest.'
    },
    {
        category: 'Elektro',
        beschreibung: 'Rauchmelder / CO-Melder installieren',
        einheit: 'Stk.',
        details: 'Montage des Rauch- oder CO-Melders an der gesetzlich vorgeschriebenen Stelle (Decke, mind. 50 cm von Wänden entfernt). Befestigung mit Wanddübeln, Einlegen der Batterien, Funktionstest durch Auslöseprüfung. Dokumentation der Montageposition. Entspricht den Anforderungen der jeweiligen Landesbauordnung.'
    },

    // ── HYDRAULIK ────────────────────────────────────────────────────────
    {
        category: 'Hydraulik',
        beschreibung: 'Hydraulikanlage installieren',
        einheit: 'Pauschal',
        details: 'Vollständige Installation der Hydraulikanlage nach Schaltplan: Rohrleitungen, Fittings, Pumpe, Ventile, Steuerungskomponenten und alle Verbindungen. Befüllung mit dem vorgeschriebenen Hydrauliköl, Entlüftung des Systems, Einstellung aller Druckbegrenzungsventile, Leckageprüfung unter 1,3-fachem Betriebsdruck. Übergabe-Protokoll inkl. Einweisung.'
    },
    {
        category: 'Hydraulik',
        beschreibung: 'Hydrauliköl wechseln',
        einheit: 'Pauschal',
        details: 'Vollständiger Ölwechsel: Ablassen des alten Hydrauliköls bei Betriebstemperatur, Reinigung des Tanks und aller Filtergehäuse, Austausch sämtlicher Ölfilter (Saug-, Druck- und Rücklauffilter), Neubefüllung mit dem freigegebenen Hydrauliköl gemäß Herstellervorschrift, Entlüftung, Druckkontrolle. Fachgerechte Altöl-Entsorgung nach Abfallrecht. Wartungsaufkleber.'
    },
    {
        category: 'Hydraulik',
        beschreibung: 'Hydraulikpumpe austauschen',
        einheit: 'Stk.',
        details: 'Druckentlastung und Abschaltung der Anlage, Demontage der defekten Hydraulikpumpe. Reinigung aller Anschlüsse, Montage der Ersatzpumpe mit neuen Dichtungen, Wiederanschluss aller Leitungen und Elektrik. Ölverlust auffüllen, Einlaufphase unter Beobachtung (mind. 10 Min.), Drucktest auf Nennbetriebsdruck, Leckagekontrolle und Funktionsnachweis.'
    },
    {
        category: 'Hydraulik',
        beschreibung: 'Hydraulikzylinder instandsetzen',
        einheit: 'Stk.',
        details: 'Ausbau des Hydraulikzylinders aus der Anlage. Vollständige Zerlegung, Reinigung aller Metallbauteile, Kontrolle von Kolbenstange und Zylinderlaufbahn auf Verschleiß. Austausch des kompletten Dichtungssatzes und aller verschlissenen Teile durch Neuteile nach Herstellerspezifikation. Zusammenbau, Druckprüfung auf 1,5-fachen Betriebsdruck, Wiedereinbau und Funktionstest.'
    },
    {
        category: 'Hydraulik',
        beschreibung: 'Hydraulikschlauch wechseln',
        einheit: 'Stk.',
        details: 'Druckentlastung des betreffenden Leitungsabschnitts, Demontage des defekten Hydraulikschlauches. Montage des neuen Schlauches mit korrektem Typ (Druck, Temperatur, Medium), Anziehen aller Verschraubungen auf Anzugsmoment, Dichtheitsprüfung unter Betriebsdruck. Ölverlust auffüllen, Leckagekontrolle nach 10 Minuten Betrieb.'
    },
    {
        category: 'Hydraulik',
        beschreibung: 'Hydraulikventil prüfen und einstellen',
        einheit: 'Stk.',
        details: 'Prüfung des Druckbegrenzungsventils, Wegeventils oder Proportionalventils auf Funktion und Einstellwerte. Reinigung des Ventils und Kontrolle auf Verschleiß. Neueinstellung des Schaltdrucks oder der Schaltzeiten nach Maschinenparametern. Dichtigkeitsprüfung und Dokumentation der eingestellten Werte im Wartungsprotokoll.'
    },

    // ── MALER ────────────────────────────────────────────────────────────
    {
        category: 'Maler',
        beschreibung: 'Innenwände streichen',
        einheit: 'm²',
        details: 'Untergrundvorbereitung: Spachteln von Rissen und Unebenheiten, Schleifen und Grundierung. Sorgfältiges Abkleben aller Fenster, Türrahmen, Fußleisten und Böden. Vollflächiger Anstrich der Wände in 2 Arbeitsgängen mit hochwertiger Innenfarbe (Farbton nach Wunsch). Saubere Kantenführung. Entfernung aller Schutzabdeckungen nach Trocknung.'
    },
    {
        category: 'Maler',
        beschreibung: 'Decke streichen',
        einheit: 'm²',
        details: 'Untergrundvorbereitung (Grundierung oder Tiefengrund bei saugenden Untergründen), vollflächiger Anstrich der Decke in 2 Lagen mit geeigneter Deckenfarbe (weiß oder Farbton nach Absprache). Sorgfältiges Abkleben aller Übergänge zu Wänden und Lampenanschlüssen. Gleichmäßiger Auftrag ohne Rollspuren. Endreinigung nach Fertigstellung.'
    },
    {
        category: 'Maler',
        beschreibung: 'Tapezieren',
        einheit: 'm²',
        details: 'Untergrundvorbereitung: Entfernen alter Tapeten, Glätten von Unebenheiten, Grundierung. Anmischen des Tapezierkleister nach Herstellerangaben, sorgfältiges Ausrichten und Verkleben der Tapetenbahnen von oben nach unten ohne Luftblasen, mit exakten Stößen und sauberen Kantenabschlüssen. Reinigung aller Kleisterreste nach Fertigstellung.'
    },
    {
        category: 'Maler',
        beschreibung: 'Fassade / Außenwand streichen',
        einheit: 'm²',
        details: 'Reinigung der Fassade (Abwaschen, Hochdruckreiniger falls nötig), Ausbesserung von Rissen und beschädigten Putzstellen, Grundierung mit geeignetem Voranstrich. Vollflächiger Anstrich in 2 Lagen mit wetterfester Fassadenfarbe (diffusionsoffen). Silikonfreie Anschlüsse an Fenstern und Türen mit neuem Dichtungsband. Gerüst nicht enthalten.'
    },

    // ── FLIESEN ───────────────────────────────────────────────────────────
    {
        category: 'Fliesen',
        beschreibung: 'Bodenfliesen verlegen',
        einheit: 'm²',
        details: 'Untergrundprüfung auf Ebenheit (max. 3 mm / 2 m), Auftragen von Grundierung und Ausgleichsmasse. Auftrag des Fliesenklebers mit Zahnkelle, Verlegung der Fliesen nach Verlegeplan mit gleichmäßigen Fugenkreuzen. Schnitt- und Passfliesen passgenau anpassen. Nach Abbinden vollständige Verfugung und Oberflächenreinigung. Silikonfugen an allen Anschlüssen.'
    },
    {
        category: 'Fliesen',
        beschreibung: 'Wandfliesen verlegen (Bad / Küche)',
        einheit: 'm²',
        details: 'Untergrundprüfung und Auftragen von Feuchteschutz/-abdichtung im Nassbereich (Dusche, Badewanne). Verlegung der Wandfliesen von unten nach oben mit Gitterkreuzen für gleichmäßige Fugen. Passgenaue Bearbeitung um Armaturen, Steckdosen und Einbauten mit Fliesenschneider und Winkelschleifer. Verfugung, Silikonfugen an allen Innen- und Wandanschlüssen.'
    },
    {
        category: 'Fliesen',
        beschreibung: 'Fugensanierung / Silikonfugen erneuern',
        einheit: 'm²',
        details: 'Vollständiges Herausschleifen der alten, rissigen oder verschimmelten Fugen mit Fugenfräser. Gründliche Reinigung aller Fugenkanäle und Trocknung. Neuverfugung mit geeignetem Fugenmörtel (Sanitär-Epoxidfug oder klassischer Flexfug). Erneuerung aller Silikonfugen an Wand-Boden-Übergängen, Wannen und Becken. Fliesenreinigung inklusive.'
    },
    {
        category: 'Fliesen',
        beschreibung: 'Einzelne Fliesen reparieren / tauschen',
        einheit: 'Stk.',
        details: 'Vorsichtiges Herausnehmen der beschädigten Fliese(n) mit Meißel und Hammer ohne Beschädigung angrenzender Fliesen. Reinigung des Untergrunds, Auftrag von frischem Fliesenklebers, Einsetzen der Ersatzfliese in gleichem Format und Fugenabstand. Verfugung passend zum Bestand und Randsilikonfuge bei Nassbereich.'
    },

    // ── ALLGEMEIN ────────────────────────────────────────────────────────
    {
        category: 'Allgemein',
        beschreibung: 'Montage / Installation (allgemein)',
        einheit: 'Pauschal',
        details: 'Fachgerechte Montage und Installation gemäß den Vorgaben des Herstellers und den geltenden technischen Normen (DIN, VDE, DVGW je nach Gewerk). Kontrolle aller Befestigungen und Anschlüsse auf festen Sitz und Dichtigkeit. Vollständiger Funktionstest nach der Montage. Kurze Einweisung des Kunden und Übergabe einer Montagebestätigung.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Wartung / Jahresinspektion',
        einheit: 'Pauschal',
        details: 'Vollständige Inspektion und Wartung gemäß Herstellervorgaben und Wartungsplan: Sichtprüfung aller Bauteile auf Verschleiß und Beschädigungen, Reinigung von Schmutz und Ablagerungen, Schmierung oder Austausch von Verschleißteilen, Einstellung und Kalibrierung aller relevanten Parameter. Übergabe eines schriftlichen Wartungsberichts mit Empfehlungen.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Reparatur (nach Befund)',
        einheit: 'Pauschal',
        details: 'Systematische Fehlerdiagnose und Lokalisierung der Schadstelle. Demontage des beschädigten Bauteils und Einbau von Originalersatzteilen oder gleichwertigen Qualitätskomponenten. Prüfung aller angrenzenden Bauteile auf Folgeschäden. Vollständiger Funktionstest nach der Reparatur und Dokumentation der durchgeführten Maßnahmen mit Bauteilbezeichnung und Seriennummer.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Stundenlohn / Arbeitszeit',
        einheit: 'Std.',
        details: 'Arbeitsleistung vor Ort durch qualifizierten Fachmann. Beinhaltet alle anfallenden Handwerksleistungen entsprechend dem vor Ort festgestellten Bedarf. Benötigtes Verbrauchsmaterial (Dichtungen, Kleben, Silikonkartusche etc.) wird separat nach tatsächlichem Verbrauch berechnet. Abrechnung nach tatsächlichem Zeitaufwand in 15-Minuten-Takt.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Fahrtkosten / Anfahrt',
        einheit: 'Pauschal',
        details: 'Hin- und Rückfahrt zum Einsatzort mit Firmenfahrzeug inkl. Transport des benötigten Werkzeugs, Messgeräts und Materials. Berechnung nach tatsächlicher Entfernung (km-Pauschale) vom Betriebssitz. Bei mehreren Einsätzen am selben Tag wird die Anfahrt anteilig aufgeteilt.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Material / Ersatzteile',
        einheit: 'Stk.',
        details: 'Lieferung des benötigten Materials oder der Ersatzteile in Original- oder Erstausrüsterqualität. Alle Teile entsprechen den technischen Anforderungen und gesetzlichen Vorschriften (CE, DVGW, VDE je nach Bauteil). Lieferung direkt an die Einsatzstelle, Lagerung bis zum Einbau im Fahrzeug des Auftragnehmers.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Schutzmaßnahmen / Baustellensicherung',
        einheit: 'Pauschal',
        details: 'Einrichten und Absichern der Arbeitsstelle: Abkleben und Abdecken von Böden, Möbeln und angrenzenden Bauteilen zum Schutz vor Beschädigungen und Schmutz. Aufstellen von Warnschildern und Absperrungen bei Bedarf. Vollständige Reinigung und Wiederherstellung des Bereichs nach Abschluss der Arbeiten.'
    },
    {
        category: 'Allgemein',
        beschreibung: 'Entsorgung / Altmaterial-Abfuhr',
        einheit: 'Pauschal',
        details: 'Fachgerechte Entsorgung aller anfallenden Abfälle und Altmaterialien gemäß Kreislaufwirtschaftsgesetz. Trennung nach Materialarten (Metall, Kunststoff, Restmüll, Sondermüll). Transport zu einem zugelassenen Entsorgungsbetrieb. Kosten für Entsorgungsgebühren sind im Preis enthalten. Entsorgungsnachweis auf Anfrage.'
    },

    // ── FREYAI VISIONS – KI-BERATUNG ────────────────────────────────────
    {
        category: 'KI-Beratung',
        beschreibung: 'Erstgespräch & Betriebsanalyse',
        einheit: 'Pauschal',
        details: 'Kostenloses Erstgespräch (vor Ort oder per Video-Call, ca. 60–90 Min.) zur Aufnahme des aktuellen Betriebsstatus. Analyse der vorhandenen Prozesse, Werkzeuge und Schmerzpunkte (Excel-Chaos, Papierprozesse, Kommunikationsbrüche). Ergebnis: Kurze schriftliche Zusammenfassung mit konkretem Handlungspotenzial und einer ersten Orientierung zur passenden FreyAI-Lösung. Keine versteckten Kosten – Angebot folgt separat.'
    },
    {
        category: 'KI-Beratung',
        beschreibung: 'Digital-Audit (Detailanalyse & Lastenheft)',
        einheit: 'Pauschal',
        details: 'Tiefgehende Bestandsaufnahme aller digitalen und analogen Geschäftsprozesse: Angebots- und Rechnungsworkflow, Materiallager, Kundenkommunikation, Buchhaltungsvorbereitung und Datensicherung. Ergebnis: Detailliertes schriftliches Audit-Dokument mit Schwachstellen, Potenzial-Bewertung, empfohlener Lösung und Business-Case-Rechnung (ROI). Grundlage für den Implementierungsauftrag. Aufwand ca. 4–6 Stunden inkl. Vor-Ort-Termin.'
    },
    {
        category: 'KI-Beratung',
        beschreibung: 'Strategie-Session (laufende Beratung)',
        einheit: 'Std.',
        details: 'Individuelle Beratungseinheit zur strategischen Weiterentwicklung der digitalen Infrastruktur des Betriebs. Themen je nach Bedarf: Prozessoptimierung, neue Automatisierungen, Skalierbarkeit, Datenschutz (DSGVO), KI-Integration oder Systemerweiterungen. Ergebnis: Klare Handlungsempfehlung mit Priorisierung der nächsten Schritte. Protokoll der Session inklusive.'
    },

    // ── FREYAI VISIONS – KI-SETUP & IMPLEMENTIERUNG ──────────────────────
    {
        category: 'KI-Setup & Implementierung',
        beschreibung: 'FreyAI Starter-Setup (Grundpaket)',
        einheit: 'Pauschal',
        details: 'Vollständige Einrichtung des FreyAI Business-Systems für Einzel- und Kleinstbetriebe (bis 2 Nutzer). Enthalten: Konfiguration aller Basis-Module (Angebote, Rechnungen, Kundenverwaltung, Materialstamm), Eingabe der Stammdaten (Firmenlogo, Bankdaten, Steuernummer, Stundensätze, Standardtexte), Einrichtung des PDF-Generators mit Firmen-CI. Setup-Dauer: ca. 1–2 Werktage. Inkl. 60 Min. Einweisung vor Ort oder per Video.'
    },
    {
        category: 'KI-Setup & Implementierung',
        beschreibung: 'FreyAI Professional-Setup',
        einheit: 'Pauschal',
        details: 'Vollständige Implementierung der FreyAI Business-Suite für Betriebe bis 5 Nutzer. Enthalten: Alle Starter-Leistungen + E-Mail-Automatisierung (Angebote, Rechnungen, Mahnungen), KI-Chatbot-Einrichtung mit betriebsspezifischer Wissensbasis, Materialstamm-Import (Excel/CSV), individuelle Dokumentvorlagen (Angebot, Rechnung, Lieferschein) im Firmen-Design, Einrichtung automatisierter Workflows. Setup-Dauer: ca. 3–5 Werktage. Inkl. Schulung (2 Stunden) und 30 Tage Priority-Support.'
    },
    {
        category: 'KI-Setup & Implementierung',
        beschreibung: 'FreyAI Enterprise-Setup (Full-Service)',
        einheit: 'Pauschal',
        details: 'Premium-Implementierung der kompletten FreyAI-Infrastruktur für wachsende Betriebe (5+ Nutzer). Enthalten: Alle Professional-Leistungen + Supabase-Datenbank-Einrichtung mit verschlüsselter Cloud-Synchronisation, Custom-Integrationen (Buchhaltungssoftware, DATEV-Export-Vorbereitung, Banktransaktions-CSV-Import), vollständige DSGVO-Dokumentation, individuell entwickelte Zusatzfunktionen nach Betriebsbedarf. Projektzeitraum: 2–4 Wochen. Inkl. umfangreicher Schulung, Dokumentation und 90 Tage Premium-Support.'
    },
    {
        category: 'KI-Setup & Implementierung',
        beschreibung: 'Datenmigration (Excel / Papier → FreyAI)',
        einheit: 'Std.',
        details: 'Strukturierte Überführung vorhandener Betriebsdaten in das FreyAI-System: Import von Kundendaten, Materialstamm, offenen Angeboten und Rechnungen aus Excel-Tabellen, Word-Dokumenten oder Papierlisten. Inkl. Datenbereinigung, Duplikat-Prüfung und Validierung. Abrechnung nach tatsächlichem Aufwand, Schätzung vorab. Übergabe mit vollständiger Datenprüfung und Abnahmebestätigung.'
    },
    {
        category: 'KI-Setup & Implementierung',
        beschreibung: 'Custom Feature / Sonderentwicklung',
        einheit: 'Std.',
        details: 'Individuelle Softwareentwicklung einer betriebsspezifischen Zusatzfunktion, die über den Standard-Funktionsumfang hinausgeht. Beispiele: branchenspezifische Kalkulationsmodule, Schnittstellen zu Drittsystemen, individuelle Berichts-Dashboards, automatisierte Sonderdokumente. Leistungsumfang wird vorab im Technischen Pflichtenheft definiert und festgepreist oder nach Aufwand abgerechnet. Abnahme nach Fertigstellung und Test.'
    },

    // ── FREYAI VISIONS – KI-AUTOMATISIERUNG ─────────────────────────────
    {
        category: 'KI-Automatisierung',
        beschreibung: 'KI-Chatbot (Kundenkommunkation automatisieren)',
        einheit: 'Pauschal',
        details: 'Einrichtung und Anpassung des KI-gestützten Kundenkommunikations-Assistenten: Befüllung der betriebsspezifischen Wissensbasis (Preise, Leistungen, Öffnungszeiten, FAQ), Training auf häufige Kundenanfragen, Einstellung von Geschäftszeiten und automatischen Antwortzeiten. Der Chatbot beantwortet Standardanfragen rund um die Uhr, qualifiziert Leads und kann Angebote vorbereiten. Inklusive 1 Monat Feinabstimmung nach Live-Gang.'
    },
    {
        category: 'KI-Automatisierung',
        beschreibung: 'E-Mail-Automatisierung (Angebote, Rechnungen, Mahnungen)',
        einheit: 'Pauschal',
        details: 'Vollständige Einrichtung der automatisierten E-Mail-Strecken: Professionelle HTML-E-Mail-Vorlagen im Firmen-Design für Angebots-Versand, Auftragsbestätigung, Rechnungs-Versand mit PDF-Anhang, Zahlungserinnerung (1. Mahnstufe sanft, 2. Mahnstufe förmlich, 3. Mahnstufe mit Verzugszins-Berechnung). Alle Texte werden individuell auf den Betrieb abgestimmt. Automatischer Versand über hinterlegte SMTP-Zugangsdaten (kein Cloud-Zwang).'
    },
    {
        category: 'KI-Automatisierung',
        beschreibung: 'Angebots-KI (automatische Positionsvorschläge)',
        einheit: 'Pauschal',
        details: 'Konfiguration des KI-gestützten Angebotssystems: Einrichtung der betriebsspezifischen Leistungsvorlagen (Leistungsbeschreibungen, Einheiten, Richtwerte), Integration der Materialpreisliste für automatische Positionsvorschläge, KI-Textgenerierung für Angebotsbeschreibungen. Das System schlägt passende Positionen vor, sobald ein Leistungstyp eingegeben wird – drastische Reduktion der manuellen Angebotserstellungszeit (Ziel: < 5 Minuten pro Angebot).'
    },
    {
        category: 'KI-Automatisierung',
        beschreibung: 'Buchhaltungsvorbereitung & GOBD-Export',
        einheit: 'Pauschal',
        details: 'Einrichtung der automatisierten GoBD-konformen Buchhaltungsvorbereitung: Konfiguration des CSV-Exports für DATEV oder Steuerberater, automatische Kategorisierung von Einnahmen und Ausgaben nach Kontenrahmen SKR03/SKR04, Prüfung auf Vollständigkeit und Plausibilität vor Export. Inkl. monatliche Export-Automatisierung auf freigegebenen Cloud-Speicher. Reduziert den Zeitaufwand für den Steuerberater und damit die Steuerberatungskosten.'
    },
    {
        category: 'KI-Automatisierung',
        beschreibung: 'Mahnwesen-Automatisierung (vollständig)',
        einheit: 'Pauschal',
        details: 'Komplette Einrichtung der automatisierten Mahnprozess-Kette: Überwachung aller offenen Posten, automatische Fälligkeitsprüfung täglich, gestufter Mahnversand (sanfte Erinnerung nach 3 Tagen Überfälligkeit, formale Mahnung nach 14 Tagen mit Verzugszinsberechnung §288 BGB, Letztmahnung nach 30 Tagen). Vollständige Protokollierung aller Mahnvorgänge. Opt-out für Stammkunden möglich. Durchschnittliche Zahlungsziel-Reduzierung: -12 Tage.'
    },
    {
        category: 'KI-Automatisierung',
        beschreibung: 'Lager & Materialstamm-Automatisierung',
        einheit: 'Pauschal',
        details: 'Einrichtung der automatisierten Lagerverwaltung: Konfiguration von Mindestbeständen und automatischer Warnmeldung bei Unterschreitung, automatische Preisaktualisierung beim Materialimport, Zuordnung von Lieferanten-Artikelnummern zu internen Materialstammsätzen. Optional: automatische Bestelllisten-Generierung bei Mindestbestand-Unterschreitung. Inkl. Einrichtung der Lieferanten-Stammdaten.'
    },

    // ── FREYAI VISIONS – SCHULUNG & SUPPORT ─────────────────────────────
    {
        category: 'Schulung & Support',
        beschreibung: 'Einweisung & Schulung vor Ort',
        einheit: 'Std.',
        details: 'Persönliche Schulungseinheit direkt im Betrieb. Praxisorientierte Einführung in alle relevanten Module des FreyAI-Systems: Angebote erstellen, Rechnungen stellen, Kundenverwaltung, Materialwirtschaft und Auswertungen. Inkl. Übungsbeispiele mit echten Betriebsdaten, Q&A-Runde und schriftlichem Kurzleitfaden zum Mitnehmen (2–4 Seiten DIN A4). Empfehlung: 2 Stunden für Grundschulung, 1 Stunde Aufbaumodul.'
    },
    {
        category: 'Schulung & Support',
        beschreibung: 'Online-Schulung (Video-Call)',
        einheit: 'Std.',
        details: 'Geführte Schulungseinheit per Video-Call (Zoom, Teams oder Google Meet). Inkl. Screen-Sharing und Live-Demonstration aller Funktionen. Aufzeichnung der Session auf Wunsch als MP4 zur späteren Nutzung verfügbar. Flexibler Terminvorschlag innerhalb von 3 Werktagen. Ideal für Auffrischungen, neue Mitarbeiter-Einweisung oder Einführung neuer Module. Dauer: 30–90 Minuten je Themenblock.'
    },
    {
        category: 'Schulung & Support',
        beschreibung: 'Individuelles Benutzerhandbuch',
        einheit: 'Pauschal',
        details: 'Erstellung eines maßgeschneiderten Benutzerhandbuchs für das FreyAI-System im Betrieb. Inhalt: bebilderte Schritt-für-Schritt-Anleitungen für alle im Betrieb genutzten Funktionen, häufige Fehlerquellen und Lösungen, Kontaktinformationen für Support. Format: digitales PDF (inkl. Lesezeichen und Suchfunktion) + optional Druck-Version. Lieferzeit: 5 Werktage nach Abnahme der Konfiguration.'
    },
    {
        category: 'Schulung & Support',
        beschreibung: 'Priority-Support (Incident)',
        einheit: 'Std.',
        details: 'Sofort-Hilfe bei dringendem technischen Problem außerhalb des regulären Retainers. Reaktionszeit: < 2 Stunden (Werktage 08:00–18:00 Uhr). Diagnose, Ursachenanalyse und Lösung des Problems per Remote-Zugriff oder Telefon. Abrechnung nach tatsächlichem Aufwand in 15-Minuten-Takt. Inkl. kurzer schriftlicher Zusammenfassung (Incident Report) des Problems und der durchgeführten Maßnahmen.'
    },

    // ── FREYAI VISIONS – MONATLICHER RETAINER ───────────────────────────
    {
        category: 'Monatlicher Retainer',
        beschreibung: 'FreyAI Basis-Retainer',
        einheit: 'Monat',
        details: 'Monatlicher Basis-Wartungs- und Betreuungsvertrag (Mindestlaufzeit 12 Monate). Enthalten: Software-Updates und Sicherheits-Patches, E-Mail-Support mit Reaktionszeit < 24 Stunden (Werktage), monatliches Status-Update mit Systemstatus und Empfehlungen, Datensicherung auf deutschem Server (Hetzner/Supabase EU). Nicht enthalten: Neu-Konfigurationen, Custom Features, Schulungen (werden gesondert berechnet).'
    },
    {
        category: 'Monatlicher Retainer',
        beschreibung: 'FreyAI Professional-Retainer',
        einheit: 'Monat',
        details: 'Umfassender monatlicher Betreuungsvertrag für professionelle Betriebe (Mindestlaufzeit 12 Monate). Enthalten: Alle Basis-Leistungen + Telefon-Support (Reaktionszeit < 4 Stunden, Werktage), monatliches Optimierungsgespräch (30 Min. Video-Call), Anpassung von E-Mail-Texten und Dokumentvorlagen, 1 Schulungsstunde/Monat, Monitoring der Automatisierungen mit Fehler-Alarm, proaktive Empfehlungen zur Prozessverbesserung. Kein Aufpreis für Minor-Anpassungen.'
    },
    {
        category: 'Monatlicher Retainer',
        beschreibung: 'FreyAI Premium-Retainer (Full-Service)',
        einheit: 'Monat',
        details: 'Full-Service-Betreuungspaket – das System läuft, Sie arbeiten (Mindestlaufzeit 12 Monate). Enthalten: Alle Professional-Leistungen + Priority-Hotline (Reaktionszeit < 2 Stunden inkl. Mo–Sa), bis zu 3 Stunden Custom-Entwicklung/Monat rollierend, quartalsweise Strategy-Session (1 Std.), vollständiges Monitoring mit automatischem Failover, DSGVO-Compliance-Check halbjährlich, direkter Draht zu Jonas Frey (Entwickler). Für Betriebe, die auf das System angewiesen sind.'
    }
];

function createAngebotFromAnfrage(anfrageId) {
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) {return;}

    // Clear any previous editing state
    store.editingAngebotId = null;

    // Reset modal title to create mode
    const modalTitle = document.getElementById('modal-angebot-title');
    if (modalTitle) {
        modalTitle.textContent = 'Angebot erstellen';
    }

    store.currentAnfrageId = anfrageId;

    // Fill modal info
    const anfrageIdEl = document.getElementById('angebot-anfrage-id');
    if (anfrageIdEl) {anfrageIdEl.value = anfrageId;}
    const kundeInfoEl = document.getElementById('angebot-kunde-info');
    if (kundeInfoEl) {
        kundeInfoEl.innerHTML = `
            <strong>${window.UI.sanitize(anfrage.kunde?.name || 'Unbekannt')}</strong><br>
            ${getLeistungsartLabel(anfrage.leistungsart)}<br>
            <small>${window.UI.sanitize((anfrage.beschreibung || '').substring(0, 100))}...</small>
        `;
    }

    // Clear positions
    const posListEl = document.getElementById('positionen-list');
    if (posListEl) {posListEl.innerHTML = '';}
    addPosition();

    // Clear text
    const angebotTextEl = document.getElementById('angebot-text');
    if (angebotTextEl) {angebotTextEl.value = '';}

    openModal('modal-angebot');
}

function initAngebotForm() {
    const form = document.getElementById('form-angebot');
    if (!form) {return;}
    const addBtn = document.getElementById('btn-add-position');
    const aiBtn = document.getElementById('btn-ai-text');

    if (addBtn) {addBtn.addEventListener('click', addPosition);}
    if (aiBtn) {aiBtn.addEventListener('click', generateAIText);}

    // Preset: Load saved template
    const loadPresetBtn = document.getElementById('btn-load-preset');
    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            const select = document.getElementById('customer-preset');
            const presetId = select?.value;
            if (!presetId) {
                showToast('Bitte zuerst eine Vorlage auswählen', 'warning');
                return;
            }
            const presets = JSON.parse(localStorage.getItem('angebot_presets') || '[]');
            const preset = presets.find(p => p.id === presetId);
            if (!preset) {
                showToast('Vorlage nicht gefunden', 'error');
                return;
            }
            // Clear existing positions
            const positionenList = document.getElementById('positionen-list');
            if (positionenList) {positionenList.innerHTML = '';}
            // Re-add positions from preset
            (preset.positionen || []).forEach(pos => {
                addPosition();
                const rows = document.querySelectorAll('.position-row');
                const lastRow = rows[rows.length - 1];
                if (!lastRow) {return;}
                const desc = lastRow.querySelector('.pos-beschreibung');
                if (desc) {desc.value = pos.beschreibung || '';}
                const menge = lastRow.querySelector('.pos-menge');
                if (menge) {menge.value = pos.menge || 1;}
                const einheit = lastRow.querySelector('.pos-einheit');
                if (einheit) {einheit.value = pos.einheit || 'Stk';}
                const preis = lastRow.querySelector('.pos-preis');
                if (preis) {preis.value = pos.preis || 0;}
                const details = lastRow.querySelector('.pos-details');
                if (details) {details.value = pos.details || '';}
            });
            updateAngebotSummary();
            showToast(`Vorlage "${preset.name}" geladen`, 'success');
        });
    }

    // Preset: Save current positions as template
    const savePresetBtn = document.getElementById('btn-save-preset');
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', () => {
            const positionen = [];
            document.querySelectorAll('.position-row').forEach(row => {
                const beschreibung = row.querySelector('.pos-beschreibung')?.value || '';
                const menge = parseFloat(row.querySelector('.pos-menge')?.value) || 1;
                const einheit = row.querySelector('.pos-einheit')?.value || 'Stk';
                const preis = parseFloat(row.querySelector('.pos-preis')?.value) || 0;
                const details = row.querySelector('.pos-details')?.value || '';
                if (beschreibung) {positionen.push({ beschreibung, menge, einheit, preis, details });}
            });
            if (positionen.length === 0) {
                showToast('Keine Positionen zum Speichern vorhanden', 'warning');
                return;
            }
            const name = prompt('Name der Vorlage:');
            if (!name || !name.trim()) {return;}
            const presets = JSON.parse(localStorage.getItem('angebot_presets') || '[]');
            const preset = { id: 'preset-' + Date.now(), name: name.trim(), positionen, createdAt: new Date().toISOString() };
            presets.push(preset);
            localStorage.setItem('angebot_presets', JSON.stringify(presets));
            // Update select dropdown
            const select = document.getElementById('customer-preset');
            if (select) {
                const opt = document.createElement('option');
                opt.value = preset.id;
                opt.textContent = preset.name;
                select.appendChild(opt);
                select.value = preset.id;
            }
            showToast(`Vorlage "${preset.name}" gespeichert`, 'success');
        });
    }

    // Add position from material inventory
    const addFromMaterialBtn = document.getElementById('btn-add-from-material');
    if (addFromMaterialBtn) {
        addFromMaterialBtn.addEventListener('click', () => {
            if (!window.materialService) {
                showToast('Material-Service nicht verfügbar', 'warning');
                return;
            }
            const materials = window.materialService.getAllMaterials();
            if (!materials || materials.length === 0) {
                showToast('Kein Material im Bestand vorhanden', 'info');
                return;
            }
            // Build a simple picker overlay
            const existing = document.getElementById('material-picker-overlay');
            if (existing) {existing.remove();}
            const overlay = document.createElement('div');
            overlay.id = 'material-picker-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
            overlay.innerHTML = `
                <div style="background:var(--bg-card,#18181b);border-radius:16px;padding:24px;max-width:520px;width:90%;max-height:70vh;overflow-y:auto;color:var(--text,#fafafa);">
                    <h3 style="margin:0 0 16px;">Material aus Bestand wählen</h3>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        ${materials.map(m => `
                            <button type="button" class="btn btn-secondary" data-mat-id="${h(m.id)}" style="text-align:left;padding:10px 14px;">
                                <strong>${h(m.bezeichnung || m.name)}</strong>
                                <span style="color:#9ca3af;margin-left:8px;">${h(m.artikelnummer || '')} — ${m.bestand || 0} ${h(m.einheit || 'Stk')} — ${formatCurrency(m.preis || 0)}</span>
                            </button>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-secondary" style="margin-top:16px;width:100%;" id="material-picker-close">Abbrechen</button>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector('#material-picker-close').addEventListener('click', () => overlay.remove());
            overlay.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-mat-id]');
                if (!btn) {return;}
                const mat = materials.find(m => m.id === btn.dataset.matId);
                if (!mat) {return;}
                addPosition();
                const rows = document.querySelectorAll('.position-row');
                const lastRow = rows[rows.length - 1];
                if (lastRow) {
                    const desc = lastRow.querySelector('.pos-beschreibung');
                    if (desc) {
                        desc.value = mat.bezeichnung || mat.name || '';
                        desc.dataset.materialId = mat.id;
                    }
                    const einheit = lastRow.querySelector('.pos-einheit');
                    if (einheit) {einheit.value = mat.einheit || 'Stk';}
                    const preis = lastRow.querySelector('.pos-preis');
                    if (preis) {preis.value = mat.preis || 0;}
                    const menge = lastRow.querySelector('.pos-menge');
                    if (menge) {menge.value = 1;}
                }
                updateAngebotSummary();
                overlay.remove();
                showToast(`"${mat.bezeichnung || mat.name}" hinzugefügt`, 'success');
            });
        });
    }

    // Load saved presets into dropdown on init
    try {
        const presets = JSON.parse(localStorage.getItem('angebot_presets') || '[]');
        const select = document.getElementById('customer-preset');
        if (select && presets.length > 0) {
            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });
        }
    } catch (_e) { /* ignore parse errors */ }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const anfrageId = document.getElementById('angebot-anfrage-id')?.value;
        const anfrage = store.anfragen.find(a => a.id === anfrageId);

        const positionen = [];
        document.querySelectorAll('.position-row').forEach(row => {
            const beschreibungInput = row.querySelector('.pos-beschreibung');
            const beschreibung = beschreibungInput.value;
            const menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
            const einheit = row.querySelector('.pos-einheit').value;
            const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;
            const materialId = beschreibungInput.dataset.materialId || null;

            const details = row.querySelector('.pos-details')?.value?.trim() || '';
            const verantwortlich = row.querySelector('.pos-verantwortlich')?.value?.trim() || '';

            if (beschreibung && menge && preis) {
                const position = { beschreibung, menge, einheit, preis, details, verantwortlich };

                // Add material-specific fields
                if (materialId) {
                    const material = window.materialService?.getMaterial(materialId);
                    if (material) {
                        position.materialId = materialId;
                        position.ekPreis = material.preis;
                        position.bestandVerfuegbar = material.bestand;
                        position.artikelnummer = material.artikelnummer;
                    }
                }

                positionen.push(position);
            }
        });

        // Validate: at least one position required
        if (positionen.length === 0) {
            if (window.showToast) {window.showToast('Mindestens eine Position mit Beschreibung, Menge und Preis erforderlich', 'warning');}
            return;
        }

        const netto = positionen.reduce((sum, p) => sum + (p.menge * p.preis), 0);
        if (netto <= 0) {
            if (window.showToast) {window.showToast('Angebotssumme muss größer als 0 sein', 'warning');}
            return;
        }

        const taxRate = (typeof window._getTaxRate === 'function') ? window._getTaxRate() : 0.19;
        const mwst = netto * taxRate;
        const brutto = netto + mwst;

        // Check if we are editing an existing Angebot
        if (store.editingAngebotId) {
            const existing = store.angebote.find(a => a.id === store.editingAngebotId);
            if (existing) {
                existing.positionen = positionen;
                existing.text = document.getElementById('angebot-text')?.value || '';
                existing.netto = netto;
                existing.mwst = mwst;
                existing.brutto = brutto;
                existing.updatedAt = new Date().toISOString();

                saveStore();
                addActivity('✏️', `Angebot ${existing.id} für ${existing.kunde?.name || 'Unbekannt'} aktualisiert`);
                showToast('Angebot erfolgreich aktualisiert', 'success');
            }

            // Clear edit flag
            store.editingAngebotId = null;
        } else {
            // Create new Angebot
            const angebot = {
                id: generateId('ANG'),
                anfrageId,
                kunde: anfrage.kunde,
                leistungsart: anfrage.leistungsart,
                positionen,
                text: document.getElementById('angebot-text')?.value || '',
                netto,
                mwst,
                brutto,
                status: 'entwurf',
                createdAt: new Date().toISOString()
            };

            store.angebote.push(angebot);

            // Update Anfrage status
            anfrage.status = 'angebot-erstellt';

            saveStore();
            addActivity('📝', `Angebot ${angebot.id} für ${anfrage.kunde?.name || 'Unbekannt'} erstellt`);
            showToast('Angebot erfolgreich erstellt — vorläufige Version wird versendet…', 'success');

            // Auto-send preliminary quote in background (non-blocking)
            sendVorlaeufigAngebot(angebot, anfrage).catch(err =>
                console.warn('[Angebote] Vorläufiger Versand fehlgeschlagen:', err)
            );
        }

        // Reset modal title back to create mode
        const modalTitle = document.getElementById('modal-angebot-title');
        if (modalTitle) {
            modalTitle.textContent = 'Angebot erstellen';
        }

        closeModal('modal-angebot');
        switchView('angebote');
        document.querySelector('[data-view="angebote"]')?.click();
    });
}

// ============================================
// Template Picker for Position Descriptions
// ============================================

function showPositionTemplatePicker(row) {
    // Toggle: close if already open for this row
    const existing = document.getElementById('position-template-picker-overlay');
    if (existing) { existing.remove(); document.body.style.overflow = ''; return; }

    let currentFiltered = [...POSITION_TEMPLATES];

    const getFiltered = (query) => {
        if (!query || !query.trim()) { return [...POSITION_TEMPLATES]; }
        const q = query.toLowerCase().trim();
        return POSITION_TEMPLATES.filter(t =>
            t.beschreibung.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.details.toLowerCase().includes(q)
        );
    };

    const applyTemplate = (template) => {
        const descInput   = row.querySelector('.pos-beschreibung');
        const einheitInput = row.querySelector('.pos-einheit');
        const detailsTA   = row.querySelector('.pos-details');

        if (descInput) {
            descInput.value = template.beschreibung;
            descInput.dataset.materialId = '';
            // Reset material info label
            const mInfo = row.querySelector('.position-material-info');
            if (mInfo) { mInfo.textContent = 'Kein Material zugewiesen'; }
        }
        if (einheitInput && template.einheit) { einheitInput.value = template.einheit; }
        if (detailsTA && template.details)    { detailsTA.value = template.details; }
        // verantwortlich intentionally NOT set — solo business, not needed

        overlay.remove();
        document.body.style.overflow = '';
        updateAngebotSummary();
    };

    const renderList = (templates) => {
        if (templates.length === 0) {
            return '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">Keine Vorlagen gefunden – anderen Suchbegriff versuchen</div>';
        }
        // Group by category while tracking the flat index in `templates`
        const groups = {};
        templates.forEach((t, flatIdx) => {
            if (!groups[t.category]) { groups[t.category] = []; }
            groups[t.category].push({ t, flatIdx });
        });

        return Object.entries(groups).map(([cat, items]) => `
            <div style="padding:7px 16px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top:1px solid #e5e7eb;">${h(cat)}</div>
            ${items.map(({ t, flatIdx }) => `
                <div class="tpl-item" data-idx="${flatIdx}"
                     style="padding:11px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:background .12s;">
                    <div style="font-weight:600;font-size:13px;color:#1f2937;margin-bottom:3px;">${h(t.beschreibung)}</div>
                    <div style="font-size:11px;color:#6b7280;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${h(t.details.substring(0, 160))}…</div>
                    <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Einheit: ${h(t.einheit || '—')}</div>
                </div>
            `).join('')}
        `).join('');
    };

    const overlay = document.createElement('div');
    overlay.id = 'position-template-picker-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
        <div id="tpl-modal"
             style="background:#fff;border-radius:12px;max-width:680px;width:100%;max-height:84vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.3);">
            <div style="padding:18px 20px 14px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3 style="margin:0;font-size:15px;color:#1f2937;font-weight:700;">📋 Leistungsvorlage wählen</h3>
                    <button id="tpl-close" type="button" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;line-height:1;padding:0 2px;" title="Schließen">✕</button>
                </div>
                <input id="tpl-search" type="text"
                       placeholder="🔍  Suchen … z.B. Heizung, WC, Reparatur, Fliesen, Kabel"
                       style="width:100%;padding:9px 13px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;color:#374151;">
            </div>
            <div id="tpl-list" style="overflow-y:auto;flex:1;">${renderList(currentFiltered)}</div>
            <div style="padding:10px 20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;flex-shrink:0;">
                Klicken Sie auf eine Vorlage – Beschreibung und Details können danach noch angepasst werden.
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const listEl   = overlay.querySelector('#tpl-list');
    const searchEl = overlay.querySelector('#tpl-search');

    // Use event delegation to avoid listener leaks on re-render
    listEl.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.tpl-item');
        if (item) { item.style.background = '#f5f3ff'; }
    });
    listEl.addEventListener('mouseout', (e) => {
        const item = e.target.closest('.tpl-item');
        if (item) { item.style.background = ''; }
    });
    listEl.addEventListener('click', (e) => {
        const item = e.target.closest('.tpl-item');
        if (item) { applyTemplate(currentFiltered[parseInt(item.dataset.idx, 10)]); }
    });
    searchEl.focus();

    searchEl.addEventListener('input', () => {
        currentFiltered = getFiltered(searchEl.value);
        listEl.innerHTML = renderList(currentFiltered);
    });

    const close = () => { overlay.remove(); document.body.style.overflow = ''; };
    overlay.querySelector('#tpl-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { close(); } });
}

function addPosition(prefill = null) {
    const container = document.getElementById('positionen-list');
    if (!container) {return;}
    const row = document.createElement('div');
    row.className = 'position-row';

    const uniqueId = Date.now();

    // Prepare material display info
    let materialDisplay = 'Kein Material zugewiesen';
    if (prefill?.materialId) {
        const material = window.materialService?.getMaterial(prefill.materialId);
        if (material) {
            materialDisplay = `${(window.UI?.sanitize || String)(material.bezeichnung)} (${(window.UI?.sanitize || String)(material.artikelnummer)})`;
        }
    }

    row.innerHTML = `
        <div class="pos-beschreibung-wrapper">
            <input type="text" class="pos-beschreibung" placeholder="Beschreibung tippen..."
                   data-suggest-id="${uniqueId}"
                   data-material-id="${prefill?.materialId || ''}"
                   value="${(window.esc || String)(prefill?.beschreibung || '')}"
                   autocomplete="off">
            <div class="material-suggest" id="suggest-${uniqueId}" style="display:none;"></div>
        </div>
        <input type="number" class="pos-menge" placeholder="Menge" step="0.5" value="${prefill?.menge || 1}" data-action="update-summary">
        <input type="text" class="pos-einheit" placeholder="Einheit" value="${(window.esc || String)(prefill?.einheit || 'Stk.')}">
        <input type="number" class="pos-preis" placeholder="€/Einheit" step="0.01" value="${prefill?.preis || ''}" data-action="update-summary">
        <div class="position-material-selector">
            <button type="button" class="btn btn-small position-material-picker" data-position-id="${uniqueId}">📦 Material</button>
            <span class="position-material-info" data-position-id="${uniqueId}">${materialDisplay}</span>
            ${prefill?.materialId ? `<button type="button" class="position-material-clear" data-position-id="${uniqueId}">✕</button>` : ''}
        </div>
        <button type="button" class="position-remove" data-action="remove-position">×</button>
        <div class="position-extra-details" style="flex:0 0 100%;width:100%;grid-column:1/-1;padding:10px 4px 6px;margin-top:6px;border-top:1px dashed #d1d5db;display:grid;grid-template-columns:3fr 1fr;gap:10px;align-items:start;">
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <label style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Leistungsbeschreibung <span style="color:#c8956c;">(Vorlage nutzen – mehr Details = mehr Vertrauen)</span></label>
                    <button type="button" class="btn-vorlage" style="font-size:11px;color:#c8956c;background:none;border:1px solid #c8956c;border-radius:4px;padding:3px 9px;cursor:pointer;white-space:nowrap;flex-shrink:0;margin-left:8px;">📋 Vorlage</button>
                </div>
                <textarea class="pos-details" rows="2" placeholder="Was genau wird gemacht? Was ist im Preis enthalten? Nutzen Sie den Button 'Vorlage' für fertige Texte – oder schreiben Sie frei. Z.B.: Vollständige Demontage der alten Anlage, fachgerechte Neuinstallation inkl. Dichtheitsprüfung, Spülung aller Leitungen und Übergabe-Protokoll." style="width:100%;resize:vertical;font-size:12px;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;box-sizing:border-box;color:#374151;line-height:1.5;">${(window.esc || String)(prefill?.details || '')}</textarea>
            </div>
            <div>
                <label style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">Ausführung (optional)</label>
                <input type="text" class="pos-verantwortlich" placeholder="z.B. Fachbetrieb, Inhaber" value="${(window.esc || String)(prefill?.verantwortlich || '')}" style="width:100%;font-size:12px;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;color:#374151;">
            </div>
        </div>
    `;
    container.appendChild(row);

    // Setup material picker button
    const pickerBtn = row.querySelector('.position-material-picker');
    const materialInfo = row.querySelector('.position-material-info');
    const clearBtn = row.querySelector('.position-material-clear');
    const input = row.querySelector('.pos-beschreibung');
    const suggestBox = row.querySelector('.material-suggest');

    if (pickerBtn) {
        pickerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.materialPickerUI?.open((material) => {
                // Update position with material data
                input.value = material.bezeichnung;
                input.dataset.materialId = material.id;
                row.querySelector('.pos-preis').value = material.vkPreis || material.preis;
                row.querySelector('.pos-einheit').value = material.einheit;

                // Update material info display
                materialInfo.textContent = `${material.bezeichnung} (${material.artikelnummer})`;

                // Show clear button
                if (!row.querySelector('.position-material-clear')) {
                    const newClearBtn = document.createElement('button');
                    newClearBtn.type = 'button';
                    newClearBtn.className = 'position-material-clear';
                    newClearBtn.dataset.positionId = uniqueId;
                    newClearBtn.textContent = '✕';
                    newClearBtn.addEventListener('click', clearMaterialSelection);
                    pickerBtn.parentElement.appendChild(newClearBtn);
                }

                updateAngebotSummary();
            });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearMaterialSelection);
    }

    function clearMaterialSelection() {
        input.dataset.materialId = '';
        materialInfo.textContent = 'Kein Material zugewiesen';
        clearBtn?.remove?.();
        updateAngebotSummary();
    }

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            suggestBox.style.display = 'none';
            return;
        }

        const materials = window.materialService?.searchMaterials(query) || [];
        if (materials.length === 0) {
            suggestBox.style.display = 'none';
            return;
        }

        suggestBox.innerHTML = materials.slice(0, 5).map(m => `
            <div class="material-suggest-item" data-material="${encodeURIComponent(JSON.stringify(m))}">
                <span class="material-suggest-name">${h(m.bezeichnung)}</span>
                <span class="material-suggest-meta">
                    <span class="price">${formatCurrency(m.vkPreis || m.preis)}</span>
                    <span class="stock">${m.bestand} ${h(m.einheit)}</span>
                </span>
            </div>
        `).join('');
        suggestBox.style.display = 'block';
    });

    // Handle selection via event delegation (single listener, no re-binding)
    suggestBox.addEventListener('click', (e) => {
        const item = e.target.closest('.material-suggest-item');
        if (!item) {return;}
        let material; try { material = JSON.parse(decodeURIComponent(item.dataset.material)); } catch { console.error('[Angebote] Failed to parse material data'); return; }
        row.querySelector('.pos-beschreibung').value = material.bezeichnung;
        row.querySelector('.pos-preis').value = material.vkPreis || material.preis;
        row.querySelector('.pos-einheit').value = material.einheit;
        suggestBox.style.display = 'none';
        updateAngebotSummary();
    });

    // Hide on blur (with delay for click)
    input.addEventListener('blur', () => {
        setTimeout(() => suggestBox.style.display = 'none', 200);
    });

    // Vorlage (template picker) button
    const vorlageBtn = row.querySelector('.btn-vorlage');
    if (vorlageBtn) {
        vorlageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPositionTemplatePicker(row);
        });
    }

    updateAngebotSummary();
}

function updateAngebotSummary() {
    let netto = 0;
    document.querySelectorAll('.position-row').forEach(row => {
        const menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
        const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;
        netto += menge * preis;
    });

    const taxRate = (typeof window._getTaxRate === 'function') ? window._getTaxRate() : 0.19;
    const mwst = netto * taxRate;
    const brutto = netto + mwst;

    const nettoEl = document.getElementById('angebot-netto');
    const mwstEl = document.getElementById('angebot-mwst');
    const bruttoEl = document.getElementById('angebot-brutto');
    if (nettoEl) {nettoEl.textContent = formatCurrency(netto);}
    if (mwstEl) {mwstEl.textContent = formatCurrency(mwst);}
    if (bruttoEl) {bruttoEl.textContent = formatCurrency(brutto);}
}

function generateAIText() {
    const anfrageId = document.getElementById('angebot-anfrage-id')?.value;
    const anfrage = store.anfragen.find(a => a.id === anfrageId);
    if (!anfrage) {return;}

    // Simulate AI text generation
    const aiBtn = document.getElementById('btn-ai-text');
    aiBtn.textContent = '⏳ Generiere...';
    aiBtn.disabled = true;

    // Add timeout safety for AI generation
    const aiTimeout = setTimeout(() => {
        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
        if (window.showToast) {showToast('KI-Generierung abgebrochen (Timeout)', 'warning');}
    }, 30000);

    setTimeout(() => {
        clearTimeout(aiTimeout);
        const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'angebote' });
        const companyName = ap.company_name || window.storeService?.state?.settings?.companyName || '';
        const signoff = companyName ? `\nMit freundlichen Grüßen\n${companyName}` : '\nMit freundlichen Grüßen';

        // Collect current positions from the form for context
        const currentPositionen = [];
        document.querySelectorAll('.position-row').forEach(row => {
            const desc = row.querySelector('.pos-beschreibung')?.value?.trim();
            const verantw = row.querySelector('.pos-verantwortlich')?.value?.trim();
            const detail = row.querySelector('.pos-details')?.value?.trim();
            if (desc) { currentPositionen.push({ desc, verantw, detail }); }
        });

        const positionenLines = currentPositionen.length > 0
            ? '\n\nDie beauftragten Leistungen im Einzelnen:\n' +
              currentPositionen.map((p, i) => {
                  let line = `  ${i + 1}. ${p.desc}`;
                  if (p.verantw) { line += ` – ausgeführt durch: ${p.verantw}`; }
                  if (p.detail) { line += `\n     → ${p.detail}`; }
                  return line;
              }).join('\n')
            : '';

        const text = `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage vom ${formatDate(anfrage.createdAt)}${anfrage.beschreibung ? ` bezüglich "${anfrage.beschreibung.substring(0, 80)}"` : ''}.

Gerne unterbreiten wir Ihnen das folgende detaillierte Angebot für die gewünschten Arbeiten. Alle Leistungen werden durch qualifizierte Fachkräfte ausgeführt und entsprechen den geltenden Normen und Vorschriften.${positionenLines}

Selbstverständlich stehen wir Ihnen bei Rückfragen zu einzelnen Positionen jederzeit zur Verfügung – wir erläutern Ihnen gerne jeden Schritt persönlich.

Hinweise:
– Alle Preise verstehen sich zzgl. 19 % MwSt.
– Das Angebot gilt 30 Tage ab Erstellungsdatum.
– Änderungen im Arbeitsumfang werden nach tatsächlichem Aufwand berechnet und vorab kommuniziert.
– Nach Abschluss der Arbeiten erhalten Sie ein detailliertes Abnahmeprotokoll.

Wir freuen uns auf eine gute Zusammenarbeit.
${signoff}`;
        const angebotTextField = document.getElementById('angebot-text');
        if (angebotTextField) {angebotTextField.value = text;}

        // KI-Transparenz: Vorschlag klar kennzeichnen und Nutzer entscheiden lassen
        if (window.kiTransparencyUI) {
            window.kiTransparencyUI.wrapAIContent('angebot-text', {
                type: 'angebot-text',
                onConfirm: () => {
                    window.AppUtils.showToast('KI-Text übernommen', 'success');
                },
                onReject: () => {
                    const el = document.getElementById('angebot-text');
                    if (el) {el.value = '';}
                    window.AppUtils.showToast('KI-Text verworfen', 'info');
                }
            });
        }

        aiBtn.innerHTML = '🤖 KI-Vorschlag generieren';
        aiBtn.disabled = false;
    }, 1500);
}

function getAngebotStatusBadge(status) {
    switch (status) {
    case 'entwurf':
        return '<span class="status-badge status-entwurf">● Entwurf</span>';
    case 'offen':
        return '<span class="status-badge status-offen">● Wartet auf Annahme</span>';
    case 'angenommen':
        return '<span class="status-badge status-angenommen">● Angenommen</span>';
    case 'vorläufig_gesendet':
        return '<span class="status-badge status-offen">✉️ Vorläufig gesendet</span>';
    case 'abgelehnt':
        return '<span class="status-badge status-abgelehnt">● Abgelehnt</span>';
    default:
        return `<span class="status-badge">${window.UI.sanitize(status || 'entwurf')}</span>`;
    }
}

function updateAngeboteFilterBadges() {
    const allAngebote = store?.angebote || [];
    const counts = { alle: allAngebote.length, entwurf: 0, offen: 0, angenommen: 0, abgelehnt: 0, 'vorläufig_gesendet': 0 };
    allAngebote.forEach(a => {
        const s = a.status || 'entwurf';
        if (counts[s] !== undefined) { counts[s]++; }
    });

    const tabContainer = document.getElementById('angebote-filter-tabs');
    if (!tabContainer) {return;}
    tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        const count = counts[filter] !== undefined ? counts[filter] : 0;
        const labelMap = { alle: 'Alle', entwurf: 'Entwurf', offen: 'Offen', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt' };
        btn.textContent = `${labelMap[filter] || filter} (${count})`;
    });
}

function renderAngebote() {
    const container = document.getElementById('angebote-list');
    if (!container) {return;}
    const allAngebote = store?.angebote || [];

    // Update badge counts on filter tabs
    updateAngeboteFilterBadges();

    if (allAngebote.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <h3 style="margin-bottom: 8px;">Keine Angebote vorhanden</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Erstelle Angebote aus offenen Anfragen oder lege eine neue Anfrage an.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" data-action="navigate-anfragen">
                        📥 Anfragen ansehen
                    </button>
                    <button class="btn btn-secondary" data-action="neue-anfrage">
                        ➕ Neue Anfrage
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Apply status filter
    let filtered = [...allAngebote];
    if (currentAngeboteFilter !== 'alle') {
        filtered = filtered.filter(a => (a.status || 'entwurf') === currentAngeboteFilter);
    }

    // Apply search filter
    const searchQuery = currentAngeboteSearch.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(a =>
            (a.kunde?.name || '').toLowerCase().includes(searchQuery) ||
            (a.id || '').toLowerCase().includes(searchQuery) ||
            (a.leistungsart || '').toLowerCase().includes(searchQuery) ||
            (a.text || '').toLowerCase().includes(searchQuery) ||
            (a.positionen || []).some(p => (p.beschreibung || '').toLowerCase().includes(searchQuery))
        );
    }

    if (filtered.length === 0) {
        const filterLabel = currentAngeboteFilter !== 'alle' ? ` mit Status "${currentAngeboteFilter}"` : '';
        const searchLabel = searchQuery ? ` passend zu "${window.UI.sanitize(searchQuery)}"` : '';
        container.innerHTML = `
            <div class="empty-state empty-state-small">
                <div style="font-size: 36px; margin-bottom: 12px;">🔍</div>
                <h3 style="margin-bottom: 8px;">Keine Angebote gefunden</h3>
                <p style="color: var(--text-secondary);">
                    Keine Angebote${filterLabel}${searchLabel}.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const isOffen = a.status === 'offen';
        const isEntwurf = a.status === 'entwurf';

        // Build entity trail: Anfrage -> Angebot (current)
        const anfrage = a.anfrageId ? (store?.anfragen || []).find(anf => anf.id === a.anfrageId) : null;
        let angebotTrailHTML = '';
        if (anfrage) {
            angebotTrailHTML = `
                <div class="entity-trail">
                    <span class="trail-item" data-action="switch-view" data-view="anfragen">📥 ${h(anfrage.id)}</span>
                    <span class="trail-arrow">&rarr;</span>
                    <span class="trail-item trail-current">📝 ${h(a.id)}</span>
                </div>
            `;
        }

        // Build action buttons based on status
        let actionButtons = '';

        if (isEntwurf) {
            // Draft: show Bearbeiten + Vorschau & Freigabe + Löschen
            actionButtons = `
                <button class="btn btn-secondary btn-small" data-action="edit-angebot" data-id="${h(a.id)}">
                    Bearbeiten
                </button>
                <button class="btn btn-primary" data-action="preview-angebot" data-id="${h(a.id)}">
                    Vorschau &amp; Freigabe
                </button>
                <button class="btn btn-danger btn-small" data-action="delete-angebot" data-id="${h(a.id)}">
                    Löschen
                </button>
            `;
        } else {
            // Non-draft: standard buttons
            actionButtons = `
                <button class="btn btn-secondary btn-small" data-action="export-pdf" data-id="${h(a.id)}">
                    PDF
                </button>
                <button class="btn btn-secondary btn-small" data-action="edit-angebot" data-id="${h(a.id)}">
                    Bearbeiten
                </button>
                <button class="btn btn-danger btn-small" data-action="delete-angebot" data-id="${h(a.id)}">
                    Löschen
                </button>
                ${isOffen ? `<button class="btn btn-success" data-action="accept-angebot" data-id="${h(a.id)}">
                    Auftrag erteilen
                </button>` : ''}
                ${isOffen && a.kunde?.id ? `<button class="btn btn-secondary btn-small" data-action="copy-portal-link" data-kunde-id="${h(a.kunde.id)}" title="Portal-Link kopieren">
                    Portal-Link
                </button>` : ''}
            `;
        }

        return `
        <div class="item-card" role="button" tabindex="0" aria-label="Angebot ${h(a.id)} ${window.UI.sanitize(a.kunde?.name || 'Unbekannt')}" data-action="show-angebot-detail" data-id="${h(a.id)}" style="cursor:pointer">
            <div class="item-header">
                <h3 class="item-title">${window.UI.sanitize(a.kunde?.name || 'Unbekannt')}</h3>
                <span class="item-id">${h(a.id)}</span>
            </div>
            ${angebotTrailHTML}
            <div class="item-meta">
                <span>${(a.positionen || []).length} Positionen</span>
                <span>${formatCurrency(a.brutto)}</span>
                <span>${formatDate(a.createdAt)}</span>
                ${(() => {
                    if (a.status === 'offen' || a.status === 'entwurf') {
                        const created = new Date(a.createdAt);
                        const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const daysLeft = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
                        if (daysLeft < 0) {return '<span style="color:var(--accent-danger);font-weight:600;">Abgelaufen</span>';}
                        if (daysLeft <= 7) {return `<span style="color:var(--accent-warning);font-weight:600;">Noch ${daysLeft}T gültig</span>`;}
                        return `<span style="color:var(--text-muted);">Noch ${daysLeft}T gültig</span>`;
                    }
                    return '';
                })()}
            </div>
            <p class="item-description">${getLeistungsartLabel(a.leistungsart)}</p>
            <div class="item-actions">
                ${getAngebotStatusBadge(a.status)}
                ${actionButtons}
            </div>
        </div>`;
    }).join('');
}

function editAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) {return;}

    // Set the editing flag so the submit handler knows to update
    store.editingAngebotId = id;

    // Update modal title to indicate editing
    const modalTitle = document.getElementById('modal-angebot-title');
    if (modalTitle) {
        modalTitle.textContent = 'Angebot bearbeiten';
    }

    // Fill the hidden anfrage ID field
    const anfrageIdField = document.getElementById('angebot-anfrage-id');
    if (anfrageIdField) {anfrageIdField.value = angebot.anfrageId || '';}

    // Fill the kunde info section
    const kundeInfoEl = document.getElementById('angebot-kunde-info');
    if (kundeInfoEl && angebot.kunde) {
        kundeInfoEl.innerHTML = `
            <strong>${window.UI.sanitize(angebot.kunde?.name || 'Unbekannt')}</strong><br>
            ${getLeistungsartLabel(angebot.leistungsart)}<br>
            <small>Angebot ${window.UI.sanitize(angebot.id)} bearbeiten</small>
        `;
    }

    // Clear existing positions and re-add from the angebot
    const posContainer = document.getElementById('positionen-list');
    if (!posContainer) {return;}
    posContainer.innerHTML = '';

    if (angebot.positionen && angebot.positionen.length > 0) {
        angebot.positionen.forEach(pos => {
            addPosition({
                beschreibung: pos.beschreibung,
                menge: pos.menge,
                einheit: pos.einheit,
                preis: pos.preis,
                materialId: pos.materialId || null,
                details: pos.details || '',
                verantwortlich: pos.verantwortlich || ''
            });
        });
    } else {
        addPosition();
    }

    // Fill the angebot text
    const angebotTextInput = document.getElementById('angebot-text');
    if (angebotTextInput) {angebotTextInput.value = angebot.text || '';}

    // Update the summary calculation
    updateAngebotSummary();

    // Open the modal
    openModal('modal-angebot');
}

function deleteAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) {return;}

    // Use trash service for soft-delete with undo if available
    if (window.trashService) {
        const result = window.trashService.softDelete('angebot', angebot);
        if (result && result.blocked) {
            // Orphan protection: show warning, don't delete
            if (window.confirmDialogService) {
                window.confirmDialogService.showConfirmDialog({
                    title: 'Angebot kann nicht gelöscht werden',
                    message: result.reason,
                    confirmText: 'Verstanden',
                    cancelText: '',
                    onConfirm: () => {}
                });
            }
            return;
        }

        // trashService already removed from store and saved
        // Reload angebote from store to stay in sync
        showToast('Angebot gelöscht', 'info');
        addActivity('🗑️', `Angebot ${angebot.id} für ${angebot.kunde?.name || 'Unbekannt'} gelöscht`);
        renderAngebote();
        return;
    }

    // Fallback: use confirmDialogService for confirmation, then hard delete
    if (window.confirmDialogService) {
        window.confirmDialogService.confirmDelete(
            'Angebot',
            `Angebot ${window.UI.sanitize(angebot.id)} für ${window.UI.sanitize(angebot.kunde?.name || 'Unbekannt')} (${formatCurrency(angebot.brutto)})`,
            () => {
                store.angebote = store.angebote.filter(a => a.id !== id);
                saveStore();
                showToast('Angebot gelöscht', 'info');
                addActivity('🗑️', `Angebot ${angebot.id} für ${angebot.kunde?.name || 'Unbekannt'} gelöscht`);
                renderAngebote();
            }
        );
    } else {
        // Last resort: simple confirm
        if (confirm(`Angebot ${angebot.id} wirklich löschen?`)) {
            store.angebote = store.angebote.filter(a => a.id !== id);
            saveStore();
            showToast('Angebot gelöscht', 'info');
            addActivity('🗑️', `Angebot ${angebot.id} für ${angebot.kunde?.name || 'Unbekannt'} gelöscht`);
            renderAngebote();
        }
    }
}

function acceptAngebot(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) {return;}

    // Show confirmation dialog
    window.confirmDialogService?.confirmAcceptAngebot(
        angebot.id,
        window.UI?.sanitize?.(angebot.kunde?.name) || 'Unbekannt',
        () => {
            // Confirmed - proceed with accepting the quote
            angebot.status = 'angenommen';

            // Build stueckliste from positionen with materialId
            const stueckliste = angebot.positionen
                .filter(pos => pos.materialId)
                .map(pos => ({
                    materialId: pos.materialId,
                    artikelnummer: pos.artikelnummer,
                    beschreibung: pos.beschreibung,
                    menge: pos.menge,
                    einheit: pos.einheit,
                    ekPreis: pos.ekPreis,
                    vkPreis: pos.preis,
                    bestandBenötigt: pos.menge,
                    bestandVerfügbar: pos.bestandVerfuegbar
                }));

            const auftrag = {
                id: generateId('AUF'),
                angebotId,
                kunde: angebot.kunde,
                leistungsart: angebot.leistungsart,
                positionen: angebot.positionen,
                stueckliste: stueckliste,  // NEW: Material list from positionen
                angebotsWert: angebot.brutto,
                netto: angebot.netto,
                mwst: angebot.mwst,
                status: 'geplant',
                fortschritt: 0,
                mitarbeiter: [],
                startDatum: null,
                endDatum: null,
                checkliste: [],
                kommentare: [],
                historie: [{ aktion: 'erstellt', datum: new Date().toISOString(), details: `Aus Angebot ${angebotId}` }],
                createdAt: new Date().toISOString()
            };

            store.auftraege.push(auftrag);
            saveStore();

            addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

            switchView('auftraege');
            document.querySelector('[data-view="auftraege"]')?.click();
        }
    );
}

function initAngeboteFilters() {
    // Filter tab clicks
    const tabContainer = document.getElementById('angebote-filter-tabs');
    if (tabContainer) {
        tabContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentAngeboteFilter = btn.dataset.filter;
                tabContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderAngebote();
            });
        });
    }

    // Search input with 300ms debounce
    const searchInput = document.getElementById('angebote-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(angeboteSearchDebounceTimer);
            angeboteSearchDebounceTimer = setTimeout(() => {
                currentAngeboteSearch = searchInput.value;
                renderAngebote();
            }, 300);
        });
    }
}

// ============================================
// Preview & Freigabe (Draft Review Workflow)
// ============================================

// Inject CSS for entwurf status badge and preview modal — styles moved to components.css
(function _oldInjectEntwurfStyles() {
    if (document.getElementById('entwurf-styles')) {return;}
    const style = document.createElement('style');
    style.id = 'entwurf-styles';
    style.textContent = `
        .status-badge.status-entwurf {
            background: rgba(107, 114, 128, 0.15);
            color: #6b7280;
        }

        .angebot-preview-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .angebot-preview-modal {
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .angebot-preview-warning {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 14px 20px;
            margin: 20px 24px 0 24px;
            color: #92400e;
            font-weight: 600;
            font-size: 15px;
            text-align: center;
        }

        .angebot-preview-header {
            padding: 24px 24px 0 24px;
            border-bottom: none;
        }

        .angebot-preview-header h2 {
            margin: 0 0 4px 0;
            font-size: 22px;
            color: var(--text-primary, #1f2937);
        }

        .angebot-preview-header .preview-subtitle {
            color: var(--text-secondary, #6b7280);
            font-size: 14px;
            margin: 0;
        }

        .angebot-preview-body {
            padding: 20px 24px;
        }

        .angebot-preview-section {
            margin-bottom: 20px;
        }

        .angebot-preview-section h3 {
            font-size: 15px;
            color: var(--text-secondary, #6b7280);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 10px 0;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
        }

        .angebot-preview-kunde {
            font-size: 16px;
            line-height: 1.6;
        }

        .angebot-preview-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .angebot-preview-table th {
            text-align: left;
            padding: 10px 12px;
            background: var(--bg-secondary, #f9fafb);
            border-bottom: 2px solid var(--border-color, #e5e7eb);
            font-weight: 600;
            color: var(--text-primary, #1f2937);
        }

        .angebot-preview-table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
            color: var(--text-primary, #374151);
        }

        .angebot-preview-table .text-right {
            text-align: right;
        }

        .angebot-preview-totals {
            margin-top: 12px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 6px;
            font-size: 15px;
        }

        .angebot-preview-totals .total-row {
            display: flex;
            gap: 20px;
            min-width: 260px;
            justify-content: space-between;
        }

        .angebot-preview-totals .total-row.total-brutto {
            font-weight: 700;
            font-size: 17px;
            border-top: 2px solid var(--text-primary, #1f2937);
            padding-top: 8px;
            margin-top: 4px;
        }

        .angebot-preview-text {
            background: var(--bg-secondary, #f9fafb);
            border-radius: 8px;
            padding: 16px;
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-primary, #374151);
            border: 1px solid var(--border-color, #e5e7eb);
        }

        .angebot-preview-actions {
            padding: 20px 24px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            border-top: 1px solid var(--border-color, #e5e7eb);
            flex-wrap: wrap;
        }

        .angebot-preview-actions .btn-freigabe {
            background: #16a34a;
            color: #fff;
            border: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
        }

        .angebot-preview-actions .btn-freigabe:hover {
            background: #15803d;
        }

        .angebot-preview-actions .btn-zurueck {
            background: var(--bg-secondary, #f3f4f6);
            color: var(--text-primary, #374151);
            border: 1px solid var(--border-color, #d1d5db);
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        .angebot-preview-actions .btn-zurueck:hover {
            background: var(--border-color, #e5e7eb);
        }
    `;
    document.head.appendChild(style);
})();

function previewAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) { return; }

    // Build positions table rows
    const positionenRows = (angebot.positionen || []).map((pos, idx) => {
        const gesamt = (pos.menge || 0) * (pos.preis || 0);
        return `
            <tr>
                <td style="vertical-align:top;padding-top:12px;">${idx + 1}</td>
                <td style="vertical-align:top;">
                    <strong style="font-size:14px;">${window.UI.sanitize(pos.beschreibung)}</strong>
                    ${pos.details ? `<div style="font-size:12px;color:#6b7280;margin-top:5px;line-height:1.5;">${window.UI.sanitize(pos.details)}</div>` : ''}
                    ${pos.verantwortlich ? `<div style="font-size:11px;color:#c8956c;margin-top:4px;font-weight:600;">&#128100; Ausführung: ${window.UI.sanitize(pos.verantwortlich)}</div>` : ''}
                </td>
                <td class="text-right" style="vertical-align:top;padding-top:12px;">${pos.menge}</td>
                <td style="vertical-align:top;padding-top:12px;">${window.UI.sanitize(pos.einheit || 'Stk.')}</td>
                <td class="text-right" style="vertical-align:top;padding-top:12px;">${formatCurrency(pos.preis)}</td>
                <td class="text-right" style="vertical-align:top;padding-top:12px;">${formatCurrency(gesamt)}</td>
            </tr>
        `;
    }).join('');

    // Build the preview modal HTML
    const previewHTML = `
        <div class="angebot-preview-overlay" id="angebot-preview-overlay" data-action="close-preview-overlay">
            <div class="angebot-preview-modal" data-action="stop-propagation">

                <div class="angebot-preview-warning">
                    ⚠ Bitte prüfen Sie alle Angaben sorgfältig, bevor Sie das Angebot freigeben.
                </div>

                <div class="angebot-preview-header">
                    <h2>Angebot ${window.UI.sanitize(angebot.id)} — Vorschau</h2>
                    <p class="preview-subtitle">Erstellt am ${formatDate(angebot.createdAt)}</p>
                </div>

                <div class="angebot-preview-body">

                    <div class="angebot-preview-section">
                        <h3>Kunde</h3>
                        <div class="angebot-preview-kunde">
                            <strong>${window.UI.sanitize(angebot.kunde?.name || 'Unbekannt')}</strong><br>
                            ${angebot.kunde?.email ? window.UI.sanitize(angebot.kunde.email) + '<br>' : ''}
                            ${angebot.kunde?.telefon ? window.UI.sanitize(angebot.kunde.telefon) + '<br>' : ''}
                            ${angebot.kunde?.adresse ? window.UI.sanitize(angebot.kunde.adresse) : ''}
                        </div>
                    </div>

                    <div class="angebot-preview-section">
                        <h3>Leistungsart</h3>
                        <p style="margin:0;">${getLeistungsartLabel(angebot.leistungsart)}</p>
                    </div>

                    <div class="angebot-preview-section">
                        <h3>Positionen</h3>
                        <table class="angebot-preview-table">
                            <thead>
                                <tr>
                                    <th>Nr.</th>
                                    <th>Beschreibung</th>
                                    <th class="text-right">Menge</th>
                                    <th>Einheit</th>
                                    <th class="text-right">Einzelpreis</th>
                                    <th class="text-right">Gesamt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${positionenRows}
                            </tbody>
                        </table>

                        <div class="angebot-preview-totals">
                            <div class="total-row">
                                <span>Netto:</span>
                                <span>${formatCurrency(angebot.netto)}</span>
                            </div>
                            <div class="total-row">
                                <span>MwSt. (19%):</span>
                                <span>${formatCurrency(angebot.mwst)}</span>
                            </div>
                            <div class="total-row total-brutto">
                                <span>Brutto:</span>
                                <span>${formatCurrency(angebot.brutto)}</span>
                            </div>
                        </div>
                    </div>

                    ${angebot.text ? `
                    <div class="angebot-preview-section">
                        <h3>Angebotstext</h3>
                        <div class="angebot-preview-text">${window.UI.sanitize(angebot.text)}</div>
                    </div>
                    ` : ''}

                </div>

                <div class="angebot-preview-actions">
                    <button class="btn-zurueck" data-action="close-preview">
                        Zurück zum Bearbeiten
                    </button>
                    <button class="btn-freigabe" data-action="freigeben-angebot" data-id="${window.UI.sanitize(angebot.id)}">
                        Angebot freigeben und senden
                    </button>
                </div>

            </div>
        </div>
    `;

    // Remove any existing preview overlay
    const existing = document.getElementById('angebot-preview-overlay');
    if (existing) { existing.remove(); }

    // Insert into DOM
    const previewContainer = document.createElement('div');
    previewContainer.innerHTML = previewHTML;
    const overlayEl = previewContainer.firstElementChild;
    document.body.appendChild(overlayEl);
    document.body.style.overflow = 'hidden';

    // Event delegation for preview overlay
    overlayEl.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;
            if (action === 'stop-propagation') {
                e.stopPropagation();
                return;
            }
            if (action === 'close-preview') {
                e.stopPropagation();
                closeAngebotPreview();
                return;
            }
            if (action === 'freigeben-angebot') {
                e.stopPropagation();
                freigebenAngebot(actionEl.dataset.id);
                return;
            }
        }
        // Click on overlay background closes it
        if (e.target === overlayEl) {
            closeAngebotPreview();
        }
    });
}

function closeAngebotPreview(event) {
    // If called from overlay click, only close if clicking the overlay itself
    if (event && event.target && event.target.id !== 'angebot-preview-overlay') {
        return;
    }
    const overlay = document.getElementById('angebot-preview-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

function freigebenAngebot(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) { return; }

    // Move status from 'entwurf' to 'offen'
    angebot.status = 'offen';
    angebot.freigegebenAt = new Date().toISOString();
    saveStore();

    // Close the preview modal
    closeAngebotPreview();

    addActivity('✅', `Angebot ${angebot.id} für ${angebot.kunde?.name || 'Unbekannt'} freigegeben und gesendet`);
    showToast('Angebot wurde freigegeben und ist jetzt offen.', 'success');

    // Re-render
    renderAngebote();
}

// ============================================
// Angebot Detail View
// ============================================

function showAngebotDetail(angebotId) {
    const angebot = store.angebote.find(a => a.id === angebotId);
    if (!angebot) {return;}

    // Linked documents
    const anfrage = angebot.anfrageId ? store.anfragen.find(a => a.id === angebot.anfrageId) : null;
    const auftrag = store.auftraege.find(a => a.angebotId === angebotId);
    const rechnung = store.rechnungen.find(r => r.angebotId === angebotId || (auftrag && r.auftragId === auftrag.id));

    // Customer enrichment
    const customer = angebot.kunde?.email ? (window.customerService?.getCustomerByEmail?.(angebot.kunde.email) || null) : null;
    const customerId = customer?.id || null;

    // Calendar & Communication
    const appointments = customerId && window.calendarService?.getAppointmentsForCustomer ? window.calendarService.getAppointmentsForCustomer(customerId) : [];
    const messages = customerId && window.communicationService?.getMessagesByCustomer ? window.communicationService.getMessagesByCustomer(customerId) : [];

    const st = getAngebotStatusBadge(angebot.status);

    // Build linked document chain
    let docChainHtml = '<div class="angebot-doc-chain">';
    if (anfrage) {
        docChainHtml += `<span class="doc-chain-item" data-action="switch-view" data-view="anfragen" title="Anfrage anzeigen">📥 ${h(anfrage.id)}</span><span class="doc-chain-arrow">&rarr;</span>`;
    }
    docChainHtml += `<span class="doc-chain-item doc-chain-active">📝 ${h(angebot.id)}</span>`;
    if (auftrag) {
        docChainHtml += `<span class="doc-chain-arrow">&rarr;</span><span class="doc-chain-item" data-action="switch-view" data-view="auftraege" title="Auftrag anzeigen">📋 ${h(auftrag.id)}</span>`;
    }
    if (rechnung) {
        docChainHtml += `<span class="doc-chain-arrow">&rarr;</span><span class="doc-chain-item" data-action="show-rechnung" data-id="${h(rechnung.id)}" title="Rechnung anzeigen">💰 ${h(rechnung.id)}</span>`;
    }
    docChainHtml += '</div>';

    // Customer card
    const k = customer || angebot.kunde;
    const customerHtml = `
        <div class="angebot-detail-section">
            <h4>Kunde</h4>
            <div class="angebot-customer-card">
                <div><strong>${window.UI.sanitize(k.name || '-')}</strong></div>
                ${k.email ? `<div>${window.UI.sanitize(k.email)}</div>` : ''}
                ${k.telefon || k.phone ? `<div>${window.UI.sanitize(k.telefon || k.phone)}</div>` : ''}
                ${k.adresse || k.address ? `<div>${window.UI.sanitize(k.adresse || k.address)}</div>` : ''}
            </div>
        </div>`;

    // Positionen / BOM table
    const posHtml = `
        <div class="angebot-detail-section">
            <h4>Positionen</h4>
            <table class="angebot-bom-table">
                <thead>
                    <tr>
                        <th>Pos.</th>
                        <th>Beschreibung</th>
                        <th>Menge</th>
                        <th>Einheit</th>
                        <th class="text-right">Einzelpreis</th>
                        <th class="text-right">Gesamt</th>
                    </tr>
                </thead>
                <tbody>
                    ${(angebot.positionen || []).map((p, i) => `
                        <tr>
                            <td style="vertical-align:top;">${i + 1}</td>
                            <td style="vertical-align:top;">
                                <strong>${window.UI.sanitize(p.beschreibung)}</strong>
                                ${p.details ? `<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-top:4px;line-height:1.5;">${window.UI.sanitize(p.details)}</div>` : ''}
                                ${p.verantwortlich ? `<div style="font-size:11px;color:#c8956c;margin-top:3px;font-weight:600;">&#128100; Ausführung: ${window.UI.sanitize(p.verantwortlich)}</div>` : ''}
                            </td>
                            <td style="vertical-align:top;">${p.menge}</td>
                            <td style="vertical-align:top;">${window.UI.sanitize(p.einheit)}</td>
                            <td class="text-right" style="vertical-align:top;">${formatCurrency(p.preis)}</td>
                            <td class="text-right" style="vertical-align:top;">${formatCurrency((p.menge || 0) * (p.preis || 0))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="angebot-summary">
                <div class="summary-row"><span>Netto:</span><span>${formatCurrency(angebot.netto)}</span></div>
                <div class="summary-row"><span>MwSt. 19%:</span><span>${formatCurrency(angebot.mwst)}</span></div>
                <div class="summary-row total"><span>Brutto:</span><span>${formatCurrency(angebot.brutto)}</span></div>
            </div>
        </div>`;

    // Angebots-Text
    const textHtml = angebot.text ? `
        <div class="angebot-detail-section">
            <h4>Angebotstext</h4>
            <div style="white-space:pre-wrap; font-size:13px; color:var(--text-secondary); line-height:1.6;">${window.UI.sanitize(angebot.text)}</div>
        </div>` : '';

    // Calendar
    let calHtml = '';
    if (appointments.length > 0) {
        calHtml = `
        <div class="angebot-detail-section">
            <h4>Termine</h4>
            ${appointments.slice(0, 5).map(apt => `
                <div class="angebot-comm-item">
                    <span>${formatDate(apt.date || apt.start)}</span>
                    <span>${window.UI.sanitize(apt.title || apt.beschreibung || '-')}</span>
                </div>
            `).join('')}
        </div>`;
    }

    // Communication
    let commHtml = '';
    if (messages.length > 0) {
        commHtml = `
        <div class="angebot-detail-section">
            <h4>Kommunikation</h4>
            ${messages.slice(0, 5).map(msg => `
                <div class="angebot-comm-item">
                    <span>${formatDate(msg.date || msg.createdAt)}</span>
                    <span>${window.UI.sanitize(msg.subject || msg.text || '-')}</span>
                </div>
            `).join('')}
        </div>`;
    }

    // Kundenportal — generate link for this Angebot if service available
    let portalUrl = null;
    const _useSupabasePortal = !!window.portalService && window.supabaseConfig?.isConfigured?.();
    if (_useSupabasePortal) {
        // Supabase-based portal — URL will be set async via button click
        portalUrl = '#portal-async';
    } else if (window.customerPortalService?.generateAccessToken) {
        // Token will be generated async via button click — set placeholder
        portalUrl = '#portal-async-local';
    }

    // Actions
    const portalCid = h(angebot.kunde?.id || angebot.anfrageId || '');
    const actionsHtml = `
        <div class="form-actions" style="flex-wrap:wrap;gap:8px;">
            <button type="button" class="btn btn-secondary" data-action="close-detail-modal">Schliessen</button>
            ${angebot.status === 'offen' ? `<button type="button" class="btn btn-success" data-action="accept-and-close-detail" data-id="${h(angebot.id)}">Auftrag erteilen</button>` : ''}
            ${portalUrl ? `
            <button type="button" class="btn btn-secondary" title="Kundenportal öffnen"
                data-action="open-portal" data-kunde-id="${portalCid}">
                🔗 Portal öffnen
            </button>
            <button type="button" class="btn btn-secondary" title="Direkt-Link kopieren"
                data-action="copy-portal-link-detail" data-kunde-id="${portalCid}">
                📋 Link kopieren
            </button>` : ''}
        </div>`;

    // Render
    const detailContent = document.getElementById('angebot-detail-content');
    if (!detailContent) {return;}
    detailContent.innerHTML = `
        <div style="padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div>
                    <span class="item-id" style="font-size:14px;">${h(angebot.id)}</span>
                    <span style="margin-left:12px;">${st}</span>
                </div>
                <div style="color:var(--text-muted); font-size:13px;">
                    ${formatDate(angebot.createdAt)}
                </div>
            </div>
            ${docChainHtml}
            ${customerHtml}
            ${posHtml}
            ${textHtml}
            ${calHtml}
            ${commHtml}
            ${actionsHtml}
        </div>`;

    openModal('modal-angebot-detail');
}

function exportAngebotPDF(id) {
    const angebot = store.angebote.find(a => a.id === id);
    if (!angebot) {return;}

    // Use PDF service if available
    if (window.pdfService?.generateAngebot) {
        window.pdfService.generateAngebot(angebot);
        return;
    }

    // Fallback: show toast with info
    showToast('PDF-Export wird vorbereitet...', 'info');

    // Simple print-based PDF fallback
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Popup-Blocker verhindert den PDF-Export', 'error');
        return;
    }

    const posRows = (angebot.positionen || []).map((p, i) =>
        `<tr>
            <td style="vertical-align:top;padding-top:10px;">${i + 1}</td>
            <td style="vertical-align:top;">
                <strong>${window.UI.sanitize(p.beschreibung)}</strong>
                ${p.details ? `<div style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.5;">${window.UI.sanitize(p.details)}</div>` : ''}
                ${p.verantwortlich ? `<div style="font-size:11px;color:#c8956c;margin-top:4px;font-weight:600;">Ausführung: ${window.UI.sanitize(p.verantwortlich)}</div>` : ''}
            </td>
            <td style="vertical-align:top;padding-top:10px;">${p.menge}</td>
            <td style="vertical-align:top;padding-top:10px;">${window.UI.sanitize(p.einheit)}</td>
            <td style="text-align:right;vertical-align:top;padding-top:10px;">${formatCurrency(p.preis)}</td>
            <td style="text-align:right;vertical-align:top;padding-top:10px;">${formatCurrency((p.menge || 0) * (p.preis || 0))}</td>
        </tr>`
    ).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Angebot ${window.UI.sanitize(angebot.id)}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px 12px;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:600}.totals{text-align:right;margin-top:20px}.totals div{margin:4px 0}.totals .brutto{font-weight:700;font-size:18px;border-top:2px solid #333;padding-top:8px}</style>
    </head><body>
        <h1>Angebot ${window.UI.sanitize(angebot.id)}</h1>
        <p><strong>Kunde:</strong> ${window.UI.sanitize(angebot.kunde?.name || '-')}</p>
        <p><strong>Datum:</strong> ${formatDate(angebot.createdAt)}</p>
        <p><strong>Leistungsart:</strong> ${getLeistungsartLabel(angebot.leistungsart)}</p>
        <table><thead><tr><th>Nr.</th><th>Beschreibung</th><th>Menge</th><th>Einheit</th><th style="text-align:right">Einzelpreis</th><th style="text-align:right">Gesamt</th></tr></thead><tbody>${posRows}</tbody></table>
        <div class="totals"><div>Netto: ${formatCurrency(angebot.netto)}</div><div>MwSt. 19%: ${formatCurrency(angebot.mwst)}</div><div class="brutto">Brutto: ${formatCurrency(angebot.brutto)}</div></div>
        ${angebot.text ? `<h3>Angebotstext</h3><p style="white-space:pre-wrap">${window.UI.sanitize(angebot.text)}</p>` : ''}
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
}

// ============================================
// Vorläufiges Angebot — Auto-Send
// ============================================

/**
 * Automatically send a preliminary (vorläufig) quote to the customer immediately
 * after it is created. The Handwerker gets an in-app notification so they can
 * supervise and edit before the customer responds.
 *
 * Flow:
 *  1. Generate a PDF preview (if pdfGenerationService is available)
 *  2. Email the preliminary quote to the customer (if emailService is available)
 *  3. Create an in-app supervisor notification
 *  4. Set angebot.status → 'vorläufig_gesendet'
 *  5. Save the updated status to the store
 *
 * Failures in step 1 or 2 are non-fatal: the notification (step 3) still fires
 * and the Handwerker can send manually if needed.
 *
 * @param {Object} angebot - Newly created Angebot object
 * @param {Object} anfrage - Parent Anfrage object
 */
async function sendVorlaeufigAngebot(angebot, anfrage) {
    const kundeEmail = angebot.kunde?.email || anfrage?.kunde?.email;
    const kundeName  = angebot.kunde?.name  || anfrage?.kunde?.name || 'Unbekannt';

    let emailSent = false;

    // 1. Try to send via email relay
    if (kundeEmail && window.emailService?.sendEmail) {
        const companyInfo = window.companySettings
            ? await window.companySettings.load().catch(() => ({}))
            : {};
        const companyName = companyInfo?.companyName || 'FreyAI Visions';

        // ── Portal CTA ────────────────────────────────────────────────────
        let portalUrl = null;
        const _spActive = !!window.portalService && window.supabaseConfig?.isConfigured?.();
        if (_spActive) {
            try {
                const { url } = await window.portalService.generateToken(angebot.kunde?.id || angebot.kundeId || '');
                portalUrl = url;
            } catch (_) { /* portal not available */ }
        } else if (window.customerPortalService) {
            try {
                const tokenRecord = await window.customerPortalService.generateAccessToken(
                    angebot.kunde?.id || angebot.kundeId || '',
                    'quote'
                );
                if (tokenRecord?.token) {
                    portalUrl = `${location.origin}/customer-portal.html?token=${encodeURIComponent(tokenRecord.token)}`;
                }
            } catch { /* portal not available */ }
        }

        // ── Build body fragment (positions + totals) ──────────────────────
        const eur = n => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        const escH = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const posRows = (angebot.positionen || []).map((p, idx) =>
            `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
               <td style="padding:10px 8px;color:#9ca3af;font-size:12px;vertical-align:top;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
               <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #e5e7eb;">
                 <strong style="font-size:13px;color:#1f2937;">${escH(p.beschreibung)}</strong>
                 ${p.details ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;line-height:1.6;">${escH(p.details)}</div>` : ''}
                 ${p.verantwortlich ? `<div style="font-size:11px;color:#c8956c;margin-top:5px;font-weight:600;">&#128100; Ausführung: ${escH(p.verantwortlich)}</div>` : ''}
               </td>
               <td style="padding:10px 8px;white-space:nowrap;vertical-align:top;border-bottom:1px solid #e5e7eb;color:#374151;">${p.menge} ${escH(p.einheit || '')}</td>
               <td style="padding:10px 8px;text-align:right;vertical-align:top;border-bottom:1px solid #e5e7eb;color:#374151;">${eur(p.preis)}</td>
               <td style="padding:10px 8px;text-align:right;vertical-align:top;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1f2937;">${eur((p.menge||0)*(p.preis||0))}</td>
             </tr>`
        ).join('');

        const bodyHtml = `
            <p style="margin:0 0 16px;font-size:15px;">Sehr geehrte(r) ${escH(kundeName)},</p>
            <p style="margin:0 0 20px;line-height:1.6;color:#374151;">
              vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen unser
              <strong>vorläufiges Angebot (Nr. ${escH(angebot.id)})</strong>.
              Im Folgenden finden Sie eine detaillierte Aufstellung aller Leistungen und Materialien
              mit den zuständigen Fachkräften – damit Sie genau wissen, was wir für Sie tun.<br><br>
              Sobald wir Ihre Rückmeldung erhalten, erstellen wir das verbindliche Angebot für Sie.
            </p>
            ${angebot.text ? `<div style="margin:0 0 20px;padding:14px 18px;background:#f8fafc;border-left:4px solid #c8956c;border-radius:4px;font-size:13px;color:#374151;line-height:1.6;">${escH(angebot.text).replace(/\n/g,'<br>')}</div>` : ''}
            <h3 style="margin:0 0 10px;font-size:14px;color:#0c1a1a;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #0c1a1a;padding-bottom:6px;">Leistungsübersicht</h3>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:13px;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#0c1a1a;color:#fff;">
                  <th style="padding:10px 8px;text-align:left;font-weight:600;">Nr.</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:600;">Leistung &amp; Details</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:600;">Menge</th>
                  <th style="padding:10px 8px;text-align:right;font-weight:600;">Einzelpreis</th>
                  <th style="padding:10px 8px;text-align:right;font-weight:600;">Gesamt</th>
                </tr>
              </thead>
              <tbody>${posRows}</tbody>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-left:auto;font-size:13px;min-width:260px;">
              ${window._isKleinunternehmer?.() ? `
              <tr style="font-weight:700;font-size:15px;">
                <td style="padding:10px 12px;border-top:2px solid #0c1a1a;color:#0c1a1a;">Gesamtbetrag</td>
                <td style="padding:10px 12px;text-align:right;border-top:2px solid #0c1a1a;color:#0c1a1a;">${eur(angebot.brutto)}</td>
              </tr>
              <tr><td colspan="2" style="padding:8px 12px;font-size:11px;color:#6b7280;">
                Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</td></tr>
              ` : `
              <tr><td style="padding:5px 12px;color:#6b7280;">Netto</td>
                  <td style="padding:5px 12px;text-align:right;color:#374151;">${eur(angebot.netto)}</td></tr>
              <tr><td style="padding:5px 12px;color:#6b7280;">MwSt. ${(window._getTaxRate?.() * 100) || 19} %</td>
                  <td style="padding:5px 12px;text-align:right;color:#374151;">${eur(angebot.mwst)}</td></tr>
              <tr style="font-weight:700;font-size:15px;">
                <td style="padding:10px 12px;border-top:2px solid #0c1a1a;color:#0c1a1a;">Gesamtbetrag</td>
                <td style="padding:10px 12px;text-align:right;border-top:2px solid #0c1a1a;color:#0c1a1a;">${eur(angebot.brutto)}</td>
              </tr>
              `}
            </table>
            <div style="margin:24px 0 0;padding:14px 18px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:12px;color:#166534;">
              <strong>Im Leistungsumfang enthalten:</strong><br>
              &#10003; Alle Arbeiten durch qualifizierte Fachkräfte<br>
              &#10003; Sämtliche Materialien entsprechen aktuellen Normen und Vorschriften<br>
              &#10003; Abnahmeprotokoll nach Fertigstellung<br>
              &#10003; Garantie auf alle ausgeführten Arbeiten gemäß gesetzlichen Bestimmungen
            </div>
            <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
              Dieses Angebot ist <strong>vorläufig und unverbindlich</strong>.
              Es wird erst nach schriftlicher Bestätigung durch uns verbindlich.
              Das Angebot gilt 30 Tage ab Erstellungsdatum.
            </p>`;

        // ── Render via DocumentTemplateService ────────────────────────────
        let html;
        if (window.documentTemplateService) {
            html = await window.documentTemplateService.renderEmail(
                `Vorläufiges Angebot ${angebot.id}`,
                bodyHtml,
                {
                    company:      companyInfo,
                    portalUrl,
                    portalCtaLabel: 'Angebot ansehen &amp; freigeben →'
                }
            );
        } else {
            // Minimal fallback (documentTemplateService not yet loaded)
            html = `<html><body style="font-family:sans-serif;padding:24px">${bodyHtml}</body></html>`;
        }

        const result = await window.emailService.sendEmail(
            kundeEmail,
            `Vorläufiges Angebot ${angebot.id} – ${companyName}`,
            html
        );
        emailSent = result.success;
    }

    // 2. Update angebot status
    const savedAngebot = store.angebote.find(a => a.id === angebot.id);
    if (savedAngebot) {
        savedAngebot.status = 'vorläufig_gesendet';
        savedAngebot.vorlaeufigGesendetAt = new Date().toISOString();
        savedAngebot.vorlaeufigEmailSent = emailSent;
        saveStore();
    }

    // 3. Activity log
    addActivity('📨', `Vorläufiges Angebot ${angebot.id} ${emailSent ? 'an ' + kundeEmail + ' gesendet' : 'erstellt (E-Mail nicht konfiguriert)'}`);

    // 4. Supervisor notification — Handwerker must review/edit before customer confirms
    if (window.notificationService?.addNotification) {
        const emailNote = emailSent
            ? `E-Mail wurde automatisch an ${kundeEmail} gesendet.`
            : 'E-Mail konnte nicht automatisch gesendet werden — bitte manuell senden.';
        window.notificationService.addNotification(
            'angebot_vorlaeufig',
            `Vorläufiges Angebot ${angebot.id} gesendet`,
            `${kundeName} • ${angebot.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} • ${emailNote} Bitte prüfen Sie das Angebot und passen Sie es bei Bedarf an.`,
            { angebotId: angebot.id, kundeEmail, requiresAction: true }
        );
    }

    // 5. Create a supervisor task for the Handwerker
    if (window.taskService?.addTask) {
        window.taskService.addTask({
            title: `Vorläufiges Angebot prüfen: ${kundeName}`,
            description: `Angebot ${angebot.id} wurde automatisch als vorläufige Version ${emailSent ? 'an ' + kundeEmail + ' gesendet' : 'erstellt'}. ` +
                         `Bitte prüfen Sie das Angebot und passen Sie es bei Bedarf an, bevor der Kunde antwortet.`,
            priority: 'normal',
            status: 'offen',
            source: 'auto',
            sourceId: angebot.id,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
    }
}

// ============================================
// Event Delegation for Angebote Module
// ============================================

function initAngeboteEventDelegation() {
    // --- Angebote list (cards with action buttons) ---
    const angeboteList = document.getElementById('angebote-list');
    if (angeboteList) {
        angeboteList.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                const action = actionEl.dataset.action;
                e.stopPropagation();

                switch (action) {
                case 'navigate-anfragen':
                    window.navigationController?.navigateTo('anfragen');
                    return;
                case 'neue-anfrage':
                    document.getElementById('btn-neue-anfrage')?.click();
                    return;
                case 'switch-view':
                    switchView(actionEl.dataset.view);
                    return;
                case 'edit-angebot':
                    editAngebot(actionEl.dataset.id);
                    return;
                case 'preview-angebot':
                    previewAngebot(actionEl.dataset.id);
                    return;
                case 'delete-angebot':
                    deleteAngebot(actionEl.dataset.id);
                    return;
                case 'export-pdf':
                    exportAngebotPDF(actionEl.dataset.id);
                    return;
                case 'accept-angebot':
                    acceptAngebot(actionEl.dataset.id);
                    return;
                case 'copy-portal-link':
                    window.copyPortalLinkForKunde?.(actionEl.dataset.kundeId);
                    return;
                case 'show-angebot-detail':
                    // This is the card itself; handled below after action check
                    showAngebotDetail(actionEl.dataset.id);
                    return;
                }
            }

            // Card-level click (no specific action button hit) — open detail
            const card = e.target.closest('.item-card[data-action="show-angebot-detail"]');
            if (card) {
                showAngebotDetail(card.dataset.id);
            }
        });

        // Keyboard support for Enter on cards
        angeboteList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const card = e.target.closest('.item-card[data-action="show-angebot-detail"]');
                if (card) {
                    showAngebotDetail(card.dataset.id);
                }
            }
        });
    }

    // --- Positionen list (remove button + input updates) ---
    const positionenList = document.getElementById('positionen-list');
    if (positionenList) {
        positionenList.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) {return;}

            if (actionEl.dataset.action === 'remove-position') {
                actionEl.closest('.position-row')?.remove();
                updateAngebotSummary();
            }
        });

        positionenList.addEventListener('input', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (actionEl && actionEl.dataset.action === 'update-summary') {
                updateAngebotSummary();
            }
        });
    }

    // --- Angebot detail modal ---
    const detailContent = document.getElementById('angebot-detail-content');
    if (detailContent) {
        detailContent.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) {return;}

            const action = actionEl.dataset.action;
            e.stopPropagation();

            switch (action) {
            case 'switch-view':
                switchView(actionEl.dataset.view);
                return;
            case 'show-rechnung':
                window.showRechnung?.(actionEl.dataset.id);
                return;
            case 'close-detail-modal':
                closeModal('modal-angebot-detail');
                return;
            case 'accept-and-close-detail':
                acceptAngebot(actionEl.dataset.id);
                closeModal('modal-angebot-detail');
                return;
            case 'open-portal':
                (async () => {
                    const cid = actionEl.dataset.kundeId;
                    if (window.portalService && window.supabaseConfig?.isConfigured?.()) {
                        try { const { url } = await window.portalService.generateToken(cid); window.open(url, '_blank'); }
                        catch (err) { window.showToast?.('Portal-Fehler: ' + err.message, 'error'); }
                    } else if (window.customerPortalService) {
                        try { const link = await window.customerPortalService.generatePortalLink(cid, 'quote'); window.open(link.url, '_blank'); }
                        catch (err) { window.showToast?.('Portal-Fehler: ' + err.message, 'error'); }
                    }
                })();
                return;
            case 'copy-portal-link-detail':
                (async () => {
                    const cid = actionEl.dataset.kundeId;
                    if (window.portalService && window.supabaseConfig?.isConfigured?.()) {
                        try { await window.portalService.copyPortalLink(cid); }
                        catch (err) { window.showToast?.('Fehler: ' + err.message, 'error'); }
                    } else if (window.customerPortalService) {
                        try { const link = await window.customerPortalService.generatePortalLink(cid, 'quote'); await navigator.clipboard.writeText(link.url); window.showToast?.('Link kopiert', 'success'); }
                        catch (err) { window.showToast?.('Fehler: ' + err.message, 'error'); }
                    }
                })();
                return;
            }
        });
    }
}

// Export angebote functions
window.AngeboteModule = {
    createAngebotFromAnfrage,
    initAngebotForm,
    initAngeboteFilters,
    initAngeboteEventDelegation,
    addPosition,
    updateAngebotSummary,
    generateAIText,
    renderAngebote,
    editAngebot,
    deleteAngebot,
    acceptAngebot,
    previewAngebot,
    closeAngebotPreview,
    freigebenAngebot,
    showAngebotDetail,
    exportAngebotPDF
};

// Make globally available
window.createAngebotFromAnfrage = createAngebotFromAnfrage;
window.renderAngebote = renderAngebote;
window.initAngeboteFilters = initAngeboteFilters;
window.initAngeboteEventDelegation = initAngeboteEventDelegation;
window.addPosition = addPosition;
window.updateAngebotSummary = updateAngebotSummary;
window.acceptAngebot = acceptAngebot;
window.editAngebot = editAngebot;
window.deleteAngebot = deleteAngebot;
window.previewAngebot = previewAngebot;
window.closeAngebotPreview = closeAngebotPreview;
window.freigebenAngebot = freigebenAngebot;
window.showAngebotDetail = showAngebotDetail;
window.exportAngebotPDF = exportAngebotPDF;

})();
