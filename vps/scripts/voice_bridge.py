#!/usr/bin/env python3
"""Voice Bridge — Telegram Voice Messages -> STT -> Command -> TTS -> Voice Reply.

Wird als OpenClaw Skill aufgerufen (nicht als Daemon).
Workflow:
  1. Telegram Voice Message empfangen (via OpenClaw)
  2. Audio an freyai-voice STT senden -> Text
  3. Text als Kommando interpretieren (Smart Home / Allgemein)
  4. Antwort an freyai-voice TTS senden -> Audio
  5. Audio als Voice Message auf Telegram zurücksenden

CLI:
  python3 voice_bridge.py process <audio_file>    # Sprachnachricht verarbeiten
  python3 voice_bridge.py tts "Text hier"          # Text-to-Speech Test
  python3 voice_bridge.py stt <audio_file>         # Speech-to-Text Test
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error

VOICE_API = os.getenv("VOICE_API", "http://127.0.0.1:8900/api/voice")
HA_SCENES_SCRIPT = "/home/openclaw/workspace/scripts/ha_scenes.py"

# Smart Home Keyword-Erkennung
SCENE_KEYWORDS = {
    "gute nacht": "gute-nacht",
    "guten nacht": "gute-nacht",
    "schlafenszeit": "gute-nacht",
    "bin weg": "bin-weg",
    "ich gehe": "bin-weg",
    "tschüss": "bin-weg",
    "ich bin da": "zuhause",
    "bin zuhause": "zuhause",
    "bin zu hause": "zuhause",
    "arbeiten": "arbeiten",
    "arbeitszeit": "arbeiten",
    "kino": "kino",
    "film": "kino",
    "alles aus": "alles-aus",
    "notfall": "alles-aus",
}

ROOM_ALIASES = {
    "küche": "kueche",
    "kueche": "kueche",
    "wohnzimmer": "wohnzimmer",
    "bad": "bad",
    "badezimmer": "bad",
    "schlafzimmer": "schlafzimmer",
    "flur": "flur",
    "computer": "computer",
    "büro": "computer",
    "balkon": "balkon",
}


def stt(audio_file):
    """Speech-to-Text via freyai-voice API."""
    import mimetypes

    boundary = "----VoiceBridgeBoundary"
    mime = mimetypes.guess_type(audio_file)[0] or "audio/ogg"

    with open(audio_file, "rb") as f:
        audio_data = f.read()

    filename = os.path.basename(audio_file)
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="audio"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + audio_data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{VOICE_API}/stt",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            return result.get("text", ""), None
    except Exception as e:
        return None, str(e)


def tts(text, output_file=None):
    """Text-to-Speech via freyai-voice API."""
    if output_file is None:
        output_file = tempfile.mktemp(suffix=".wav")

    payload = json.dumps({"text": text}).encode()
    req = urllib.request.Request(
        f"{VOICE_API}/tts",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            audio_data = resp.read()
            with open(output_file, "wb") as f:
                f.write(audio_data)
            return output_file, None
    except Exception as e:
        return None, str(e)


def detect_smart_home_command(text):
    """Erkennt Smart-Home-Befehle im transkribierten Text."""
    text_lower = text.lower().strip()

    # Szenen-Erkennung
    for keyword, scene in SCENE_KEYWORDS.items():
        if keyword in text_lower:
            return {"type": "scene", "scene": scene}

    # Licht-Erkennung: "licht küche 50" oder "mach das licht in der küche an"
    light_match = re.search(
        r"licht\s+(?:in\s+(?:der|dem)\s+)?(\w+)\s*(?:auf\s+)?(\d+)?",
        text_lower,
    )
    if light_match:
        room_raw = light_match.group(1)
        brightness = light_match.group(2)
        room = ROOM_ALIASES.get(room_raw, room_raw)
        return {
            "type": "light",
            "room": room,
            "brightness": int(brightness) if brightness else 100,
        }

    # "Licht aus" / "Licht an"
    if "licht aus" in text_lower or "licht ab" in text_lower:
        return {"type": "scene", "scene": "alles-aus"}
    if "licht an" in text_lower:
        return {"type": "scene", "scene": "zuhause"}

    # Heizung-Erkennung
    heat_match = re.search(
        r"heizung\s+(?:in\s+(?:der|dem)\s+)?(\w+)\s*(?:auf\s+)?(\d+)",
        text_lower,
    )
    if heat_match:
        room_raw = heat_match.group(1)
        temp = heat_match.group(2)
        room = ROOM_ALIASES.get(room_raw, room_raw)
        return {"type": "climate", "room": room, "temperature": int(temp)}

    # Rollladen-Erkennung
    cover_match = re.search(
        r"(?:rollladen|rollo|rolladen)\s+(?:in\s+(?:der|dem)\s+)?(\w+)\s+(auf|zu|\d+)",
        text_lower,
    )
    if cover_match:
        room_raw = cover_match.group(1)
        position = cover_match.group(2)
        room = ROOM_ALIASES.get(room_raw, room_raw)
        return {"type": "cover", "room": room, "position": position}

    return None


def execute_smart_home(command):
    """Smart-Home-Befehl via ha_scenes.py ausführen."""
    if command["type"] == "scene":
        args = ["python3", HA_SCENES_SCRIPT, "scene", command["scene"]]
    elif command["type"] == "light":
        args = ["python3", HA_SCENES_SCRIPT, "light", command["room"], str(command["brightness"])]
    elif command["type"] == "climate":
        args = ["python3", HA_SCENES_SCRIPT, "climate", command["room"], str(command["temperature"])]
    elif command["type"] == "cover":
        args = ["python3", HA_SCENES_SCRIPT, "cover", command["room"], command["position"]]
    else:
        return "Unbekannter Befehlstyp"

    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=15)
        return result.stdout.strip() or result.stderr.strip() or "Ausgeführt."
    except Exception as e:
        return f"Fehler: {e}"


def generate_response_text(command, result):
    """Menschliche Antwort für TTS generieren."""
    if command["type"] == "scene":
        scene_names = {
            "gute-nacht": "Gute Nacht Szene",
            "bin-weg": "Bin Weg Szene",
            "zuhause": "Willkommen Zuhause Szene",
            "arbeiten": "Arbeits Szene",
            "kino": "Kino Szene",
            "alles-aus": "Alles Aus",
        }
        name = scene_names.get(command["scene"], command["scene"])
        return f"{name} aktiviert."
    elif command["type"] == "light":
        if command["brightness"] == 0:
            return f"Licht im {command['room']} ausgeschaltet."
        return f"Licht im {command['room']} auf {command['brightness']} Prozent."
    elif command["type"] == "climate":
        return f"Heizung im {command['room']} auf {command['temperature']} Grad."
    elif command["type"] == "cover":
        pos = "geöffnet" if command["position"] in ("auf", "open") else "geschlossen"
        return f"Rollladen im {command['room']} {pos}."
    return "Erledigt."


def process_voice(audio_file):
    """Kompletter Voice-Workflow: STT -> Erkennung -> Aktion -> TTS."""
    print(f"Verarbeite: {audio_file}")

    # 1. STT
    text, err = stt(audio_file)
    if err:
        print(f"STT Fehler: {err}")
        return None, f"Spracherkennung fehlgeschlagen: {err}"
    print(f"Erkannt: {text}")

    # 2. Smart Home Befehl erkennen
    command = detect_smart_home_command(text)
    if command:
        print(f"Smart Home Befehl: {command}")
        result = execute_smart_home(command)
        print(f"Ergebnis: {result}")
        response = generate_response_text(command, result)
    else:
        # Kein Smart-Home-Befehl — Text zurückgeben für OpenClaw
        response = None
        print("Kein Smart-Home-Befehl erkannt — Text wird an OpenClaw weitergeleitet.")
        return text, None

    # 3. TTS
    audio_out, err = tts(response)
    if err:
        print(f"TTS Fehler: {err}")
        return response, None

    print(f"TTS Audio: {audio_out}")
    return response, audio_out


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 voice_bridge.py process <audio_file>")
        print("  python3 voice_bridge.py tts \"Text hier\"")
        print("  python3 voice_bridge.py stt <audio_file>")
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "process":
        audio = sys.argv[2] if len(sys.argv) > 2 else ""
        if not audio or not os.path.exists(audio):
            print(f"Audio-Datei nicht gefunden: {audio}")
            sys.exit(1)
        response, audio_out = process_voice(audio)
        if audio_out:
            print(f"\nAntwort (Audio): {audio_out}")
        elif response:
            print(f"\nAntwort (Text): {response}")

    elif cmd == "tts":
        text = " ".join(sys.argv[2:])
        if not text:
            print("Kein Text angegeben.")
            sys.exit(1)
        out, err = tts(text)
        if err:
            print(f"Fehler: {err}")
        else:
            print(f"Audio: {out}")

    elif cmd == "stt":
        audio = sys.argv[2] if len(sys.argv) > 2 else ""
        if not audio or not os.path.exists(audio):
            print(f"Audio-Datei nicht gefunden: {audio}")
            sys.exit(1)
        text, err = stt(audio)
        if err:
            print(f"Fehler: {err}")
        else:
            print(f"Text: {text}")

    else:
        print(f"Unbekannt: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
