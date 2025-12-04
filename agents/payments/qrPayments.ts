/**
 * QR Code Payment Links
 * 
 * Generates QR codes for payment links (for freelancers/businesses)
 */

import { createOneTimeLink, generatePaymentLinkUrl, type PaymentLink } from './oneTimeLinks';
import type { OneTimeLinkParams } from './oneTimeLinks';

export interface QRPaymentParams extends OneTimeLinkParams {
  merchantName?: string;
  merchantId?: string;
}

export interface QRPaymentLink extends PaymentLink {
  qrCodeDataUrl?: string;
  merchantName?: string;
  merchantId?: string;
}

/**
 * Create a QR payment link
 */
export async function createQRPaymentLink(params: QRPaymentParams): Promise<QRPaymentLink> {
  const link = await createOneTimeLink(params);
  
  const qrLink: QRPaymentLink = {
    ...link,
    merchantName: params.merchantName,
    merchantId: params.merchantId,
  };

  return qrLink;
}

/**
 * Generate QR code data URL for payment link
 * This would typically use a QR code library like 'qrcode' or 'qrcode.react'
 */
export async function generateQRCodeDataUrl(linkId: string, baseUrl?: string): Promise<string> {
  const paymentUrl = generatePaymentLinkUrl(linkId, baseUrl);
  
  // In a real implementation, you would use a QR code library:
  // import QRCode from 'qrcode';
  // return await QRCode.toDataURL(paymentUrl);
  
  // For now, return a placeholder
  // TODO: Integrate with qrcode.react or similar library
  // Using btoa for browser compatibility instead of Buffer
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <text x="10" y="100" font-family="Arial" font-size="12">QR: ${linkId.substring(0, 8)}</text>
    </svg>
  `;
  const base64 = typeof window !== 'undefined' 
    ? btoa(svgContent) 
    : Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Get QR payment link with QR code
 */
export async function getQRPaymentLink(linkId: string, baseUrl?: string): Promise<QRPaymentLink | null> {
  const { getPaymentLink } = await import('./oneTimeLinks');
  const link = await getPaymentLink(linkId);
  
  if (!link) {
    return null;
  }

  const qrCodeDataUrl = await generateQRCodeDataUrl(linkId, baseUrl);

  return {
    ...link,
    qrCodeDataUrl,
  } as QRPaymentLink;
}

