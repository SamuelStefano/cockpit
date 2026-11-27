const FREE_TEXT_RE = /^\s*(?:outro|outra|other|escreva|escrever|digite|write\b|type\b|custom|something else|algo diferente)/i;

export function isFreeTextOption(label: string): boolean {
  return FREE_TEXT_RE.test(label);
}
