#!/usr/bin/env python3
"""Fix Postiz Posts — Layout-Fix + Repost-Cleanup + Duplikat-Check.

Holt alle geplanten Posts aus der Postiz API, fixt Markdown-Formatierung,
entfernt ungewollte Reposts und dedupliziert Posts pro Plattform.

Usage:
  python3 fix_postiz_posts.py preview        # Zeigt was gefixt wird (dry-run)
  python3 fix_postiz_posts.py fix            # Führt Layout-Fixes durch
  python3 fix_postiz_posts.py delete-reposts # Löscht alle rp_* Repost-Posts
  python3 fix_postiz_posts.py dedup          # Duplikate pro Plattform entfernen
  python3 fix_postiz_posts.py all            # Alles: preview + fix + dedup + delete-reposts
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error

POSTIZ_URL = os.getenv("POSTIZ_URL", "http://127.0.0.1:5000")
POSTIZ_API_KEY = os.getenv("POSTIZ_API_KEY", "")


def _api(method, url, data=None):
    """HTTP-Request an Postiz API."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {POSTIZ_API_KEY}",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()[:500]}
    except Exception as e:
        return {"error": str(e)}


def _strip_markdown(text):
    """Markdown-Formatierung entfernen für Social-Media-Posts."""
    # Headers (## Header -> Header)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Bold/Italic (**text** / *text* / __text__ / _text_)
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', text)
    # Inline code (`code`)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Links [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Bullet points (- item / * item -> item)
    text = re.sub(r'^[\s]*[-*+]\s+', '• ', text, flags=re.MULTILINE)
    # Literal \n sequences (escaped newlines from bad formatting)
    text = text.replace('\\n', '\n')
    # Collapse 3+ newlines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _has_markdown(text):
    """Prüft ob Text Markdown-Formatierung enthält."""
    patterns = [
        r'^#{1,6}\s+',           # Headers
        r'\*{2,3}[^*]+\*{2,3}',  # Bold
        r'`[^`]+`',              # Inline code
        r'\[[^\]]+\]\([^)]+\)',   # Links
        r'\\n',                  # Escaped newlines
    ]
    for p in patterns:
        if re.search(p, text, re.MULTILINE):
            return True
    return False


def _fetch_all_posts(include_posted=False):
    """Alle Posts holen (scheduled, draft, optional posted)."""
    posts = []
    statuses = ["scheduled", "draft"]
    if include_posted:
        statuses.append("posted")
    for status in statuses:
        resp = _api("GET", f"{POSTIZ_URL}/api/posts?status={status}")
        if isinstance(resp, list):
            posts.extend(resp)
        elif isinstance(resp, dict) and "posts" in resp:
            posts.extend(resp["posts"])
        elif isinstance(resp, dict) and "error" in resp:
            print(f"  FEHLER bei {status}: {resp}")
    return posts


def _content_fingerprint(text):
    """Normalisierter Fingerprint für Duplikat-Erkennung."""
    t = text.lower().strip()
    # Hashtags entfernen
    t = re.sub(r'#\w+', '', t)
    # Whitespace normalisieren
    t = re.sub(r'\s+', ' ', t).strip()
    # Erste 150 Zeichen als Fingerprint (fängt leichte Variationen ab)
    return t[:150]


def preview():
    """Zeigt alle Posts die gefixt werden müssen (dry-run)."""
    if not POSTIZ_API_KEY:
        print("FEHLER: POSTIZ_API_KEY nicht gesetzt.")
        sys.exit(1)

    print("=== Postiz Post-Preview — Was wird gefixt? ===\n")

    posts = _fetch_all_posts()
    if not posts:
        print("Keine geplanten/draft Posts gefunden.")
        return

    fix_count = 0
    repost_count = 0

    for p in posts:
        post_id = p.get("id", "?")
        content = p.get("content", "") or ""
        scheduled = p.get("scheduled_at", p.get("scheduledAt", "?"))
        platform = p.get("platform", p.get("platforms", "?"))

        is_repost = post_id.startswith("rp_")
        needs_fix = _has_markdown(content)

        if is_repost:
            repost_count += 1
            print(f"  [REPOST] {post_id}")
            print(f"    Plattform: {platform} | Geplant: {scheduled}")
            print(f"    Text: {content[:80]}...")
            print()

        if needs_fix:
            fix_count += 1
            fixed = _strip_markdown(content)
            print(f"  [LAYOUT-FIX] {post_id}")
            print(f"    Plattform: {platform} | Geplant: {scheduled}")
            print(f"    VORHER: {content[:80]}...")
            print(f"    NACHHER: {fixed[:80]}...")
            print()

    # Duplikat-Check
    seen = {}
    dup_count = 0
    for p in posts:
        content = p.get("content", "") or ""
        platform = p.get("platform", p.get("platforms", "unknown"))
        if isinstance(platform, list):
            platform = ",".join(sorted(platform))
        fp = _content_fingerprint(content)
        if not fp:
            continue
        key = (str(platform), fp)
        if key in seen:
            dup_count += 1
            orig = seen[key]
            print(f"  [DUPLIKAT] {p.get('id', '?')}")
            print(f"    Plattform: {platform}")
            print(f"    Original: {orig.get('id', '?')}")
            print(f"    Text: {content[:60]}...")
            print()
        else:
            seen[key] = p

    print(f"--- Zusammenfassung ---")
    print(f"  Gesamt: {len(posts)} Posts")
    print(f"  Layout-Fixes nötig: {fix_count}")
    print(f"  Duplikate gefunden: {dup_count}")
    print(f"  Reposts gefunden: {repost_count}")

    total_issues = fix_count + dup_count + repost_count
    if total_issues == 0:
        print("\n  Alles sauber — keine Fixes nötig.")
    else:
        print(f"\n  Nutze 'all' um alles auf einmal zu fixen, oder einzeln:")
        print(f"    fix            — Layout reparieren")
        print(f"    dedup          — Duplikate entfernen")
        print(f"    delete-reposts — Reposts löschen")


