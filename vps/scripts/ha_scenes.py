#!/usr/bin/env python3
"""Home Assistant Szenen & Steuerung — wird von OpenClaw aufgerufen.

Szenen:
  gute-nacht    Alle Lichter aus, Rollläden zu, Heizung Eco, TV aus
  bin-weg       Alles aus, Rollläden zu, Heizung Eco
  zuhause       Rollläden auf, Heizung Comfort, Willkommenslicht
  arbeiten      Computer-Bereich Licht an, Rest aus, Heizung Computer normal
  kino          Wohnzimmer dimmen, TV-Beleuchtung, Rest aus
  alles-aus     Notfall: alles ausschalten

Einzelsteuerung:
  light <raum> <helligkeit>       z.B. light kueche 50
  climate <raum> <temperatur>     z.B. climate bad 23
  cover <raum> <auf|zu|prozent>   z.B. cover schlafzimmer zu
  status                          Aktueller Status aller Geräte

CLI:
  python3 ha_scenes.py scene gute-nacht
  python3 ha_scenes.py light kueche 80
  python3 ha_scenes.py climate bad 22
  python3 ha_scenes.py cover schlafzimmer zu
  python3 ha_scenes.py status
"""

import json
import os
import sys
import urllib.request
import urllib.error

HA_URL = os.getenv("HA_URL", "http://127.0.0.1:8123")
HA_TOKEN = os.getenv("HA_TOKEN", "")

# Token aus Datei laden falls nicht in ENV
if not HA_TOKEN:
    token_file = os.path.expanduser("~/.ha_token")
    if os.path.exists(token_file):
        HA_TOKEN = open(token_file).read().strip()

HEADERS = {
    "Authorization": f"Bearer {HA_TOKEN}",
    "Content-Type": "application/json",
}

# --- Geräte-Mapping ---
LIGHTS = {
    "wohnzimmer": ["light.wohnzimmer_decke", "light.wohnzimmer_stehlampe"],
    "kueche": ["light.kuche_decke"],
    "bad": ["light.bad_decke"],
    "schlafzimmer": ["light.schlafzimmer_decke", "light.schlafzimmer_nachttisch"],
    "flur": ["light.flur_decke"],
    "computer": ["light.computer_schreibtisch"],
    "balkon": ["light.balkon"],
}

COVERS = {
    "wohnzimmer": ["cover.wohnzimmer_blind_curtain"],
    "kueche": ["cover.kuche_blind_curtain"],
    "schlafzimmer": ["cover.schlafzimmer_blind_curtain"],
    "bad": ["cover.bad_blind_curtain"],
}

CLIMATE = {
    "bad": "climate.thermostat_bad",
    "computer": "climate.thermostat_computer",
    "wohnzimmer": "climate.thermostat_wohnzimmer",
    "schlafzimmer": "climate.thermostat_schlafzimmer",
}

MEDIA_PLAYERS = {
    "tv": "media_player.samsung_tv",
    "wohnzimmer": "media_player.samsung_tv",
}

# --- Szenen ---
SCENES = {
    "gute-nacht": {
        "lights_off": list(LIGHTS.keys()),
        "covers_close": list(COVERS.keys()),
        "climate_eco": list(CLIMATE.keys()),
        "media_off": ["tv"],
    },
    "bin-weg": {
        "lights_off": list(LIGHTS.keys()),
        "covers_close": list(COVERS.keys()),
        "climate_eco": list(CLIMATE.keys()),
        "media_off": ["tv"],
    },
    "zuhause": {
        "lights_on": {"flur": 80},
        "covers_open": list(COVERS.keys()),
        "climate_comfort": {"wohnzimmer": 21, "bad": 22, "computer": 21, "schlafzimmer": 20},
    },
    "arbeiten": {
        "lights_on": {"computer": 100},
        "lights_off": ["wohnzimmer", "kueche", "schlafzimmer", "flur", "balkon"],
        "climate_comfort": {"computer": 22},
    },
    "kino": {
        "lights_on": {"wohnzimmer": 15},
        "lights_off": ["kueche", "flur", "computer", "schlafzimmer", "balkon"],
        "covers_close": ["wohnzimmer"],
    },
    "alles-aus": {
        "lights_off": list(LIGHTS.keys()),
        "covers_close": list(COVERS.keys()),
        "climate_eco": list(CLIMATE.keys()),
        "media_off": ["tv"],
    },
}

ECO_TEMP = 17
DEFAULT_COMFORT_TEMP = 21


def _ha_api(method, path, data=None):
    """Home Assistant API-Aufruf."""
    url = f"{HA_URL}/api/{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()[:200]}
    except Exception as e:
        return {"error": str(e)}


def _call_service(domain, service, entity_id, data=None):
    """HA Service aufrufen."""
    payload = {"entity_id": entity_id}
    if data:
        payload.update(data)
    return _ha_api("POST", f"services/{domain}/{service}", payload)


def set_light(room, brightness=None):
    """Licht setzen (0=aus, 1-100=an mit Helligkeit)."""
    entities = LIGHTS.get(room, [])
    if not entities:
        return f"Unbekannter Raum: {room}"

    results = []
    for entity in entities:
        if brightness is None or brightness == 0:
            r = _call_service("light", "turn_off", entity)
        else:
            r = _call_service("light", "turn_on", entity, {"brightness_pct": brightness})
        results.append(r)
    return results


