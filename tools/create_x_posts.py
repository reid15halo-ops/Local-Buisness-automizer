#!/usr/bin/env python3
"""Generate SQL to insert X/Twitter posts into Postiz database."""
from datetime import datetime, timedelta

ORG_ID = "c740c0dd-30e5-42e1-b0e0-507882c01506"
X_INTEGRATION_ID = "cmmow205g0001p64yqasymzv9"

x_posts = [
    "Yoga unterrichten statt Rechnungen sortieren. Wir automatisieren den Bürokram für Studios.\n\n#FreyAIVisions #Yoga #Digitalisierung",
    "Vom Steinmetz zum IT-Berater. Ich kenne die Probleme im Handwerk — weil ich sie selbst hatte.\n\n#FreyAIVisions #Gründergeschichte",
    "Dein Terminbuch hat ausgedient. Ein Nachmittag reicht für den Umstieg.\n\n#Digitalisierung #Handwerk #FreyAIVisions",
    "Gelernter Steinmetz. Jahre im Staub. Jetzt baue ich Software für Handwerker.\n\nWeil das Problem alle haben.\n\n#FreyAIVisions",
    "Rechts: Papierchaos. Links: Ein Klick, alles sortiert.\n\n73% weniger Verwaltungszeit. Kein Witz.\n\n#FreyAIVisions #Handwerk",
    "Kamille leer? Lavendelöl nachbestellen?\n\nMit dem richtigen System weißt du auf einen Blick, was fehlt.\n\n#FreyAIVisions #Inventar",
    "Handschlag mit dem Meister > jeder Vertrag.\n\nAber Angebot + Rechnung danach? Das automatisieren wir.\n\n#FreyAIVisions #Handwerk",
    "22:47 Uhr. Die Stadt schläft. Ich code.\n\nFreyAI entsteht nachts — aus echtem Antrieb.\n\n#Gründen #NachtSchicht #FreyAIVisions",
    "Excel ist kein CRM. Punkt.\n\nKundendaten in 5 verschiedenen Dateien? Das muss nicht sein.\n\nfreyaivisions.de\n\n#CRM #Handwerk",
    "Neue Kundin öffnet deine Tür. Dieser Moment zählt.\n\nDen Bürokram? Den erledigen wir.\n\n#FreyAIVisions #MehrZeit",
    "Zettelwirtschaft ade. Ein Griff zum Handy — alles da.\n\nDas ist keine Revolution. Das ist Erleichterung.\n\n#FreyAIVisions",
    "Dein Büro auf einem Bildschirm. DSGVO-konform. Keine US-Cloud. Alles deins.\n\n#Datenschutz #Handwerk #FreyAIVisions",
    "Du hast gelernt, Menschen schön zu machen. Nicht Tabellen.\n\nNach dem letzten Kunden einfach nach Hause. Dafür bauen wir FreyAI.\n\n#Salon",
    "5 Stunden pro Woche. Verschwendet an manuelle Verwaltung.\n\nDas ist automatisierbar. Heute. Nicht irgendwann.\n\nfreyaivisions.de",
    "Lavendelöl auf 5 Flaschen? Nachbestellung läuft automatisch.\n\nDein Inventar — smart verwaltet.\n\n#FreyAIVisions #SmartesLager",
    "Der Markt ist voll mit überladener Software.\n\nWas ein 3-Mann-Betrieb wirklich braucht: Ein System. Ohne Abo-Falle.\n\n#FreyAIVisions",
    "Tischler misst zweimal, sägt einmal.\nEntwickler testet zweimal, deployed einmal.\n\nHandwerk + Code = FreyAI\n\n#Digitalisierung",
    "Energie. Intuition. Vertrauen.\n\nDas ist dein Handwerk. Den Rest übernehmen wir.\n\n#FreyAIVisions #Handwerk",
    "Montagmorgen, 6 Uhr. Kaffee, Baustelle, los.\n\nAber wer kümmert sich um die Rechnung von letzter Woche? FreyAI.\n\n#Automatisierung",
    "Dein Betrieb ist nicht zu klein für Digitalisierung.\n\nEr ist zu wichtig, um es nicht zu tun.\n\n#FreyAIVisions #KMU",
    "Rechnung geschrieben? Mahnung verschickt? Zahlung geprüft?\n\nOder: Ein Klick. Fertig.\n\n#FreyAIVisions #Rechnungen",
    "Was unterscheidet gute von großartigen Betrieben?\n\nNicht das Handwerk. Die Organisation dahinter.\n\n#FreyAIVisions #Effizienz",
    "Dein Meisterbrief an der Wand. Deine Software im Griff.\n\nBeides gehört zusammen.\n\n#Handwerk #Digitalisierung #FreyAIVisions",
    "Kunden gewinnen ist schwer. Kunden verlieren wegen vergessener Angebote? Unnötig.\n\n#CRM #FreyAIVisions",
    "DSGVO-konform. Selbst gehostet. Keine Drittanbieter-Cloud.\n\nDeine Daten bleiben deine Daten.\n\n#Datenschutz #FreyAIVisions",
    "3 Minuten statt 30. So lange dauert eine Rechnung mit FreyAI.\n\nDen Rest deiner Zeit? Für dein Handwerk.\n\n#Automatisierung",
    "KI im Handwerk klingt nach Zukunft?\n\nIst es nicht. Es ist Gegenwart.\n\nfreyaivisions.de\n\n#KI #Handwerk #FreyAIVisions",
    "Dein Azubi fragt: Wo ist die Rechnung von Müller?\n\nMit FreyAI: Suche → Gefunden. 2 Sekunden.\n\n#Organisation #FreyAIVisions",
    "Abends Rechnungen schreiben statt Feierabend?\n\nDas war mein Alltag. Deshalb gibt es FreyAI.\n\n#Gründergeschichte #Handwerk",
    "Buchhaltung muss nicht wehtun.\n\nDATEV-Export auf Knopfdruck. Belege automatisch sortiert.\n\n#Buchhaltung #FreyAIVisions",
    "Dein Handwerk verdient bessere Tools.\n\nNicht Enterprise-Software für Konzerne. Sondern etwas, das wirklich passt.\n\n#FreyAIVisions",
    "Eine Frage: Wie viele Stunden pro Woche verbringst du im Büro statt in der Werkstatt?\n\n#Handwerk #Zeitfresser #FreyAIVisions",
    "Angebotsvorlage kopieren. Adresse ändern. Preis anpassen. Speichern. PDF. Mailen.\n\nOder: Ein Klick.\n\n#FreyAIVisions",
    "Tradition trifft Technologie.\n\nWir ersetzen nicht dein Handwerk. Wir befreien es vom Bürokram.\n\n#FreyAIVisions #Handwerk",
    "Termin vergessen? Rechnung nicht raus? Material nicht bestellt?\n\nNie wieder. FreyAI erinnert dich.\n\n#Automatisierung",
    "Sonntag. Du denkst an morgen. An die offenen Rechnungen. An den Kunden, der noch wartet.\n\nMit FreyAI: Entspann dich. Läuft.",
    "Digitalisierung heißt nicht: alles auf einmal.\n\nSondern: Schritt für Schritt. Im eigenen Tempo.\n\nfreyaivisions.de",
    "Was Handwerker und Entwickler gemeinsam haben:\n\nWir lösen Probleme. Jeden Tag. Mit unseren Händen.\n\n#FreyAIVisions",
    "Kein Startup-Bla. Kein Buzzword-Bingo.\n\nEinfach ein System, das funktioniert. Für Leute, die arbeiten.\n\n#FreyAIVisions",
    "Materialbestellung per WhatsApp? Termine im Kopf? Rechnungen in der Schublade?\n\nEs gibt einen besseren Weg.\n\n#FreyAIVisions",
    "Du kennst deinen Stundensatz. Aber kennst du deine Verwaltungskosten?\n\n5h/Woche x 48 Wochen = 240h/Jahr. Unbezahlt.\n\n#Effizienz",
    "Dein Konkurrent digitalisiert gerade.\n\nNicht um besser zu sein. Sondern um schneller zu sein.\n\nBleib nicht stehen.\n\n#FreyAIVisions",
    "Ich habe 6 Jahre im Handwerk gearbeitet, bevor ich eine Zeile Code geschrieben habe.\n\nDas ist unser Vorteil.\n\n#FreyAIVisions",
    "Zettel > Excel > Software > KI.\n\nWo stehst du? Wir holen dich ab, wo du bist.\n\n#Digitalisierung #FreyAIVisions",
    "Handwerk hat goldenen Boden. Aber keinen für Papierkram.\n\nDas ändern wir.\n\n#FreyAIVisions #Handwerk",
    "Ein Anruf. Ein Auftrag. Drei Systeme updaten.\n\nOder: Ein System. Das alles kann.\n\nfreyaivisions.de\n\n#FreyAIVisions",
    "Steuererklärung naht? DATEV-Export in 30 Sekunden.\n\nDein Steuerberater wird dich lieben.\n\n#DATEV #Buchhaltung #FreyAIVisions",
    "Der beste Zeitpunkt für Digitalisierung war gestern.\n\nDer zweitbeste? Jetzt.\n\nfreyaivisions.de\n\n#FreyAIVisions #Handwerk",
    "Weniger Büro. Mehr Werkstatt. Das ist das Versprechen.\n\n#FreyAIVisions #Handwerk #Digitalisierung",
    "Kleine Betriebe. Große Wirkung.\n\nDigitalisierung ist kein Luxus. Es ist Überleben.\n\n#KMU #FreyAIVisions",
    "Morgens Baustelle, abends Buchhaltung.\n\nDas war gestern. Heute macht FreyAI den Bürokram.\n\n#Automatisierung #Handwerk",
    "Dein Handwerk ist Kunst. Deine Verwaltung sollte es nicht sein müssen.\n\n#FreyAIVisions",
    "Rechnung erstellen: 3 Minuten.\nAngebot schreiben: 2 Minuten.\nKunden anlegen: 30 Sekunden.\n\nSo geht FreyAI.\n\n#Effizienz",
    "Frag dich: Was würdest du mit 5 extra Stunden pro Woche machen?\n\nGenau das ermöglichen wir.\n\n#FreyAIVisions #MehrZeit",
    "Made in Germany. Gehostet in Deutschland. DSGVO-konform.\n\nDeine Daten. Dein System. Dein Betrieb.\n\n#FreyAIVisions",
    "Warum kompliziert, wenn es einfach geht?\n\nEin Dashboard. Alle Funktionen. Kein Schnickschnack.\n\n#FreyAIVisions",
    "An alle Handwerker da draußen:\n\nIhr verdient bessere Tools. Und wir bauen sie.\n\n#FreyAIVisions #Handwerk",
    "Software, die ein Handwerker gebaut hat.\n\nFür Handwerker.\n\nDas ist FreyAI.\n\nfreyaivisions.de",
    "Wochenende. Endlich. Oder doch noch schnell die Rechnung...?\n\nMit FreyAI: Schon erledigt. Genieß dein Wochenende.\n\n#FreyAIVisions",
    "100% deiner Energie für dein Handwerk. 0% für Bürokram.\n\nDas ist das Ziel.\n\n#FreyAIVisions #Automatisierung",
    "Papier ist geduldig. Aber deine Zeit ist es nicht.\n\nDigitalisiere jetzt.\n\nfreyaivisions.de\n\n#FreyAIVisions",
    "Jeder Handwerker kennt das: Der Tag war lang, aber das Büro wartet noch.\n\nNicht mehr. Nicht mit FreyAI.\n\n#Feierabend",
    "Was kostet dich Zettelwirtschaft?\n\nNicht nur Zeit. Auch Nerven. Und manchmal Kunden.\n\n#FreyAIVisions #Ordnung",
    "Dein Betrieb. Deine Regeln. Dein System.\n\nKeine Cloud-Abhängigkeit. Keine Abo-Falle.\n\n#FreyAIVisions #Selbstbestimmt",
    "FreyAI: Von Handwerkern. Für Handwerker.\n\nfreyaivisions.de\n\n#Digitalisierung #KI #Handwerk",
    "Die Zukunft des Handwerks ist digital.\n\nAber sie fühlt sich an wie Zuhause.\n\n#FreyAIVisions",
    "Noch Fragen? Schreib mir. Ich antworte persönlich.\n\nkontakt@freyaivisions.de\n\n#FreyAIVisions #Handwerk",
    "Qualität braucht Zeit. Bürokram nicht.\n\nFreyAI gibt dir die Zeit zurück.\n\n#Handwerk #FreyAIVisions",
    "Ein System. Ein Login. Alles drin.\n\nKunden. Rechnungen. Termine. Material.\n\nfreyaivisions.de\n\n#FreyAIVisions",
    "Nicht noch ein Tool. DAS Tool.\n\nFreyAI — dein digitaler Meisterbrief.\n\n#FreyAIVisions #Handwerk",
    "Montag bis Freitag: Handwerk.\nAbends und Wochenende: Büro.\n\nDas muss nicht sein.\n\n#FreyAIVisions #WorkLifeBalance",
    "Stell dir vor, du kommst morgens in die Werkstatt und alles ist organisiert.\n\nKein Traum. FreyAI.\n\n#Handwerk #FreyAIVisions",
    "Der Meisterbrief macht dich zum Experten.\n\nFreyAI macht dein Büro zum Selbstläufer.\n\n#Digitalisierung #FreyAIVisions",
    "Handwerk. Digital. Einfach.\n\nDas ist FreyAI Visions.\n\nfreyaivisions.de",
    "Danke an alle Handwerker, die den Mut haben, neue Wege zu gehen.\n\nWir gehen mit euch.\n\n#FreyAIVisions #Handwerk",
    "Weniger tippen. Mehr schaffen.\n\n#FreyAIVisions",
    "Dein nächster Schritt? freyaivisions.de\n\nKostenloser Erstcheck. Unverbindlich. Persönlich.\n\n#FreyAIVisions #Digitalisierung",
    "Automatisierung ist nicht unpersönlich.\n\nAutomatisierung = Mehr Zeit für das Persönliche.\n\n#FreyAIVisions #Handwerk",
    "Vom Zettel zum System. Vom Chaos zur Klarheit.\n\nDas ist der Weg. Und wir zeigen ihn dir.\n\n#FreyAIVisions",
    "Gut Ding will Weile haben — aber nicht deine Buchhaltung.\n\n#FreyAIVisions #Effizienz",
    "Jeder Nagel sitzt. Jede Fuge stimmt. Jede Rechnung? Auch.\n\nMit FreyAI.\n\n#Handwerk #FreyAIVisions",
    "Ein Handwerker baut Häuser. FreyAI baut den Rest.\n\n#Digitalisierung #FreyAIVisions",
    "Dein Betrieb verdient das Beste. Auch digital.\n\nfreyaivisions.de\n\n#FreyAIVisions #Handwerk",
    "Schluss mit Zettelwirtschaft. Schluss mit Chaos.\n\nHer mit Klarheit. Her mit FreyAI.\n\n#Digitalisierung",
    "Du liebst dein Handwerk. Wir lieben Technologie.\n\nZusammen? Unschlagbar.\n\n#FreyAIVisions",
    "Freitag, 16 Uhr. Feierabend. Wirklich.\n\nMit FreyAI ist das möglich.\n\n#FreyAIVisions #Feierabend #Handwerk",
    "Das Wichtigste im Handwerk?\n\nZufriedene Kunden. Und die Zeit, sich um sie zu kümmern.\n\n#FreyAIVisions",
    "Einmal einrichten. Für immer profitieren.\n\nDas ist FreyAI.\n\nfreyaivisions.de\n\n#Digitalisierung #Handwerk",
    "Innovation im Handwerk beginnt nicht mit KI.\n\nSie beginnt mit dem Mut, etwas zu ändern.\n\n#FreyAIVisions",
    "Mach den ersten Schritt.\n\nDer Rest? Automatisch.\n\nfreyaivisions.de\n\n#FreyAIVisions #Handwerk #Digitalisierung",
    "Wir glauben an Handwerker. An ihre Kunst. An ihre Zukunft.\n\nDeshalb gibt es FreyAI.\n\n#FreyAIVisions",
    "Digital. Sicher. Einfach. Deins.\n\n#FreyAIVisions",
    "Letzter Post heute:\n\nWenn du bis hierhin gelesen hast — du bist bereit.\n\nfreyaivisions.de\n\n#FreyAIVisions #LosGehts",
]

