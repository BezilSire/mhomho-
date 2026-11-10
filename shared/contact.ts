/**
 * MHOMHO — public contact details.
 *
 * One source of truth for the number a customer sees on the site and the
 * number a WhatsApp message actually reaches. Change it here only.
 *
 * The number is a Zimbabwean mobile line (078 …). WhatsApp links must use the
 * international format without the leading zero, so the local number is stored
 * once and the international form is derived from it.
 */

/** Local format, as a Zimbabwean would read it aloud. */
export const MHOMHO_WHATSAPP_LOCAL = '0781190139';

/** E.164 format: country code 263, then the 9-digit national number. */
export const MHOMHO_WHATSAPP_E164 = '+263781190139';

/** Pretty display form for the site. */
export const MHOMHO_WHATSAPP_DISPLAY = '+263 78 119 0139';

export const MHOMHO_SUPPORT_EMAIL = 'support@mhomho.work';

/**
 * Builds a wa.me deep link. The optional message is pre-filled so a visitor
 * can start the conversation without typing the number in.
 */
export function mhomhoWhatsappLink(message?: string): string {
  const digits = MHOMHO_WHATSAPP_E164.replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}
