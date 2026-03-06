---
name: content-pipeline
version: 1.0.0
description: Generiere und plane Social-Media-Content für FreyAI Visions via Postiz
tags: content, social-media, linkedin, instagram, marketing, postiz
triggers:
  - content
  - post
  - social media
  - linkedin
  - marketing
---

# Skill: Content Pipeline

Du steuerst die automatisierte Content-Erstellung und Social-Media-Planung für FreyAI Visions.

## Verfügbare Befehle

### Content generieren
```bash
python3 /home/openclaw/workspace/scripts/content_pipeline.py generate
```
Generiert 5 Posts pro Woche:
- 2x Praxis-Tipps für Handwerker
- 1x Behind the Scenes
- 1x Mini-Case-Study
- 1x Branchen-Insight

### Posts einplanen
```bash
python3 /home/openclaw/workspace/scripts/content_pipeline.py schedule
```
Plant generierte Posts in Postiz ein (optimale Zeiten: Di-Do 08:30/17:00 LinkedIn, Mo/Mi/Fr 12:00/18:30 Instagram).

### Ideen vorschlagen
```bash
python3 /home/openclaw/workspace/scripts/content_pipeline.py suggest
```
Generiert 5 neue Content-Ideen basierend auf aktuellen Handwerk-Trends.

### Engagement-Report
```bash
python3 /home/openclaw/workspace/scripts/content_pipeline.py report
```
Zeigt Performance der letzten 7 Tage.

## Verhalten bei Cron-Aufruf

- KEIN "Hallo Jonas" oder ähnliche Begrüßung senden
- Führe den Befehl STILL im Hintergrund aus
- Sende NUR eine Telegram-Nachricht wenn:
  - Ein Post viral geht (>500 Impressionen)
  - Ein Fehler bei der Generierung auftritt
  - Jonas explizit nach dem Status fragt
- Bei Routine-Generierung: NUR intern loggen, NICHT auf Telegram senden

## Wenn Jonas fragt

- "Was wurde diese Woche gepostet?" → `report` ausführen
- "Neue Content-Ideen" → `suggest` ausführen
- "Posts für nächste Woche" → `generate` dann `schedule`
- "Stopp Content" → Keine weiteren Posts generieren bis Jonas es wieder aktiviert
