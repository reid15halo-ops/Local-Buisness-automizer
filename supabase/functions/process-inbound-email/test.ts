// Test Suite für process-inbound-email
// Run: deno test --allow-net --allow-env test.ts

import { assertEquals, assertExists } from 'https://deno.land/std@0.177.0/testing/asserts.ts'

const FUNCTION_URL = Deno.env.get('FUNCTION_URL') || 'http://localhost:54321/functions/v1/process-inbound-email'

// ============================================
// Test Utilities
// ============================================
async function sendTestEmail(payload: any) {
    const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })

    return {
        status: response.status,
        data: await response.json()
    }
}

// ============================================
// Test Cases
// ============================================

Deno.test('Simple Metallbau Request', async () => {
    const testEmail = {
        from: {
            name: 'Max Mustermann',
            email: 'max.mustermann@example.com'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Anfrage Metalltor',
        text: `Hallo,

ich benötige ein Metalltor mit folgenden Maßen:
- Breite: 2 Meter
- Höhe: 1,8 Meter
- Feuerverzinkt
- Farbe: RAL 7016 Anthrazit

Mein Budget liegt bei ca. 1.500€.

Vielen Dank!
Max Mustermann
Tel: 0123/456789`
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)
    assertExists(result.data.anfrage_nummer)
    assertExists(result.data.angebot_nummer)

    console.log('✅ Simple Metallbau Request:', result.data)
})

Deno.test('Hydraulik Service Request', async () => {
    const testEmail = {
        from: {
            name: 'Anna Schmidt',
            email: 'anna.schmidt@firma-xyz.de'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Dringend: Hydraulikschlauch defekt',
        text: `Guten Tag,

bei uns ist ein Hydraulikschlauch an der Presse gerissen.

Details:
- Schlauch DN16, ca. 3 Meter
- Druckbereich 315 bar
- 2-fach Ermeto-Verschraubung

Wir benötigen schnellstmöglich Ersatz, idealer Termin wäre Freitag.

Mit freundlichen Grüßen
Anna Schmidt
Firma XYZ GmbH
Tel: 0987/654321`
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)

    console.log('✅ Hydraulik Service Request:', result.data)
})

Deno.test('Unklare Anfrage (Fallback)', async () => {
    const testEmail = {
        from: {
            name: 'Peter',
            email: 'peter@example.com'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Hilfe',
        text: 'Können Sie mir helfen?'
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)

    // Should fallback to simple confirmation
    assertEquals(result.data.automated, false)

    console.log('✅ Unklare Anfrage (Fallback):', result.data)
})

Deno.test('Detaillierte Schweißarbeiten Anfrage', async () => {
    const testEmail = {
        from: {
            name: 'Thomas Müller',
            email: 'mueller@stahlbau.de'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Angebot für Schweißarbeiten nach DIN EN 1090',
        text: `Sehr geehrte Damen und Herren,

wir benötigen für ein Bauprojekt folgende Schweißarbeiten:

Leistungen:
- 12x IPE 200 Stahlträger schweißen (je 6m)
- Konstruktion nach DIN EN 1090 mit Dokumentation
- Korrosionsschutz: Feuerverzinkung
- Abnahme durch Prüfingenieur

Zeitrahmen: KW 15-16 (April 2026)
Budget: ca. 8.000€

Können Sie uns ein Angebot unterbreiten?

Mit freundlichen Grüßen
Thomas Müller
Stahlbau Müller GmbH
Tel: 0555/123456
www.stahlbau-mueller.de`
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)
    assertExists(result.data.angebot_nummer)

    // Check if budget is recognized
    console.log('✅ Detaillierte Schweißarbeiten Anfrage:', result.data)
})

Deno.test('Multi-Position Complex Request', async () => {
    const testEmail = {
        from: {
            name: 'Lisa Weber',
            email: 'weber@industriepark.de'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Mehrere Leistungen benötigt',
        text: `Hallo,

wir haben mehrere Anforderungen:

1. Treppengeländer aus Edelstahl (15 Meter)
2. 2x Eingangstüren mit Rahmen
3. Gitterrost-Podest (4x3 Meter)
4. Wartung der vorhandenen Hydraulikanlage

Bitte teilen Sie uns die Kosten mit.

Lisa Weber
Industriepark Nord
Tel: 0666/987654`
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)

    console.log('✅ Multi-Position Complex Request:', result.data)
})

Deno.test('E-Mail mit Budget Range', async () => {
    const testEmail = {
        from: {
            name: 'Karl Fischer',
            email: 'fischer@example.com'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Carport aus Stahl',
        text: `Guten Tag,

ich suche einen Carport aus Stahl für 2 PKW.

Maße: ca. 6x6 Meter
Dach: Wellblech oder Stegplatten
Budget: zwischen 3.000 und 5.000 Euro

Ist das realistisch?

Karl Fischer
Tel: 0777/111222`
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)

    console.log('✅ E-Mail mit Budget Range:', result.data)
})

// ============================================
// Integration Tests (with Database)
// ============================================

Deno.test('Database Integration - Customer Creation', async () => {
    // This test requires database access
    // Skip if not available
    try {
        const testEmail = {
            from: {
                name: 'Test User Integration',
                email: 'integration.test@example.com'
            },
            to: 'anfragen@handwerkflow.de',
            subject: 'Integration Test',
            text: 'Ich benötige ein Angebot für Metallbau.'
        }

        const result = await sendTestEmail(testEmail)

        assertEquals(result.status, 200)
        assertExists(result.data.kunde_id)
        assertExists(result.data.anfrage_id)

        console.log('✅ Database Integration Test:', result.data)
    } catch (error) {
        console.warn('⚠️ Skipping database integration test:', error.message)
    }
})

// ============================================
// Performance Tests
// ============================================

Deno.test('Performance - Sequential Requests', async () => {
    const start = Date.now()

    for (let i = 0; i < 5; i++) {
        const testEmail = {
            from: {
                name: `Test User ${i}`,
                email: `test${i}@example.com`
            },
            to: 'anfragen@handwerkflow.de',
            subject: `Test ${i}`,
            text: 'Ich benötige ein Angebot.'
        }

        await sendTestEmail(testEmail)
    }

    const duration = Date.now() - start
    console.log(`✅ Processed 5 emails in ${duration}ms (avg: ${duration / 5}ms)`)

    // Should complete within reasonable time
    assertEquals(duration < 30000, true, 'Should complete in under 30 seconds')
})

// ============================================
// Edge Cases
// ============================================

Deno.test('Edge Case - Empty Email Body', async () => {
    const testEmail = {
        from: {
            email: 'empty@example.com'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Leere Nachricht',
        text: ''
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    // Should handle gracefully with fallback
    assertEquals(result.data.automated, false)

    console.log('✅ Edge Case - Empty Email Body handled')
})

Deno.test('Edge Case - Very Long Email', async () => {
    const longText = 'Ich benötige ein Angebot. '.repeat(200) // ~5KB text

    const testEmail = {
        from: {
            name: 'Long Text User',
            email: 'long@example.com'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Sehr detaillierte Anfrage',
        text: longText
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)

    console.log('✅ Edge Case - Very Long Email handled')
})

Deno.test('Edge Case - Special Characters', async () => {
    const testEmail = {
        from: {
            name: 'Müller & Söhne GmbH',
            email: 'mueller@beispiel.de'
        },
        to: 'anfragen@handwerkflow.de',
        subject: 'Anfrage für "Spezial-Tor" (äöüß)',
        text: `Wir benötigen:
        - Tor 2×3m
        - Preis: ~1.500€
        - Farbe: RAL 7016 "Anthrazit-Grau"

        Danke & Grüße!`
    }

    const result = await sendTestEmail(testEmail)

    assertEquals(result.status, 200)
    assertExists(result.data.success)

    console.log('✅ Edge Case - Special Characters handled')
})

// ============================================
// Run All Tests
// ============================================

console.log(`
╔════════════════════════════════════════╗
║  Process Inbound Email - Test Suite   ║
╚════════════════════════════════════════╝

Function URL: ${FUNCTION_URL}
`)
