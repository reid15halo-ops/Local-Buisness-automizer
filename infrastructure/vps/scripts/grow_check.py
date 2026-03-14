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
