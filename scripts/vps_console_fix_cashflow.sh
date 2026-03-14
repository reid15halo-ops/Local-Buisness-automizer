#!/bin/bash
# Diesen gesamten Block in die Hostinger Web-Console kopieren und ausfuehren.
# Erstellt das Fix-Script auf dem VPS und fuehrt es aus.

python3 - << 'PYEOF'
import re, sys, shutil
from pathlib import Path
from datetime import datetime

TARGET = Path("/home/openclaw/workspace/scripts/cashflow_forecast.py")
BACKUP = TARGET.with_suffix(f".py.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")

if not TARGET.exists():
    print(f"FEHLER: {TARGET} nicht gefunden!")
    sys.exit(1)

shutil.copy2(TARGET, BACKUP)
print(f"Backup erstellt: {BACKUP}")

src = TARGET.read_text(encoding="utf-8")

# Fix 2: Remove sys.path.insert
src = re.sub(r'\s*sys\.path\.insert\(0,\s*["\']\/home\/openclaw\/workspace\/scripts["\']\)\s*\n', "\n", src)
print("Fix 2: sys.path.insert entfernt")

# Fix 1: Remove GEMINI_API_KEY lines
src = re.sub(r'GEMINI_API_KEY\s*=.*\n', "", src)
src = re.sub(r'import google\.generativeai.*\n', "", src)

# Remove gemini_request() function
gemini_fn_pattern = re.compile(r'\ndef gemini_request\(.*?\n(?=\ndef |\nclass |\nif __name__)', re.DOTALL)
src, count = gemini_fn_pattern.subn("", src)
if count:
    print(f"Fix 1: gemini_request() entfernt ({count} Match)")
else:
    gemini_fn_pattern2 = re.compile(r'def gemini_request\([^)]*\):.*?(?=\ndef |\nclass |\nif __name__)', re.DOTALL)
    src, count2 = gemini_fn_pattern2.subn("", src)
    print(f"Fix 1: gemini_request() (fallback, {count2} Match) entfernt")

src = re.sub(r'# Gemini.*?\n.*?GEMINI_API_KEY.*?\n(?:.*?os\.getenv.*?\n)?', "", src)
print("Fix 1: GEMINI_API_KEY-Block bereinigt")

# Fix 3a: Insert fmt_eur helper after last import
fmt_eur_func = '''
def fmt_eur(val):
    """Formatiert Zahl als deutschen Eurobetrag (Punkt=Tausender, Komma=Dezimal)."""
    s = f"{val:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".") + " EUR"

'''
lines = src.splitlines(keepends=True)
last_import_idx = 0
for i, line in enumerate(lines):
    if re.match(r'^(import |from )', line):
        last_import_idx = i
lines.insert(last_import_idx + 1, fmt_eur_func)
src = "".join(lines)
print("Fix 3a: fmt_eur() eingefuegt")

# Fix 3b: Replace :,.2f EUR in f-strings
src = re.sub(r'\{([^{}]+):,\.2f\}\s*EUR', lambda m: '{fmt_eur(' + m.group(1) + ')}', src)
print("Fix 3b: :,.2f EUR -> fmt_eur() ersetzt")

# Fix 4: datetime.now() -> datetime.now(timezone.utc)
if "from datetime import" in src:
    src = re.sub(
        r'from datetime import (datetime(?!.*timezone).*)',
        lambda m: f'from datetime import {m.group(1)}, timezone' if 'timezone' not in m.group(1) else m.group(0),
        src,
    )
else:
    src = re.sub(r'^(import datetime)', r'\1\nfrom datetime import timezone', src, flags=re.MULTILINE)
src = re.sub(r'datetime\.now\(\)', 'datetime.now(timezone.utc)', src)
print("Fix 4: datetime.now() -> datetime.now(timezone.utc)")

# Fix 7: Replace gemini_request() call
src = re.sub(
    r'gemini_request\(prompt\)',
    'freyai_common.gemini.generate(prompt, system_prompt="Du bist ein erfahrener Finanzberater und Cashflow-Analyst.", temperature=0.2, max_tokens=4000)',
    src,
)
print("Fix 7: gemini_request() -> freyai_common.gemini.generate()")

# Fix 5/6: Wrap main() body in try/except
main_pattern = re.compile(r'(def main\(\):\s*\n)((?:[ \t]+.*\n|\n)*)', re.MULTILINE)

def wrap_main(m):
    func_def = m.group(1)
    body = m.group(2)
    if "    try:" in body and "except Exception" in body:
        print("Fix 5/6: main() bereits gewrappt, uebersprungen")
        return m.group(0)
    body = re.sub(r'(\n    print\("Gespeichert\."\)\s*)$', '', body)
    indented_lines = []
    for line in body.splitlines(keepends=True):
        if line.strip() == "":
            indented_lines.append(line)
        else:
            indented_lines.append("    " + line)
    indented_body = "".join(indented_lines)
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

TARGET.write_text(src, encoding="utf-8")
print(f"\nFertig! Backup: {BACKUP}")

import subprocess
result = subprocess.run(["python3", "-m", "py_compile", str(TARGET)], capture_output=True, text=True)
if result.returncode == 0:
    print("Syntax-Check: OK")
else:
    print(f"SYNTAX-FEHLER:\n{result.stderr}")
    print(f"Backup wiederherstellen: cp {BACKUP} {TARGET}")
    sys.exit(1)
PYEOF
