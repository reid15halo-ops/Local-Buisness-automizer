#!/usr/bin/env python3
"""
Fix-Script fuer cashflow_forecast.py auf dem VPS.
Ausfuehren auf dem VPS: python3 fix_cashflow_forecast.py

Fixes:
1. Remove duplicate Gemini client (GEMINI_API_KEY + gemini_request())
2. Remove hardcoded sys.path.insert
3. Fix German number format (fmt_eur helper)
4. Fix datetime.now() -> datetime.now(timezone.utc)
5. Add top-level try/except in main()
6. Fix "Gespeichert." inside try block
7. Replace gemini_request() call with freyai_common.gemini.generate()
"""

import re
import sys
import shutil
from pathlib import Path
from datetime import datetime

TARGET = Path("/home/openclaw/workspace/scripts/cashflow_forecast.py")
BACKUP = TARGET.with_suffix(f".py.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")

if not TARGET.exists():
    print(f"FEHLER: {TARGET} nicht gefunden!")
    sys.exit(1)

# Backup
shutil.copy2(TARGET, BACKUP)
print(f"Backup erstellt: {BACKUP}")

src = TARGET.read_text(encoding="utf-8")
original = src

# -------------------------------------------------------------------------
# Fix 2: Remove sys.path.insert line
# -------------------------------------------------------------------------
src = re.sub(
    r'\s*sys\.path\.insert\(0,\s*["\']\/home\/openclaw\/workspace\/scripts["\']\)\s*\n',
    "\n",
    src,
)
print("Fix 2: sys.path.insert entfernt")

# -------------------------------------------------------------------------
# Fix 1: Remove GEMINI_API_KEY loading block and gemini_request() function
# We need to remove:
#   - GEMINI_API_KEY = ... lines
#   - import google.generativeai / import requests lines used only for Gemini
#   - The gemini_request() function definition
#
# Strategy: find and remove the block between GEMINI_API_KEY and end of gemini_request()
# -------------------------------------------------------------------------

# Remove GEMINI_API_KEY assignment line(s)
src = re.sub(
    r'GEMINI_API_KEY\s*=.*\n',
    "",
    src,
)

# Remove standalone google.generativeai import if present
src = re.sub(
    r'import google\.generativeai.*\n',
    "",
    src,
)

# Remove the gemini_request() function entirely
# Match from "def gemini_request(" up to (but not including) the next top-level "def " or "class "
gemini_fn_pattern = re.compile(
    r'\ndef gemini_request\(.*?\n(?=\ndef |\nclass |\nif __name__)',
    re.DOTALL,
)
src, count = gemini_fn_pattern.subn("", src)
if count:
    print(f"Fix 1: gemini_request()-Funktion entfernt ({count} Match)")
else:
    # Fallback: try without lookahead (in case spacing differs)
    gemini_fn_pattern2 = re.compile(
        r'def gemini_request\([^)]*\):.*?(?=\ndef |\nclass |\nif __name__)',
        re.DOTALL,
    )
    src, count2 = gemini_fn_pattern2.subn("", src)
    print(f"Fix 1: gemini_request()-Funktion (fallback, {count2} Match) entfernt")

# Remove GEMINI_API_KEY block with try/except if it exists (common pattern for env loading)
src = re.sub(
    r'# Gemini.*?\n.*?GEMINI_API_KEY.*?\n(?:.*?os\.getenv.*?\n)?',
    "",
    src,
)
print("Fix 1: GEMINI_API_KEY-Block entfernt")

# -------------------------------------------------------------------------
# Fix 3: Add fmt_eur helper after imports block, replace {val:,.2f} EUR patterns
# -------------------------------------------------------------------------

# Add fmt_eur function after the last import statement
fmt_eur_func = '''
def fmt_eur(val):
    """Formatiert Zahl als deutschen Eurobetrag (Punkt=Tausender, Komma=Dezimal)."""
    s = f"{val:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".") + " EUR"

'''

# Insert after the last top-level import line (find last "^import " or "^from " line)
lines = src.splitlines(keepends=True)
last_import_idx = 0
for i, line in enumerate(lines):
    if re.match(r'^(import |from )', line):
        last_import_idx = i

# Insert fmt_eur after the last import line
lines.insert(last_import_idx + 1, fmt_eur_func)
src = "".join(lines)
print("Fix 3a: fmt_eur()-Funktion eingefuegt")

