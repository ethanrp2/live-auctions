import { config } from "../config.js";

/**
 * Sends an SMS via Twilio REST API using raw fetch (no SDK).
 * Disabled by default until Twilio phone verification/A2P is complete.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const {
    smsEnabled,
    twilioAccountSid: sid,
    twilioAuthToken: authToken,
    twilioPhoneNumber: from,
  } = config;

  if (!smsEnabled) {
    console.warn("[sms] SMS_ENABLED is not true — skipping SMS send");
    return;
  }

  if (!sid || !authToken || !from) {
    console.warn("[sms] Twilio config incomplete — skipping SMS send");
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const credentials = Buffer.from(`${sid}:${authToken}`).toString("base64");

  const formBody = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Twilio SMS failed: ${res.status} ${res.statusText} — ${text}`);
  }
}
