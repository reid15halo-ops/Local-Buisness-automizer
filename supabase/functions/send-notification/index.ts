// send-notification Edge Function
// Sends notifications via Telegram or WhatsApp (Twilio).
// API keys are stored as Supabase secrets, NOT exposed to the client.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel, message, chatId, toNumber } = await req.json()

    if (!channel || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'channel and message required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: { success: boolean; error?: string }

    if (channel === 'telegram') {
      result = await sendTelegram(message, chatId)
    } else if (channel === 'whatsapp') {
      result = await sendWhatsApp(message, toNumber)
    } else {
      result = { success: false, error: `Unknown channel: ${channel}` }
    }

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendTelegram(message: string, chatId?: string): Promise<{ success: boolean; error?: string }> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const defaultChatId = Deno.env.get('TELEGRAM_CHAT_ID')
  const targetChatId = chatId || defaultChatId

  if (!botToken) return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  if (!targetChatId) return { success: false, error: 'No chat_id provided' }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  const data = await response.json()
  if (data.ok) return { success: true }
  return { success: false, error: data.description || 'Telegram API error' }
}

async function sendWhatsApp(message: string, toNumber?: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM')
  const defaultTo = Deno.env.get('TWILIO_WHATSAPP_TO')
  const targetTo = toNumber || defaultTo

  if (!accountSid || !authToken) return { success: false, error: 'Twilio credentials not configured' }
  if (!fromNumber) return { success: false, error: 'TWILIO_WHATSAPP_FROM not configured' }
  if (!targetTo) return { success: false, error: 'No toNumber provided' }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = btoa(`${accountSid}:${authToken}`)

  const body = new URLSearchParams({
    From: `whatsapp:${fromNumber}`,
    To: `whatsapp:${targetTo}`,
    Body: message,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = await response.json()
  if (response.ok) return { success: true }
  return { success: false, error: data.message || `Twilio HTTP ${response.status}` }
}
