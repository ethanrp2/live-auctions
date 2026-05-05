import { supabaseAdmin } from "./supabase.js";
import { sendSms } from "./sms.js";

function formatMoneyCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

interface SmsSubscriberRow {
  phone_number: string;
}

interface ProfileRow {
  shipping_address: Record<string, unknown> | null;
}

/**
 * Sends an "auction starting" SMS blast to all subscribers for the tenant.
 */
export async function notifyAuctionStarting(
  auctionId: string,
  tenantId: string,
  auctionTitle: string
): Promise<void> {
  const { data: subscribers, error } = await supabaseAdmin
    .from("sms_subscribers")
    .select("phone_number")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[sms-triggers] Failed to fetch subscribers for notifyAuctionStarting:", error);
    return;
  }

  if (!subscribers || subscribers.length === 0) return;

  const message = `${auctionTitle} auction is starting now! Bid live at auction.basta.app/${auctionId}`;

  await Promise.allSettled(
    (subscribers as SmsSubscriberRow[]).map((s) => sendSms(s.phone_number, message))
  );
}

/**
 * Sends a "lot on deck" SMS blast to all subscribers for the tenant.
 */
export async function notifyLotOnDeck(
  auctionId: string,
  tenantId: string,
  lotTitle: string,
  lotNumber: number
): Promise<void> {
  const { data: subscribers, error } = await supabaseAdmin
    .from("sms_subscribers")
    .select("phone_number")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[sms-triggers] Failed to fetch subscribers for notifyLotOnDeck:", error);
    return;
  }

  if (!subscribers || subscribers.length === 0) return;

  // Keep message under 160 chars; auctionId is for internal context only
  void auctionId;
  const message = `LOT ${lotNumber}: ${lotTitle} is up next!`;

  await Promise.allSettled(
    (subscribers as SmsSubscriberRow[]).map((s) => sendSms(s.phone_number, message))
  );
}

/**
 * Sends a "you won" SMS to the winner (via their profile shipping_address.phone).
 */
export async function notifyWinner(
  userId: string,
  tenantId: string,
  lotTitle: string,
  salePriceCents: number
): Promise<void> {
  // tenantId reserved for future scoping
  void tenantId;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("shipping_address")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    console.error("[sms-triggers] Failed to fetch profile for notifyWinner:", error);
    return;
  }

  const phone = profile?.shipping_address?.phone as string | undefined;
  if (!phone) {
    // No phone on file — skip silently
    return;
  }

  const message = `Congratulations! You won ${lotTitle} for ${formatMoneyCents(salePriceCents)}. The seller will contact you.`;

  await sendSms(phone, message);
}
