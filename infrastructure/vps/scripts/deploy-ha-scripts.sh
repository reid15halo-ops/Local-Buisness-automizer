#!/bin/bash
# Deploy-Script: Refactored ha_monitor.py + grow_check.py auf VPS
# Ausfuehren als openclaw auf dem VPS (z.B. via Hostinger Console)
# Befehl: bash /tmp/deploy-ha-scripts.sh

set -e

SCRIPTS_DIR="/home/openclaw/workspace/scripts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== Backup erstellen ==="
cp "$SCRIPTS_DIR/ha_monitor.py" "$SCRIPTS_DIR/ha_monitor.py.bak.$TIMESTAMP"
echo "Backup: ha_monitor.py.bak.$TIMESTAMP"

if [ -f "$SCRIPTS_DIR/grow_check.py" ]; then
    cp "$SCRIPTS_DIR/grow_check.py" "$SCRIPTS_DIR/grow_check.py.bak.$TIMESTAMP"
    echo "Backup: grow_check.py.bak.$TIMESTAMP"
fi

echo ""
echo "=== ha_monitor.py schreiben ==="
cat > "$SCRIPTS_DIR/ha_monitor.py" << 'HAMONITOR_EOF'
#!/usr/bin/env python3
"""HA Monitoring — Automations-Fehler, Batteriestatus, Anomalie-Erkennung, Energiebericht.

CLI:
  python3 ha_monitor.py check        # Fehler + Anomalien prüfen (täglich)
  python3 ha_monitor.py energy       # Wöchentlicher Energiebericht
"""

import sys
from datetime import datetime

from freyai_common import ha, telegram

BATTERY_WARN_LEVEL = 20
WINDOW_OPEN_HEAT_WARN = True


def check_automations(states):
    """Automationen auf Fehler/Deaktivierung prüfen."""
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


def check_batteries(states):
    """Batteriestände prüfen."""
    low = []
    for s in states:
        eid = s.get("entity_id", "")
        attrs = s.get("attributes", {})
        name = attrs.get("friendly_name", eid)

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


def check_anomalies(states):
    """Anomalien erkennen (z.B. Fenster offen + Heizung an)."""
    anomalies = []

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

    if WINDOW_OPEN_HEAT_WARN:
        open_windows = [w for w in windows.values() if w["state"] == "on"]
        active_heaters = [c for c in climates.values() if c["state"] == "heat" and c["temp"] > 18]
        if open_windows and active_heaters:
            for w in open_windows:
                anomalies.append(f"  FENSTER OFFEN + HEIZUNG AN: {w['name']}")

    return anomalies


def check_all():
    """Täglicher Gesundheitscheck — states einmal holen, an alle Checks weitergeben."""
    states = ha.get("states")
    if isinstance(states, dict) and "error" in states:
        msg = f"HA Monitor: API-Fehler beim States-Abruf: {states['error']}"
        telegram.send(msg)
        print(msg)
        return 1

    auto_issues = check_automations(states)
    battery_issues = check_batteries(states)
    anomalies = check_anomalies(states)

    lines = ["=== HA Monitor Check ==="]

    if auto_issues:
        lines.append(f"\nAUTOMATIONEN ({len(auto_issues)} Probleme):")
        lines.extend(auto_issues)

    if battery_issues:
        lines.append(f"\nBATTERIEN NIEDRIG ({len(battery_issues)}):")
        lines.extend(battery_issues)

    if anomalies:
        lines.append(f"\nANOMALIEN ({len(anomalies)}):")
        lines.extend(anomalies)

    total = len(auto_issues) + len(battery_issues) + len(anomalies)
    if total == 0:
        lines.append("\nAlles OK — keine Probleme gefunden.")
    else:
        lines.append(f"\n{total} Problem(e) insgesamt.")
        telegram.send("\n".join(lines))

    print("\n".join(lines))
    return total


def energy_report():
    """Wöchentlicher Energiebericht."""
    print("=== Wöchentlicher Energiebericht ===\n")

    states = ha.get("states")
    if isinstance(states, dict) and "error" in states:
        msg = f"HA Energiebericht: API-Fehler: {states['error']}"
        telegram.send(msg)
        print(msg)
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
        check_all()
    elif cmd == "energy":
        energy_report()
    else:
        print(f"Unbekannt: {cmd}. Verfügbar: check, energy")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        msg = f"HA Monitor: Unerwarteter Fehler: {e}"
        try:
            telegram.send(msg)
        except Exception:
            pass
        print(msg, file=sys.stderr)
        sys.exit(1)
