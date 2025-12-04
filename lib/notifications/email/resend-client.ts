/**
 * Resend Email Client
 *
 * Small wrapper around Resend SDK so we keep integration
 * isolated and type-safe. This module is intended for
 * server-side use only.
 */

import { Resend } from "resend";

let resendInstance: Resend | null = null;

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }

  return resendInstance;
}

export async function sendEmail(params: SendEmailParams) {
  const resend = getResend();

  const from =
    params.from ||
    process.env.INVOICE_FROM_EMAIL ||
    "ARCLE <no-reply@arcle.app>";

  const payload = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  };

  const result = await resend.emails.send(payload);
  return result;
}