start_date = datetime(2026, 3, 14)
sql_values = []

for i, post_text in enumerate(x_posts):
    day_offset = i // 2
    hour = 10 if i % 2 == 0 else 18
    pub_date = start_date + timedelta(days=day_offset)
    pub_date = pub_date.replace(hour=hour, minute=0, second=0)

    escaped = post_text.replace("'", "''")

    sql_values.append(
        f"(gen_random_uuid()::text, 'QUEUE', '{pub_date.strftime('%Y-%m-%d %H:%M:%S')}', "
        f"'{ORG_ID}', '{X_INTEGRATION_ID}', E'{escaped}', 0, "
        f"gen_random_uuid()::text, NULL, NULL, NULL, NULL, NULL, '{{}}'::jsonb, '[]'::jsonb, "
        f"NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL)"
    )

sql = """INSERT INTO "Post" (id, state, "publishDate", "organizationId", "integrationId",
content, delay, "group", title, description, "parentPostId", "releaseId", "releaseURL",
settings, image, "submittedForOrderId", "submittedForOrganizationId", "approvedSubmitForOrder",
"lastMessageId", "intervalInDays", error, "createdAt", "updatedAt", "deletedAt") VALUES\n"""

sql += ",\n".join(sql_values) + ";"

print(f"-- {len(x_posts)} X posts, {start_date.strftime('%Y-%m-%d')} to {(start_date + timedelta(days=len(x_posts)//2)).strftime('%Y-%m-%d')}")
print(sql)