HAMONITOR_EOF

chmod +x "$SCRIPTS_DIR/ha_monitor.py"
echo "ha_monitor.py geschrieben."

echo ""
echo "=== grow_check.py schreiben ==="

# Aktuelle VPS-Version lesen und sichern (falls vorhanden)
GROW_CHECK="$SCRIPTS_DIR/grow_check.py"

cat > "$GROW_CHECK" << 'GROWCHECK_EOF'
#!/usr/bin/env python3
"""Pflanzenpflege-Check — Feuchtigkeit, Temperatur, Beleuchtung aus HA-Sensoren.

Liest Pflanzensensoren aus Home Assistant und warnt bei kritischen Werten.
Warnungen werden per Telegram gesendet.

CLI:
  python3 grow_check.py
"""

import sys

from freyai_common import ha, telegram

# Schwellwerte
MOISTURE_WARN_LOW = 20    # % — unter diesem Wert: zu trocken
MOISTURE_WARN_HIGH = 80   # % — über diesem Wert: zu nass
TEMP_WARN_LOW = 15        # °C — unter diesem Wert: zu kalt
TEMP_WARN_HIGH = 35       # °C — über diesem Wert: zu heiß
ILLUMINANCE_WARN_LOW = 500  # lx — unter diesem Wert: zu dunkel


def check_plants(states):
    """Pflanzensensoren aus HA-States auslesen und prüfen."""
    warnings = []

    for s in states:
        eid = s.get("entity_id", "")
        attrs = s.get("attributes", {})
        name = attrs.get("friendly_name", eid)
        unit = attrs.get("unit_of_measurement", "")

        # Feuchtigkeitssensoren (Pflanzen)
        if ("moisture" in eid or "feuchtigkeit" in eid or "soil" in eid) and unit == "%":
            try:
                value = float(s.get("state", ""))
                if value < MOISTURE_WARN_LOW:
                    warnings.append(f"  TROCKEN ({value:.0f}%): {name}")
                elif value > MOISTURE_WARN_HIGH:
                    warnings.append(f"  ZU NASS ({value:.0f}%): {name}")
            except (ValueError, TypeError):
                pass

        # Temperatur-Sensoren (Pflanzbereich)
        elif ("plant" in eid or "grow" in eid or "pflanz" in eid) and unit == "°C":
            try:
                value = float(s.get("state", ""))
                if value < TEMP_WARN_LOW:
                    warnings.append(f"  ZU KALT ({value:.1f}°C): {name}")
                elif value > TEMP_WARN_HIGH:
                    warnings.append(f"  ZU HEISS ({value:.1f}°C): {name}")
            except (ValueError, TypeError):
                pass

        # Beleuchtungssensoren (Pflanzen)
        elif ("plant" in eid or "grow" in eid or "pflanz" in eid) and unit in ("lx", "lux"):
            try:
                value = float(s.get("state", ""))
                if value < ILLUMINANCE_WARN_LOW:
                    warnings.append(f"  ZU DUNKEL ({value:.0f} lx): {name}")
            except (ValueError, TypeError):
                pass

    return warnings


def main():
    states = ha.get("states")
    if isinstance(states, dict) and "error" in states:
        msg = f"Grow-Check: API-Fehler: {states['error']}"
        telegram.send(msg)
        print(msg, file=sys.stderr)
        sys.exit(1)

    warnings = check_plants(states)

    if warnings:
        lines = ["=== Grow-Check: Warnungen ==="]
        lines.extend(warnings)
        lines.append(f"\n{len(warnings)} Warnung(en) insgesamt.")
        message = "\n".join(lines)
        print(message)
        telegram.send(message)
    else:
        print("Grow-Check: Alles OK.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        msg = f"Grow-Check: Unerwarteter Fehler: {e}"
        try:
            telegram.send(msg)
        except Exception:
            pass
        print(msg, file=sys.stderr)
        sys.exit(1)
GROWCHECK_EOF

chmod +x "$GROW_CHECK"
echo "grow_check.py geschrieben."

echo ""
echo "=== Syntax-Check ==="
python3 -m py_compile "$SCRIPTS_DIR/ha_monitor.py" && echo "ha_monitor.py: OK"
python3 -m py_compile "$SCRIPTS_DIR/grow_check.py" && echo "grow_check.py: OK"

echo ""
echo "=== Fertig ==="
echo "Backups: *.bak.$TIMESTAMP"
echo "Zum Testen: cd $SCRIPTS_DIR && python3 ha_monitor.py check"