# Replace {val:,.2f} EUR patterns in f-strings inside sende_telegram
# Pattern: {some_expression:,.2f} EUR  ->  {fmt_eur(some_expression)}
src = re.sub(
    r'\{([^{}]+):,\.2f\}\s*EUR',
    lambda m: '{fmt_eur(' + m.group(1) + ')}',
    src,
)
print("Fix 3b: :,.2f EUR -> fmt_eur() ersetzt")

# -------------------------------------------------------------------------
# Fix 4: datetime.now() -> datetime.now(timezone.utc) in speichere_prognose
# -------------------------------------------------------------------------

# Ensure timezone is imported
if "from datetime import" in src:
    # Add timezone to existing datetime import if not already there
    src = re.sub(
        r'from datetime import (datetime(?!.*timezone).*)',
        lambda m: f'from datetime import {m.group(1)}, timezone'
        if 'timezone' not in m.group(1) else m.group(0),
        src,
    )
else:
    src = re.sub(
        r'^(import datetime)',
        r'\1\nfrom datetime import timezone',
        src,
        flags=re.MULTILINE,
    )

# Replace datetime.now() with datetime.now(timezone.utc) -- only bare call without args
src = re.sub(
    r'datetime\.now\(\)',
    'datetime.now(timezone.utc)',
    src,
)
print("Fix 4: datetime.now() -> datetime.now(timezone.utc)")

# -------------------------------------------------------------------------
# Fix 7: Replace gemini_request(prompt) call with freyai_common.gemini.generate()
# -------------------------------------------------------------------------
src = re.sub(
    r'gemini_request\(prompt\)',
    'freyai_common.gemini.generate(prompt, system_prompt="Du bist ein erfahrener Finanzberater und Cashflow-Analyst.", temperature=0.2, max_tokens=4000)',
    src,
)
print("Fix 7: gemini_request(prompt) -> freyai_common.gemini.generate() ersetzt")

# -------------------------------------------------------------------------
# Fix 5 & 6: Wrap main() body in try/except, move "Gespeichert." inside try
# -------------------------------------------------------------------------

# Find main() function and wrap its body
# We look for "def main():" and then indent everything in its body

main_pattern = re.compile(
    r'(def main\(\):\s*\n)((?:[ \t]+.*\n|\n)*)',
    re.MULTILINE,
)

def wrap_main(m):
    func_def = m.group(1)
    body = m.group(2)

    # Check if already wrapped
    if "    try:" in body and "except Exception" in body:
        print("Fix 5/6: main() ist bereits gewrappt, uebersprungen")
        return m.group(0)

    # Remove trailing "Gespeichert." print if it's outside try (standalone at end)
    body = re.sub(r'(\n    print\("Gespeichert\."\)\s*)$', '', body)

    # Indent body lines by 4 more spaces (they go inside try:)
    indented_lines = []
    for line in body.splitlines(keepends=True):
        if line.strip() == "":
            indented_lines.append(line)
        else:
            indented_lines.append("    " + line)
    indented_body = "".join(indented_lines)

    telegram_import_hint = ""
    new_body = (
        "    try:\n"
        + indented_body
        + '        print("Gespeichert.")\n'
        + "    except Exception as e:\n"
        + "        import traceback\n"
        + '        err_msg = f"Cashflow-Prognose Fehler: {e}\\n{traceback.format_exc()}"\n'
        + '        print(err_msg, file=sys.stderr)\n'
        + "        try:\n"
        + '            sende_telegram(err_msg[:4000])\n'
        + "        except Exception:\n"
        + "            pass\n"
        + "        sys.exit(1)\n"
    )
    print("Fix 5/6: main() mit try/except gewrappt")
    return func_def + new_body

src = main_pattern.sub(wrap_main, src)

# -------------------------------------------------------------------------
# Write result
# -------------------------------------------------------------------------
TARGET.write_text(src, encoding="utf-8")
print(f"\nFertig! Alle Fixes angewendet. Original-Backup: {BACKUP}")
print("\nQuick-Check (Syntax):")
import subprocess
result = subprocess.run(
    ["python3", "-m", "py_compile", str(TARGET)],
    capture_output=True, text=True
)
if result.returncode == 0:
    print("  Syntax OK")
else:
    print(f"  SYNTAX-FEHLER:\n{result.stderr}")
    print(f"  Backup wiederherstellen: cp {BACKUP} {TARGET}")
    sys.exit(1)
