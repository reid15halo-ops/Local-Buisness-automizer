#!/usr/bin/env python3
"""Content Pipeline — AI-gestützte Social-Media-Content-Generierung + Postiz-Scheduling.

Workflow:
  1. Content-Ideen generieren (basierend auf Branche, Saison, Trends)
  2. Posts via Ollama (lokal) oder OpenAI formulieren
  3. An Postiz API zur Planung senden
  4. Engagement-Tracking + Report

CLI:
  python3 content_pipeline.py generate          # Wöchentliche Posts generieren
  python3 content_pipeline.py schedule           # Generierte Posts in Postiz einplanen
  python3 content_pipeline.py report             # Engagement-Report der letzten 7 Tage
  python3 content_pipeline.py suggest            # Einmalig Content-Ideen vorschlagen
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

# --- Konfiguration ---
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
POSTIZ_URL = os.getenv("POSTIZ_URL", "http://127.0.0.1:5000")
POSTIZ_API_KEY = os.getenv("POSTIZ_API_KEY", "")
CONTENT_DIR = Path(os.getenv("CONTENT_DIR", "/home/openclaw/workspace/content"))
BRAND = "FreyAI Visions"
ZIELGRUPPE = "Handwerker & Kleinunternehmer in Deutschland (5-10 Mitarbeiter)"
TONE = "Professionell, direkt, ohne Floskeln. Industrial-Luxury Stil. Kurz und prägnant."

# Content-Kategorien mit Gewichtung
CONTENT_TYPES = [
    {
        "type": "praxis_tipp",
        "name": "Praxis-Tipp",
        "description": "Kurzer, actionabler Business-Tipp für Handwerker",
        "frequency": 2,  # pro Woche
        "platforms": ["linkedin", "instagram"],
        "template": (
            "Erstelle einen kurzen Social-Media-Post (max 200 Wörter) mit einem "
            "praktischen Business-Tipp für deutsche Handwerksbetriebe. "
            "Thema: {topic}. Stil: {tone}. "
            "Zielgruppe: {audience}. "
            "Inkludiere 3-5 relevante Hashtags auf Deutsch. "
            "Format: Hook-Zeile, dann 2-3 Absätze, dann Call-to-Action."
        ),
    },
    {
        "type": "behind_scenes",
        "name": "Behind the Scenes",
        "description": "Einblick in die Entwicklung / den Alltag bei FreyAI Visions",
        "frequency": 1,
        "platforms": ["linkedin", "instagram"],
        "template": (
            "Erstelle einen authentischen 'Behind the Scenes'-Post für {brand}. "
            "Zeige, wie wir an Digitalisierungslösungen für Handwerker arbeiten. "
            "Thema: {topic}. Stil: persönlich aber professionell. "
            "Max 150 Wörter. 3-5 Hashtags."
        ),
    },
    {
        "type": "case_study",
        "name": "Mini-Case-Study",
        "description": "Anonymisierte Erfolgsgeschichte / Vorher-Nachher",
        "frequency": 1,
        "platforms": ["linkedin"],
        "template": (
            "Erstelle eine kurze Case-Study (max 250 Wörter) über einen fiktiven aber "
            "realistischen Handwerksbetrieb, der durch Digitalisierung Zeit/Geld spart. "
            "Branche: {topic}. Format: Problem → Lösung → Ergebnis mit konkreten Zahlen. "
            "Stil: {tone}. 3-5 Hashtags."
        ),
    },
    {
        "type": "branchen_insight",
        "name": "Branchen-Insight",
        "description": "Markttrend oder Statistik mit Einordnung",
        "frequency": 1,
        "platforms": ["linkedin"],
        "template": (
            "Erstelle einen Post über einen aktuellen Trend/Statistik im deutschen Handwerk. "
            "Thema: {topic}. Ordne den Trend ein und erkläre, was das für kleine Betriebe bedeutet. "
            "Max 200 Wörter. Stil: {tone}. Zielgruppe: {audience}. 3-5 Hashtags."
        ),
    },
]

# Themen-Pool (wird rotiert)
TOPIC_POOL = {
    "praxis_tipp": [
        "Rechnungen automatisieren statt Excel",
        "Kundenkommunikation mit System — nie wieder verlorene Anfragen",
        "Material-Nachbestellung automatisieren",
        "Zeiterfassung auf der Baustelle — digital statt Zettelwirtschaft",
        "Angebote in 5 Minuten statt 2 Stunden erstellen",
        "Mahnwesen automatisieren — freundlich aber konsequent",
        "Online-Buchung für Handwerker — Kunden buchen selbst",
        "GoBD-konforme Buchhaltung ohne Steuerberater-Stress",
        "Fotos von der Baustelle — Dokumentation die sich auszahlt",
        "DATEV-Export auf Knopfdruck",
        "Lagerbestand im Griff — nie wieder Fehlbestellungen",
        "Notfall-Einsatz optimal koordinieren",
    ],
    "behind_scenes": [
        "Wie wir KI-Assistenten für Handwerker testen",
        "Von der Idee zum Feature — ein Tag bei FreyAI Visions",
        "Warum wir Offline-First bauen — Baustellen haben kein WLAN",
        "Feedback von Pilotbetrieben — was wir gelernt haben",
        "Server-Setup für maximale Datensicherheit",
        "Die Balance zwischen Einfachheit und Funktionalität",
    ],
    "case_study": [
        "Elektrikerbetrieb — 40% weniger Verwaltungsaufwand",
        "SHK-Betrieb — Angebotserstellung von 2h auf 10min",
        "Tischlerei — Lageroptimierung spart 3.000€/Jahr",
        "Malerbetrieb — Kundenkommunikation zentralisiert",
        "Dachdecker — Mobile Aufmaß-Erfassung spart Fahrten",
        "Fliesenleger — Automatische Nachbestellung Material",
    ],
    "branchen_insight": [
        "Fachkräftemangel im Handwerk — Digitalisierung als Lösung",
        "E-Rechnung wird Pflicht — was Handwerker jetzt tun müssen",
        "Handwerker-Apps im Vergleich — was wirklich hilft",
        "Digitalisierungsgrad im Handwerk — aktuelle Zahlen",
        "KI im Handwerk — Hype vs. echte Anwendungsfälle",
        "Generationenwechsel — wenn der Junior den Betrieb digitalisiert",
    ],
}

# Optimale Posting-Zeiten (CET/CEST)
POSTING_SCHEDULE = {
    "linkedin": {
        "days": ["tuesday", "wednesday", "thursday"],
        "times": ["08:30", "17:00"],
    },
    "instagram": {
        "days": ["monday", "wednesday", "friday"],
        "times": ["12:00", "18:30"],
    },
}


def _api(method, url, data=None, headers=None):
    """HTTP-Request Helper."""
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()[:500]}
    except Exception as e:
        return {"error": str(e)}


def _ollama_generate(prompt, model="gemma2:9b"):
    """Text via lokalem Ollama generieren."""
    resp = _api("POST", f"{OLLAMA_URL}/api/generate", {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 500},
    })
    if "error" in resp:
        return None, resp["error"]
    return resp.get("response", ""), None


def _get_next_topic(content_type):
    """Nächstes Thema aus dem Pool rotieren (tracked via JSON-Datei)."""
    tracker_file = CONTENT_DIR / "topic_tracker.json"
    tracker = {}
    if tracker_file.exists():
        tracker = json.loads(tracker_file.read_text())

    topics = TOPIC_POOL.get(content_type, [])
    if not topics:
        return "Allgemeiner Digitalisierungstipp"

    used = tracker.get(content_type, [])
    available = [t for t in topics if t not in used]
    if not available:
        # Reset — alle Themen durch
        used = []
        available = topics

    topic = available[0]
    used.append(topic)
    tracker[content_type] = used
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    tracker_file.write_text(json.dumps(tracker, indent=2, ensure_ascii=False))
    return topic


def _get_next_slot(platform, after=None):
    """Nächsten freien Posting-Slot berechnen."""
    if after is None:
        after = datetime.now()

    schedule = POSTING_SCHEDULE.get(platform, {"days": ["wednesday"], "times": ["12:00"]})
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    for day_offset in range(1, 15):
        candidate = after + timedelta(days=day_offset)
        day_name = day_names[candidate.weekday()]
        if day_name in schedule["days"]:
            for time_str in schedule["times"]:
                h, m = map(int, time_str.split(":"))
                slot = candidate.replace(hour=h, minute=m, second=0, microsecond=0)
                if slot > after:
                    return slot
    # Fallback: morgen 12:00
    return (after + timedelta(days=1)).replace(hour=12, minute=0, second=0)


def generate_weekly_content():
    """Wöchentliche Content-Batch generieren."""
    print("=== Content Pipeline — Wöchentliche Generierung ===\n")

    posts = []
    for ct in CONTENT_TYPES:
        for _ in range(ct["frequency"]):
            topic = _get_next_topic(ct["type"])
            prompt = ct["template"].format(
                topic=topic, tone=TONE, audience=ZIELGRUPPE, brand=BRAND
            )

            print(f"  Generiere: {ct['name']} — {topic}...")
            text, err = _ollama_generate(prompt)
            if err:
                print(f"    FEHLER: {err}")
                continue

            post = {
                "type": ct["type"],
                "name": ct["name"],
                "topic": topic,
                "text": text.strip(),
                "platforms": ct["platforms"],
                "generated_at": datetime.now().isoformat(),
                "status": "draft",
            }
            posts.append(post)
            print(f"    OK ({len(text)} Zeichen)")

    # Posts speichern
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    week = datetime.now().strftime("%Y-W%W")
    outfile = CONTENT_DIR / f"posts_{week}.json"
    outfile.write_text(json.dumps(posts, indent=2, ensure_ascii=False))
    print(f"\n{len(posts)} Posts generiert → {outfile}")
    return posts


def schedule_posts():
    """Generierte Posts in Postiz einplanen."""
    print("=== Content Pipeline — Postiz Scheduling ===\n")

    # Neueste Posts laden
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    post_files = sorted(CONTENT_DIR.glob("posts_*.json"), reverse=True)
    if not post_files:
        print("Keine generierten Posts gefunden. Erst `generate` ausführen.")
        return

    posts = json.loads(post_files[0].read_text())
    drafts = [p for p in posts if p.get("status") == "draft"]
    if not drafts:
        print("Keine Draft-Posts zum Einplanen.")
        return

    if not POSTIZ_API_KEY:
        print("WARNUNG: Kein POSTIZ_API_KEY gesetzt. Speichere Zeitplan lokal.")
        # Lokaler Zeitplan ohne Postiz-API
        slot = datetime.now()
        for post in drafts:
            for platform in post["platforms"]:
                slot = _get_next_slot(platform, slot)
                post["scheduled_for"] = slot.isoformat()
                post["scheduled_platform"] = platform
                post["status"] = "scheduled_local"
                print(f"  [{platform}] {slot.strftime('%a %d.%m. %H:%M')} — {post['name']}: {post['topic'][:40]}")

        post_files[0].write_text(json.dumps(posts, indent=2, ensure_ascii=False))
        print(f"\nZeitplan gespeichert (lokal) → {post_files[0]}")
        return

    # Postiz API Scheduling
    headers = {"Authorization": f"Bearer {POSTIZ_API_KEY}"}
    slot = datetime.now()
    scheduled = 0

    for post in drafts:
        for platform in post["platforms"]:
            slot = _get_next_slot(platform, slot)
            payload = {
                "content": post["text"],
                "platforms": [platform],
                "scheduled_at": slot.isoformat(),
                "status": "scheduled",
            }
            resp = _api("POST", f"{POSTIZ_URL}/api/posts", payload, headers)
            if "error" in resp:
                print(f"  FEHLER [{platform}]: {resp}")
            else:
                post["status"] = "scheduled"
                post["postiz_id"] = resp.get("id")
                post["scheduled_for"] = slot.isoformat()
                scheduled += 1
                print(f"  [{platform}] {slot.strftime('%a %d.%m. %H:%M')} — {post['name']}: {post['topic'][:40]}")

    post_files[0].write_text(json.dumps(posts, indent=2, ensure_ascii=False))
    print(f"\n{scheduled} Posts in Postiz eingeplant.")


def suggest_ideas():
    """Content-Ideen für die nächste Woche vorschlagen."""
    print("=== Content Pipeline — Ideen-Generator ===\n")

    prompt = (
        f"Generiere 5 konkrete Content-Ideen für den Social-Media-Auftritt von {BRAND}. "
        f"Zielgruppe: {ZIELGRUPPE}. "
        f"Plattformen: LinkedIn und Instagram. "
        f"Jede Idee soll enthalten: "
        f"1. Kurzer Titel (max 10 Wörter) "
        f"2. Content-Typ (Tipp, Behind-the-Scenes, Case-Study, Trend) "
        f"3. Eine Zeile Beschreibung was der Post zeigen/sagen soll "
        f"4. Empfohlene Plattform "
        f"Formatiere als nummerierte Liste. Fokus auf aktuelle Themen im deutschen Handwerk."
    )
    text, err = _ollama_generate(prompt)
    if err:
        print(f"FEHLER: {err}")
        return

    print(text)
    print("\n--- Nutze `generate` um Posts zu erstellen ---")


def engagement_report():
    """Engagement-Report der letzten Tage."""
    print("=== Content Pipeline — Engagement Report ===\n")

    if not POSTIZ_API_KEY:
        print("Kein POSTIZ_API_KEY gesetzt. Zeige lokalen Status.\n")
        CONTENT_DIR.mkdir(parents=True, exist_ok=True)
        post_files = sorted(CONTENT_DIR.glob("posts_*.json"), reverse=True)
        if not post_files:
            print("Keine Posts vorhanden.")
            return

        total = 0
        for pf in post_files[:4]:
            posts = json.loads(pf.read_text())
            week = pf.stem.replace("posts_", "")
            drafted = sum(1 for p in posts if p.get("status") == "draft")
            scheduled = sum(1 for p in posts if "scheduled" in p.get("status", ""))
            print(f"  KW {week}: {len(posts)} Posts ({drafted} Draft, {scheduled} Geplant)")
            total += len(posts)
        print(f"\nGesamt: {total} Posts in {len(post_files)} Wochen")
        return

    # Postiz API Report
    headers = {"Authorization": f"Bearer {POSTIZ_API_KEY}"}
    resp = _api("GET", f"{POSTIZ_URL}/api/analytics/posts?period=7d", headers=headers)
    if "error" in resp:
        print(f"FEHLER: {resp}")
        return

    posts = resp if isinstance(resp, list) else resp.get("posts", [])
    print(f"Posts der letzten 7 Tage: {len(posts)}\n")
    for p in posts:
        platform = p.get("platform", "?")
        likes = p.get("likes", 0)
        comments = p.get("comments", 0)
        impressions = p.get("impressions", 0)
        content_preview = p.get("content", "")[:50]
        print(f"  [{platform}] {likes} Likes, {comments} Kommentare, {impressions} Impressionen")
        print(f"    → {content_preview}...")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 content_pipeline.py [generate|schedule|suggest|report]")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "generate":
        generate_weekly_content()
    elif cmd == "schedule":
        schedule_posts()
    elif cmd == "suggest":
        suggest_ideas()
    elif cmd == "report":
        engagement_report()
    else:
        print(f"Unbekannter Befehl: {cmd}")
        print("Verfügbar: generate, schedule, suggest, report")
        sys.exit(1)


if __name__ == "__main__":
    main()
