#!/usr/bin/env python3
"""HA Monitoring — Automations-Fehler, Energiebericht, Anomalie-Erkennung.

CLI:
  python3 ha_monitor.py check        # Fehler + Anomalien prüfen (täglich)
  python3 ha_monitor.py energy       # Wöchentlicher Energiebericht
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta

HA_URL = os.getenv("HA_URL", "http://127.0.0.1:8123")
HA_TOKEN = os.getenv("HA_TOKEN", "")

if not HA_TOKEN:
    import stat
    token_file = os.path.expanduser("~/.ha_token")
    if os.path.exists(token_file):
        mode = os.stat(token_file).st_mode
        if mode & (stat.S_IRGRP | stat.S_IROTH):
            print("WARNUNG: ~/.ha_token ist für andere Benutzer lesbar. Bitte ausführen: chmod 600 ~/.ha_token", file=sys.stderr)
        HA_TOKEN = open(token_file).read().strip()

HEADERS = {
    "Authorization": f"Bearer {HA_TOKEN}",
    "Content-Type": "application/json",
}

BATTERY_WARN_LEVEL = 20
WINDOW_OPEN_HEAT_WARN = True


def _ha_api(method, path):
    """HA API-Aufruf."""
    url = f"{HA_URL}/api/{path}"
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}


def check_automations():
    """Automationen auf Fehler/Deaktivierung prüfen."""
    states = _ha_api("GET", "states")
    if isinstance(states, dict) and "error" in states:
        return [f"API-Fehler: {states['error']}"]

    issues = []
    for s in states:
        eid = s.get("entity_id", "")
        if not eid.startswith("automation."):
            continue

        state = s.get("state", "")
        name = s.get("attributes", {}).get("friendly_name", eid)
        last_triggered = s.get("attributes", {}).get("last_triggered")

        if state == "off":
            issues.append(f"  DEAKTIVIERT: {name}")

        if last_triggered:
            try:
                lt = datetime.fromisoformat(last_triggered.replace("Z", "+00:00"))
                age = (datetime.now(lt.tzinfo) - lt).days
                if age > 30:
                    issues.append(f"  INAKTIV ({age}d): {name}")
            except (ValueError, TypeError):
                pass

    return issues


def check_batteries():
    """Batteriestände prüfen."""
    states = _ha_api("GET", "states")
    if isinstance(states, dict) and "error" in states:
        return []

    low = []
    for s in states:
        eid = s.get("entity_id", "")
        attrs = s.get("attributes", {})
        name = attrs.get("friendly_name", eid)

        # Sensor mit battery_level oder battery Attribut
        battery = None
        if "battery_level" in attrs:
            battery = attrs["battery_level"]
        elif "battery" in attrs:
            battery = attrs["battery"]
        elif eid.endswith("_battery") or "_battery_" in eid:
            try:
                battery = float(s.get("state", ""))
            except (ValueError, TypeError):
                pass

        if battery is not None:
            try:
                level = float(battery)
                if level < BATTERY_WARN_LEVEL:
                    low.append(f"  {name}: {level:.0f}%")
            except (ValueError, TypeError):
                pass

    return low


def check_anomalies():
    """Anomalien erkennen (z.B. Fenster offen + Heizung an)."""
    states = _ha_api("GET", "states")
    if isinstance(states, dict) and "error" in states:
        return []

    anomalies = []

    # Fenster-Status und Heizungen sammeln
    windows = {}
    climates = {}
    for s in states:
        eid = s.get("entity_id", "")
        state = s.get("state", "")
        name = s.get("attributes", {}).get("friendly_name", eid)

        if eid.startswith("binary_sensor.") and ("window" in eid or "fenster" in eid):
            windows[eid] = {"state": state, "name": name}
        elif eid.startswith("climate."):
            climates[eid] = {
                "state": state,
                "name": name,
                "temp": s.get("attributes", {}).get("temperature", 0),
            }

    # Fenster offen + Heizung aktiv
    if WINDOW_OPEN_HEAT_WARN:
        open_windows = [w for w in windows.values() if w["state"] == "on"]
        active_heaters = [c for c in climates.values() if c["state"] == "heat" and c["temp"] > 18]
        if open_windows and active_heaters:
            for w in open_windows:
                anomalies.append(f"  FENSTER OFFEN + HEIZUNG AN: {w['name']}")

    return anomalies


def daily_check():
    """Täglicher Gesundheitscheck."""
    print("=== HA Monitor Check ===")

    auto_issues = check_automations()
    if auto_issues:
        print(f"\nAUTOMATIONEN ({len(auto_issues)} Probleme):")
        for i in auto_issues:
            print(i)

    battery_issues = check_batteries()
    if battery_issues:
        print(f"\nBATTERIEN NIEDRIG ({len(battery_issues)}):")
        for i in battery_issues:
            print(i)

    anomalies = check_anomalies()
    if anomalies:
        print(f"\nANOMALIEN ({len(anomalies)}):")
        for a in anomalies:
            print(a)

    total = len(auto_issues) + len(battery_issues) + len(anomalies)
    if total == 0:
        print("\nAlles OK — keine Probleme gefunden.")
    else:
        print(f"\n{total} Problem(e) insgesamt.")

    return total


def energy_report():
    """Wöchentlicher Energiebericht."""
    print("=== Wöchentlicher Energiebericht ===\n")

    states = _ha_api("GET", "states")
    if isinstance(states, dict) and "error" in states:
        print(f"API-Fehler: {states['error']}")
        return

    energy_sensors = []
    for s in states:
        eid = s.get("entity_id", "")
        attrs = s.get("attributes", {})
        unit = attrs.get("unit_of_measurement", "")

        if unit in ("kWh", "Wh", "W") or "energy" in eid or "power" in eid:
            name = attrs.get("friendly_name", eid)
            try:
                value = float(s.get("state", 0))
                energy_sensors.append({"name": name, "value": value, "unit": unit, "id": eid})
            except (ValueError, TypeError):
                pass

    if not energy_sensors:
        print("Keine Energie-Sensoren gefunden.")
        return

    # Sortiert nach Verbrauch
    energy_sensors.sort(key=lambda x: x["value"], reverse=True)

    print(f"{'Sensor':<40} {'Wert':>10} {'Einheit':>6}")
    print("-" * 60)
    for s in energy_sensors[:20]:
        print(f"{s['name'][:40]:<40} {s['value']:>10.1f} {s['unit']:>6}")

    total_kwh = sum(s["value"] for s in energy_sensors if s["unit"] == "kWh")
    if total_kwh > 0:
        print(f"\nGesamt: {total_kwh:.1f} kWh")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 ha_monitor.py [check|energy]")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "check":
        daily_check()
    elif cmd == "energy":
        energy_report()
    else:
        print(f"Unbekannt: {cmd}. Verfügbar: check, energy")
        sys.exit(1)


if __name__ == "__main__":
    main()
