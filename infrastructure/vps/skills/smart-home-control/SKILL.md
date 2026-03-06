---
name: smart-home-control
version: 1.0.0
description: Steuere Smart Home Geräte und aktiviere Szenen via Home Assistant
tags: smarthome, licht, heizung, rollladen, szene, home-assistant
triggers:
  - licht
  - heizung
  - rollladen
  - szene
  - smart home
---

# Skill: Smart Home Control

Steuere Home Assistant Geräte und aktiviere Szenen über Telegram.

## Szenen

```bash
python3 /home/openclaw/workspace/scripts/ha_scenes.py scene <name>
```

| Szene | Beschreibung |
|-------|-------------|
| gute-nacht | Alle Lichter aus, Rollläden zu, Heizung Eco, TV aus |
| bin-weg | Alles aus, Rollläden zu, Heizung Eco |
| zuhause | Rollläden auf, Heizung Comfort, Willkommenslicht |
| arbeiten | Computer-Bereich Licht an, Rest aus, Heizung normal |
| kino | Wohnzimmer dimmen, TV-Beleuchtung, Rest aus |
| alles-aus | Notfall: alles ausschalten |

## Einzelsteuerung

```bash
python3 /home/openclaw/workspace/scripts/ha_scenes.py light <raum> <helligkeit>
python3 /home/openclaw/workspace/scripts/ha_scenes.py climate <raum> <temperatur>
python3 /home/openclaw/workspace/scripts/ha_scenes.py cover <raum> <auf|zu|prozent>
```

## Status

```bash
python3 /home/openclaw/workspace/scripts/ha_scenes.py status
```

## Verhalten

- Bei Szenen-Befehlen: Ausführen und kurz bestätigen
- Bei Status-Anfragen: Kompakten Überblick senden
- KEIN Telegram-Spam bei Cron-Ausführung
