// =====================================================================
// redact.js: takes contact details out of free text before it is stored.
//
// The chat saves the messages it couldn't understand, so the rules can be taught new words
// (chat-miss). People sometimes type their email or phone number into a chat, so those are
// replaced before anything is saved. Long numbers go too (a SIN, an account number), and so do
// Canadian postal codes. What's left is the wording, which is all the review needs.
// =====================================================================

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;            // 902-555-0100, (902) 555 0100, +1 902 555 0100
const LONG_NUMBER = /\b\d{6,}\b/g;                  // SIN, account and card numbers
const POSTAL = /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/g; // B3A 1A1

export function redact(text, max = 300) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[number]')
    .replace(LONG_NUMBER, '[number]')
    .replace(POSTAL, '[postal code]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
