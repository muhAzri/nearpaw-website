// No 0/O/1/I so references survive being read aloud or typed from a screenshot.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Public reference such as RPT-7K2F9Q. */
export function generateReference(prefix: string, length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${out}`;
}
