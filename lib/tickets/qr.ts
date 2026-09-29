import { createHash } from 'node:crypto'
import QRCode from 'qrcode'

export function ticketCredentialHash(credential: string) { return createHash('sha256').update(credential).digest('hex') }
export function ticketQrPayload(credential: string) { return `ticketug:v1:${credential}` }
export async function ticketQrDataUrl(credential: string) { return QRCode.toDataURL(ticketQrPayload(credential), { errorCorrectionLevel: 'M', margin: 2, width: 320 }) }

// PNG twin of ticketQrDataUrl for print surfaces (PDF tickets). Same payload,
// same encoder — the QR is a representation of the credential, and the backend
// stays authoritative at scan time.
export async function ticketQrPng(credential: string) { return QRCode.toBuffer(ticketQrPayload(credential), { errorCorrectionLevel: 'M', margin: 2, width: 320, type: 'png' }) }

