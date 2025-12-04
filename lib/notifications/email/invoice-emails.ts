/**
 * Invoice and Payment Link Email Helpers
 *
 * Uses Resend via the shared client to send invoice-related emails.
 */

import { sendEmail } from "./resend-client";

interface BaseInvoiceEmailParams {
  to: string;
  amount: string;
  currency?: string;
  description?: string;
  invoiceUrl: string;
  invoiceNumber?: string;
  dueDate?: string;
}

export async function sendInvoiceCreatedEmail(params: BaseInvoiceEmailParams) {
  const currency = params.currency || "USDC";

  const subject = params.invoiceNumber
    ? `Invoice ${params.invoiceNumber} from ARCLE`
    : `New invoice from ARCLE`;

  const prettyDescription = params.description
    ? ` for <strong>${params.description}</strong>`
    : "";

  const prettyDue =
    params.dueDate && params.dueDate.trim().length > 0
      ? `<p style="margin:0 0 8px 0;font-size:14px;color:#94a3b8;">Due date: <strong>${params.dueDate}</strong></p>`
      : "";

  const html = `
  <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#020617;padding:24px;color:#e2e8f0;">
    <div style="max-width:480px;margin:0 auto;background:#020617;border:1px solid #1e293b;border-radius:16px;padding:24px;">
      <h1 style="margin:0 0 16px 0;font-size:20px;color:#e2e8f0;">You've received an invoice</h1>
      <p style="margin:0 0 12px 0;font-size:14px;color:#cbd5f5;">
        An invoice has been created for <strong>${params.amount} ${currency}</strong>${prettyDescription}.
      </p>
      ${prettyDue}
      <p style="margin:0 0 16px 0;font-size:14px;color:#94a3b8;">
        You can review and pay the invoice securely using the link below:
      </p>
      <p style="margin:0 0 16px 0;">
        <a href="${params.invoiceUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#eab308;color:#020617;font-weight:600;font-size:14px;text-decoration:none;">
          View & Pay Invoice
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break:break-all;color:#e5e7eb;">${params.invoiceUrl}</span>
      </p>
    </div>
  </div>
  `;

  const text = `You've received an invoice for ${params.amount} ${currency}${
    params.description ? ` for ${params.description}` : ""
  }.\n\nView and pay the invoice here: ${params.invoiceUrl}`;

  await sendEmail({
    to: params.to,
    subject,
    html,
    text,
  });
}



