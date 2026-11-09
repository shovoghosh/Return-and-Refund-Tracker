import { getEnv } from "./env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  delivered: boolean;
  providerMessageId: string | null;
  /** True when the message was only logged instead of sent (local dev). */
  devLogged: boolean;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Sends one transactional email through Resend's HTTP API.
 *
 * Workers cannot open raw SMTP connections, so nodemailer is not an option in
 * production. With no RESEND_API_KEY configured (the local/dev case) the message
 * is written to stdout and reported as devLogged rather than silently dropped,
 * so reminder behaviour is still observable without a provider.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const env = getEnv();

  if (!env.RESEND_API_KEY) {
    console.log(
      [
        "── [dev mail] ──────────────────────────────",
        `to: ${message.to}`,
        `from: ${env.EMAIL_FROM}`,
        `subject: ${message.subject}`,
        "",
        message.text,
        "────────────────────────────────────────────",
      ].join("\n"),
    );
    return { delivered: true, providerMessageId: null, devLogged: true };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });

  if (!response.ok) {
    // Keep the body short: it can echo the recipient address back.
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Resend rejected the message (${response.status}): ${detail}`);
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return {
    delivered: true,
    providerMessageId: data.id ?? null,
    devLogged: false,
  };
}

/** True when a real provider is configured. Used by the settings/health copy. */
export async function verifyMailTransport(): Promise<boolean> {
  return Boolean(getEnv().RESEND_API_KEY);
}
