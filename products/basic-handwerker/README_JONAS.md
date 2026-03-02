# FreyAI Visions — Basic Handwerker Paket
## Deployment-Anleitung für Jonas

---

## Preismodell

| | Normalpreis | Aktionspreis (alle 3 Monate, 2 Wochen) |
|---|---|---|
| **Setup** | ~~€249~~ | **Kostenlos** |
| **Monatlich** | ~~€199/Monat~~ | **€119/Monat** |

**Tatsächlicher Business-Preis: €119/Monat** (darauf ausgelegt)
- 10 Kunden → **€1.190/Monat**
- 20 Kunden → **€2.380/Monat**

### FOMO-Rhythmus
- Jedes Quartal für 2 Wochen: "🔥 Frühjahrs-Angebot / Sommer-Aktion / Herbst-Special / Winter-Deal"
- Banner auf Landing Page aktivieren, Countdown einbauen
- Kunden die fragen: immer "Aktionspreis" anbieten (ist der echte Preis)

---

## Neuen Kunden einrichten — 3 Schritte

### Schritt 1: Ordner kopieren
```bash
cp -r products/basic-handwerker/ /var/www/kunden/KUNDENNAME/
cd /var/www/kunden/KUNDENNAME/
```

### Schritt 2: Config anpassen
```bash
nano config.js
# ODER: Admin-Panel nutzen (empfohlen)
```

### Schritt 3: Server starten
```bash
# Admin-Passwort setzen und Server starten
ADMIN_PASSWORD=geheimesPasswort123 node server.js &

# Oder dauerhaft mit PM2:
pm2 start server.js --name "handwerk-KUNDENNAME" \
    --env ADMIN_PASSWORD=geheimesPasswort123 \
    --env PORT=3002
pm2 save
```

---

## Nginx Vhost (pro Kunde)

```nginx
server {
    listen 80;
    server_name KUNDENNAME.de www.KUNDENNAME.de;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

SSL mit Certbot:
```bash
certbot --nginx -d KUNDENNAME.de -d www.KUNDENNAME.de
```

---

## Ports-Übersicht (Beispiel)

| Kunde | Port | PM2-Name |
|---|---|---|
| Mustermann Sanitär | 3001 | handwerk-mustermann |
| Huber Elektro | 3002 | handwerk-huber |
| ... | 300X | ... |

---

## Was der Kunde selbst ändern kann (Admin-Panel)

URL: `https://KUNDENNAME.de/admin.html`

| Bereich | Änderbar |
|---|---|
| Firmenname, Telefon, E-Mail, Adresse | ✅ |
| Slogan, Haupttext | ✅ |
| Leistungen (bis 6) | ✅ |
| Zahlen & Fakten (4 Felder) | ✅ |
| Über-uns-Text | ✅ |
| Kundenstimmen (bis 3) | ✅ |
| Fotos (Hero + Teamfoto) | ✅ |
| Layout, Farben, Struktur | ❌ (nicht möglich) |

---

## Kundenanleitung (an Kunden schicken)

> **Ihre Website bearbeiten:**
> 1. Gehen Sie auf `https://IhreDomain.de/admin.html`
> 2. Melden Sie sich mit Ihrem Passwort an: `XXXXXX`
> 3. Ändern Sie die gewünschten Texte oder Fotos
> 4. Klicken Sie auf **💾 Speichern**
> 5. Die Website ist sofort aktualisiert
>
> Bei Fragen: Jonas Frey — support@freyaivisions.de

---

## Formspree einrichten (Kontaktformular)

1. Kostenloser Account auf https://formspree.io
2. Neues Formular anlegen
3. Endpoint-URL (z.B. `https://formspree.io/f/xabcdef`) in `config.js` eintragen:
   ```js
   contact: { form_endpoint: "https://formspree.io/f/xabcdef" }
   ```

---

## Enthaltene Pakete & Wartung

| Was | Aufwand Jonas |
|---|---|
| Ersteinrichtung (Config + Server) | ~30 Min pro Kunde |
| Domain + SSL einrichten | ~15 Min |
| Kleinere Änderungen (außerhalb Admin) | Paket: 1h/Monat inklusive |
| Foto-Austausch falls gewünscht | Per E-Mail, ~5 Min |

---

*© 2026 FreyAI Visions — Intern — nicht an Kunden weitergeben*
