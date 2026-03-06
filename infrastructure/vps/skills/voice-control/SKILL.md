---
name: voice-control
version: 1.0.0
description: Verarbeite Telegram-Sprachnachrichten — STT, Smart Home Steuerung, TTS Antwort
tags: voice, sprache, sprachnachricht, audio, stt, tts
triggers:
  - voice_message
  - sprachnachricht
  - audio
---

# Skill: Voice Control

Verarbeite Telegram-Sprachnachrichten via freyai-voice (Whisper STT + Piper TTS).

## Workflow

1. Telegram Voice Message empfangen
2. Audio an freyai-voice STT senden → Text
3. Text als Kommando interpretieren (Smart Home / Allgemein)
4. Antwort an freyai-voice TTS senden → Audio
5. Audio als Voice Message auf Telegram zurücksenden

## Befehle

```bash
# Sprachnachricht verarbeiten
python3 /home/openclaw/workspace/scripts/voice_bridge.py process <audio_file>

# TTS Test
python3 /home/openclaw/workspace/scripts/voice_bridge.py tts "Hallo Jonas"
```

## Smart Home Erkennung

Erkannte Schlüsselwörter in Sprachnachrichten:
- "Licht" + Raum + optional Helligkeit
- "Heizung" + Raum + optional Temperatur
- "Rollladen/Rollo" + Raum + auf/zu
- Szenen-Namen: gute-nacht, bin-weg, zuhause, arbeiten, kino

## API Endpoints

- STT: `POST http://127.0.0.1:8900/api/voice/stt` (multipart audio)
- TTS: `POST http://127.0.0.1:8900/api/voice/tts` (JSON text)
- Health: `GET http://127.0.0.1:8900/api/voice/health`
