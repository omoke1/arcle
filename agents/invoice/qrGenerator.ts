/**
 * QR Code Generator for Invoices
 * 
 * Generates QR codes for invoice payment links
 */

import { getInvoiceLink, generateInvoiceLinkUrl, type InvoiceLink } from './oneTimeLink';

/**
 * Generate QR code data URL for invoice link
 */
export async function generateInvoiceQRCode(linkId: string, baseUrl?: string): Promise<string> {
  const invoiceUrl = generateInvoiceLinkUrl(linkId, baseUrl);
  
  // In a real implementation, you would use a QR code library:
  // import QRCode from 'qrcode';
  // return await QRCode.toDataURL(invoiceUrl);
  
  // For now, return a placeholder
  // TODO: Integrate with qrcode.react or similar library
  // Using btoa for browser compatibility instead of Buffer
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <text x="10" y="100" font-family="Arial" font-size="12">Invoice QR: ${linkId.substring(0, 8)}</text>
    </svg>
  `;
  const base64 = typeof window !== 'undefined' 
    ? btoa(svgContent) 
    : Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Get invoice link with QR code
 */
export async function getInvoiceWithQR(linkId: string, baseUrl?: string): Promise<InvoiceLink & { qrCodeDataUrl?: string } | null> {
  const link = await getInvoiceLink(linkId);
  
  if (!link) {
    return null;
  }

  const qrCodeDataUrl = await generateInvoiceQRCode(linkId, baseUrl);

  return {
    ...link,
    qrCodeDataUrl,
  };
}

