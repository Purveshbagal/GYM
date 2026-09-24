// Fast2SMS WhatsApp Business API (docs.fast2sms.com/reference/sendwhatsappmessage).
// Sends pre-approved template messages; message_id below is the numeric id
// Fast2SMS's WhatsApp Manager shows per template (not the longer "template id").
const FAST2SMS_WHATSAPP_URL = "https://www.fast2sms.com/dev/whatsapp";

const GYM_NAME = process.env.GYM_NAME || "Shree Ram Fitness";

const TEMPLATE_MESSAGE_IDS = {
  welcome: process.env.FAST2SMS_TEMPLATE_WELCOME_ID || "34123",
  expiry7Day: process.env.FAST2SMS_TEMPLATE_7DAYS_ID || "34124",
  expired: process.env.FAST2SMS_TEMPLATE_EXPIRED_ID || "34125",
} as const;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Fast2SMS's `numbers` param wants a bare 10-digit Indian mobile number -
// strip formatting/country code so numbers saved as "+91 98765-43210" etc.
// still work.
function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

/**
 * Sends one WhatsApp template message via Fast2SMS. Never throws - a
 * missing API key (not configured yet) or a delivery failure is logged and
 * swallowed so notification sending can never break member create/renew/
 * expiry flows that trigger it.
 */
async function sendWhatsAppTemplate(messageId: string, phone: string, variables: string[]) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const phoneNumberId = process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID;
  const number = normalizePhone(phone);

  if (!apiKey || !phoneNumberId) {
    console.warn("[whatsapp] skipped: FAST2SMS_API_KEY / FAST2SMS_WHATSAPP_PHONE_NUMBER_ID not configured");
    return { ok: false, skipped: true };
  }
  if (number.length !== 10) {
    console.warn(`[whatsapp] skipped: invalid phone number "${phone}"`);
    return { ok: false, skipped: true };
  }

  const url = new URL(FAST2SMS_WHATSAPP_URL);
  url.searchParams.set("message_id", messageId);
  url.searchParams.set("phone_number_id", phoneNumberId);
  url.searchParams.set("numbers", number);
  url.searchParams.set("variables_values", variables.join("|"));

  try {
    const res = await fetch(url.toString(), { headers: { authorization: apiKey } });
    const data = await res.json();
    if (!res.ok || data?.status === false) {
      console.error("[whatsapp] send failed:", data);
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch (err) {
    console.error("[whatsapp] send error:", err);
    return { ok: false, error: String(err) };
  }
}

export async function sendWelcomeWhatsApp(member: {
  name: string;
  phone: string;
  membershipStart?: Date;
  membershipEnd?: Date;
}) {
  const start = member.membershipStart ?? new Date();
  const end = member.membershipEnd ?? new Date();
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  return sendWhatsAppTemplate(TEMPLATE_MESSAGE_IDS.welcome, member.phone, [
    member.name,
    GYM_NAME,
    String(days),
    formatDate(start),
    formatDate(end),
  ]);
}

export async function send7DayExpiryWhatsApp(member: { name: string; phone: string; membershipEnd: Date }) {
  return sendWhatsAppTemplate(TEMPLATE_MESSAGE_IDS.expiry7Day, member.phone, [
    member.name,
    formatDate(member.membershipEnd),
  ]);
}

export async function sendExpiredWhatsApp(member: { name: string; phone: string; membershipEnd: Date }) {
  return sendWhatsAppTemplate(TEMPLATE_MESSAGE_IDS.expired, member.phone, [
    member.name,
    formatDate(member.membershipEnd),
  ]);
}