def fix_layout():
    """Layout aller geplanten Posts fixen (Markdown strippen)."""
    if not POSTIZ_API_KEY:
        print("FEHLER: POSTIZ_API_KEY nicht gesetzt.")
        sys.exit(1)

    print("=== Postiz — Layout-Fix ===\n")

    posts = _fetch_all_posts()
    fixed = 0

    for p in posts:
        post_id = p.get("id", "?")
        content = p.get("content", "") or ""

        if not _has_markdown(content):
            continue

        clean = _strip_markdown(content)
        resp = _api("PATCH", f"{POSTIZ_URL}/api/posts/{post_id}", {
            "content": clean,
        })

        if "error" in resp:
            # Fallback: try PUT
            resp = _api("PUT", f"{POSTIZ_URL}/api/posts/{post_id}", {
                "content": clean,
            })

        if "error" in resp:
            print(f"  FEHLER [{post_id}]: {resp}")
        else:
            fixed += 1
            print(f"  OK [{post_id}] Layout gefixt")

    print(f"\n{fixed} Posts gefixt.")


def delete_reposts():
    """Alle rp_* Repost-Posts löschen."""
    if not POSTIZ_API_KEY:
        print("FEHLER: POSTIZ_API_KEY nicht gesetzt.")
        sys.exit(1)

    print("=== Postiz — Reposts entfernen ===\n")

    posts = _fetch_all_posts()
    deleted = 0

    for p in posts:
        post_id = p.get("id", "?")
        if not post_id.startswith("rp_"):
            continue

        content = (p.get("content", "") or "")[:60]
        resp = _api("DELETE", f"{POSTIZ_URL}/api/posts/{post_id}")

        if isinstance(resp, dict) and "error" in resp:
            print(f"  FEHLER [{post_id}]: {resp}")
        else:
            deleted += 1
            print(f"  GELÖSCHT [{post_id}] — {content}...")

    if deleted == 0:
        print("  Keine Reposts zum Löschen gefunden.")
    else:
        print(f"\n{deleted} Reposts gelöscht.")


def dedup():
    """Duplikate pro Plattform finden und entfernen (behält den ältesten)."""
    if not POSTIZ_API_KEY:
        print("FEHLER: POSTIZ_API_KEY nicht gesetzt.")
        sys.exit(1)

    print("=== Postiz — Duplikat-Check pro Plattform ===\n")

    posts = _fetch_all_posts(include_posted=True)
    if not posts:
        print("Keine Posts gefunden.")
        return

    # Gruppiere nach Plattform + Content-Fingerprint
    seen = {}  # key: (platform, fingerprint) -> erster Post
    duplicates = []

    # Sortiere nach scheduled_at aufsteigend (älteste zuerst behalten)
    posts.sort(key=lambda p: p.get("scheduled_at", p.get("scheduledAt", p.get("created_at", ""))))

    for p in posts:
        post_id = p.get("id", "?")
        content = p.get("content", "") or ""
        platform = p.get("platform", p.get("platforms", "unknown"))
        if isinstance(platform, list):
            platform = ",".join(sorted(platform))

        fp = _content_fingerprint(content)
        if not fp:
            continue

        key = (str(platform), fp)
        if key in seen:
            duplicates.append((p, seen[key]))
        else:
            seen[key] = p

    if not duplicates:
        print("  Keine Duplikate gefunden. Alles sauber.")
        return

    print(f"  {len(duplicates)} Duplikate gefunden:\n")
    deleted = 0

    for dup, original in duplicates:
        dup_id = dup.get("id", "?")
        orig_id = original.get("id", "?")
        platform = dup.get("platform", dup.get("platforms", "?"))
        content_preview = (dup.get("content", "") or "")[:60]
        dup_time = dup.get("scheduled_at", dup.get("scheduledAt", "?"))

        print(f"  [DUPLIKAT] {dup_id} (Plattform: {platform})")
        print(f"    Original: {orig_id}")
        print(f"    Geplant: {dup_time}")
        print(f"    Text: {content_preview}...")

        resp = _api("DELETE", f"{POSTIZ_URL}/api/posts/{dup_id}")
        if isinstance(resp, dict) and "error" in resp:
            print(f"    FEHLER: {resp}")
        else:
            deleted += 1
            print(f"    GELÖSCHT")
        print()

    print(f"\n{deleted}/{len(duplicates)} Duplikate entfernt.")


def run_all():
    """Alles ausführen: Preview, Fix, Dedup, Delete-Reposts."""
    print("=" * 60)
    print("  POSTIZ FULL CLEANUP")
    print("=" * 60)
    print()
    preview()
    print("\n" + "-" * 40 + "\n")
    fix_layout()
    print("\n" + "-" * 40 + "\n")
    dedup()
    print("\n" + "-" * 40 + "\n")
    delete_reposts()
    print("\n" + "=" * 60)
    print("  DONE")
    print("=" * 60)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fix_postiz_posts.py [preview|fix|delete-reposts|dedup|all]")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "preview":
        preview()
    elif cmd == "fix":
        fix_layout()
    elif cmd in ("delete-reposts", "delete_reposts"):
        delete_reposts()
    elif cmd == "dedup":
        dedup()
    elif cmd == "all":
        run_all()
    else:
        print(f"Unbekannter Befehl: {cmd}")
        print("Verfügbar: preview, fix, delete-reposts, dedup, all")
        sys.exit(1)


if __name__ == "__main__":
    main()
