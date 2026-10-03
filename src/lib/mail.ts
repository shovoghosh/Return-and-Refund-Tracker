import nodemailer, { type Transporter } from "nodemailer";
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
  /** True when the dev transport was used instead of a real SMTP send. */
  devLogged: boolean;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const env = getEnv();
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Sends one email. With no SMTP_HOST configured (the local/dev case) the message
 * is written to stdout and reported as devLogged rather than silently dropped, so
 * reminder behaviour is still observable without a mail provider.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const env = getEnv();
  const tx = getTransporter();

  if (!tx) {
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

  const info = await tx.sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return {
    delivered: true,
    providerMessageId: (info.messageId as string | undefined) ?? null,
    devLogged: false,
  };
}

export async function verifyMailTransport(): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) return false;
  try {
    await tx.verify();
    return true;
  } catch {
    return false;
  }
}
