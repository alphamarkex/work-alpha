// WhatsApp reminders via Twilio. Uses plain fetch against Twilio's REST API,
// so no extra SDK dependency is required.
//
// SETUP:
//  1. Create a Twilio account: https://console.twilio.com
//  2. For quick testing, join the WhatsApp Sandbox (Messaging > Try it out >
//     Send a WhatsApp message) and set TWILIO_WHATSAPP_FROM to the sandbox
//     number shown there (e.g. "whatsapp:+14155238886"). Recipients must
//     first send the sandbox join code from their own WhatsApp.
//  3. For production, apply for a WhatsApp-enabled Twilio number and get a
//     message template approved — WhatsApp does not allow freeform
//     business-initiated messages outside a 24h customer-service window.
//     Once approved, send using the template's Content SID instead of a
//     freeform body (see sendWhatsAppTemplate below).

export interface SendWhatsAppResult {
  sent: boolean;
  error?: string;
}

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM
  );
}

function normalizeWhatsAppNumber(raw: string): string {
  return raw.startsWith('whatsapp:') ? raw : `whatsapp:${raw}`;
}

async function postToTwilio(params: Record<string, string>): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!isConfigured()) {
    return { sent: false, error: 'WhatsApp is not configured (missing Twilio env vars)' };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, error: errText };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Sends a freeform WhatsApp message. Works out of the box on the Twilio
 * Sandbox; on a production WhatsApp number this only succeeds if the
 * recipient messaged you within the last 24 hours. For reminders sent
 * proactively in production, use sendWhatsAppTemplate instead.
 */
export async function sendWhatsApp({ to, body }: { to: string; body: string }): Promise<SendWhatsAppResult> {
  if (!to) return { sent: false, error: 'No recipient number' };

  return postToTwilio({
    From: process.env.TWILIO_WHATSAPP_FROM ?? '',
    To: normalizeWhatsAppNumber(to),
    Body: body,
  });
}

/**
 * Sends an approved WhatsApp template message (required for
 * business-initiated messages like reminders once you're off the sandbox).
 * contentSid comes from a template approved in the Twilio Console; variables
 * map to the template's numbered placeholders ({{1}}, {{2}}, ...).
 */
export async function sendWhatsAppTemplate({
  to,
  contentSid,
  variables,
}: {
  to: string;
  contentSid: string;
  variables: Record<string, string>;
}): Promise<SendWhatsAppResult> {
  if (!to) return { sent: false, error: 'No recipient number' };

  return postToTwilio({
    From: process.env.TWILIO_WHATSAPP_FROM ?? '',
    To: normalizeWhatsAppNumber(to),
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  });
}

export function isWhatsAppConfigured() {
  return isConfigured();
}

/**
 * Sends a meeting reminder using the approved Twilio Content Template
 * (falls back to a freeform message if no template SID is configured —
 * freeform only works on the Sandbox or within a 24h reply window).
 */
export async function sendMeetingReminderWhatsApp(params: {
  to: string;
  dateLabel: string; // e.g. "12/1"
  timeLabel: string; // e.g. "3pm"
  fallbackBody: string;
}): Promise<SendWhatsAppResult> {
  const templateSid = process.env.TWILIO_MEETING_TEMPLATE_SID;
  if (templateSid) {
    return sendWhatsAppTemplate({
      to: params.to,
      contentSid: templateSid,
      variables: { '1': params.dateLabel, '2': params.timeLabel },
    });
  }
  return sendWhatsApp({ to: params.to, body: params.fallbackBody });
}
