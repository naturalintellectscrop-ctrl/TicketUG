import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
export function ticketCredentialHash(credential) { return createHash('sha256').update(credential).digest('hex'); }
export function ticketQrPayload(credential) { return `ticketug:v1:${credential}`; }
export async function ticketQrDataUrl(credential) { return QRCode.toDataURL(ticketQrPayload(credential), { errorCorrectionLevel: 'M', margin: 2, width: 320 }); }