def set_cover(room, position):
    """Rollladen steuern (auf/zu/0-100)."""
    entities = COVERS.get(room, [])
    if not entities:
        return f"Unbekannter Raum: {room}"

    results = []
    for entity in entities:
        if position in ("auf", "open"):
            r = _call_service("cover", "open_cover", entity)
        elif position in ("zu", "close"):
            r = _call_service("cover", "close_cover", entity)
        else:
            try:
                pos = int(position)
                r = _call_service("cover", "set_cover_position", entity, {"position": pos})
            except ValueError:
                return f"Ungültige Position: {position}"
        results.append(r)
    return results


def set_climate(room, temperature):
    """Heizung Temperatur setzen."""
    entity = CLIMATE.get(room)
    if not entity:
        return f"Unbekannter Raum: {room}"
    return _call_service("climate", "set_temperature", entity, {"temperature": float(temperature)})


def activate_scene(scene_name):
    """Szene aktivieren."""
    scene = SCENES.get(scene_name)
    if not scene:
        return f"Unbekannte Szene: {scene_name}. Verfügbar: {', '.join(SCENES.keys())}"

    results = []

    # Lichter aus
    for room in scene.get("lights_off", []):
        r = set_light(room, 0)
        results.append(f"  Licht {room} AUS")

    # Lichter an mit Helligkeit
    for room, brightness in scene.get("lights_on", {}).items():
        r = set_light(room, brightness)
        results.append(f"  Licht {room} {brightness}%")

    # Rollläden zu
    for room in scene.get("covers_close", []):
        r = set_cover(room, "zu")
        results.append(f"  Rollladen {room} ZU")

    # Rollläden auf
    for room in scene.get("covers_open", []):
        r = set_cover(room, "auf")
        results.append(f"  Rollladen {room} AUF")

    # Heizung Eco
    for room in scene.get("climate_eco", []):
        r = set_climate(room, ECO_TEMP)
        results.append(f"  Heizung {room} → {ECO_TEMP}°C (Eco)")

    # Heizung Comfort
    for room, temp in scene.get("climate_comfort", {}).items():
        r = set_climate(room, temp)
        results.append(f"  Heizung {room} → {temp}°C")

    # Media aus
    for device in scene.get("media_off", []):
        entity = MEDIA_PLAYERS.get(device)
        if entity:
            _call_service("media_player", "turn_off", entity)
            results.append(f"  {device} AUS")

    return results


def get_status():
    """Aktuellen Status aller Geräte abfragen."""
    output = ["=== Smart Home Status ==="]

    # Lichter
    output.append("\nLICHTER:")
    for room, entities in LIGHTS.items():
        for entity in entities:
            state = _ha_api("GET", f"states/{entity}")
            if isinstance(state, dict) and "error" not in state:
                s = state.get("state", "?")
                brightness = state.get("attributes", {}).get("brightness", "")
                pct = f" ({round(brightness/255*100)}%)" if brightness else ""
                output.append(f"  {room}: {s}{pct}")

    # Heizung
    output.append("\nHEIZUNG:")
    for room, entity in CLIMATE.items():
        state = _ha_api("GET", f"states/{entity}")
        if isinstance(state, dict) and "error" not in state:
            temp = state.get("attributes", {}).get("current_temperature", "?")
            target = state.get("attributes", {}).get("temperature", "?")
            output.append(f"  {room}: {temp}°C (Ziel: {target}°C)")

    # Rollläden
    output.append("\nROLLLÄDEN:")
    for room, entities in COVERS.items():
        for entity in entities:
            state = _ha_api("GET", f"states/{entity}")
            if isinstance(state, dict) and "error" not in state:
                s = state.get("state", "?")
                pos = state.get("attributes", {}).get("current_position", "")
                pct = f" ({pos}%)" if pos != "" else ""
                output.append(f"  {room}: {s}{pct}")

    return "\n".join(output)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 ha_scenes.py scene <name>")
        print("  python3 ha_scenes.py light <raum> <helligkeit>")
        print("  python3 ha_scenes.py climate <raum> <temperatur>")
        print("  python3 ha_scenes.py cover <raum> <auf|zu|prozent>")
        print("  python3 ha_scenes.py status")
        print(f"\nVerfügbare Szenen: {', '.join(SCENES.keys())}")
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "scene":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        result = activate_scene(name)
        if isinstance(result, list):
            print(f"Szene '{name}' aktiviert:")
            for r in result:
                print(r)
        else:
            print(result)

    elif cmd == "light":
        room = sys.argv[2] if len(sys.argv) > 2 else ""
        brightness = int(sys.argv[3]) if len(sys.argv) > 3 else None
        result = set_light(room, brightness)
        print(f"Licht {room}: {'AUS' if brightness == 0 or brightness is None else f'{brightness}%'}")

    elif cmd == "climate":
        room = sys.argv[2] if len(sys.argv) > 2 else ""
        temp = sys.argv[3] if len(sys.argv) > 3 else "21"
        set_climate(room, temp)
        print(f"Heizung {room} → {temp}°C")

    elif cmd == "cover":
        room = sys.argv[2] if len(sys.argv) > 2 else ""
        pos = sys.argv[3] if len(sys.argv) > 3 else "auf"
        set_cover(room, pos)
        print(f"Rollladen {room}: {pos}")

    elif cmd == "status":
        print(get_status())

    else:
        print(f"Unbekannter Befehl: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
