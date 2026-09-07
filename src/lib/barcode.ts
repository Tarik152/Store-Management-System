/**
 * EAN-13 barcode generation for in-store use.
 * Prefixes 200–299 are reserved by GS1 for internal/in-store use,
 * so generated codes will never collide with real manufacturer codes.
 */

export function ean13ChecksumDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(first12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function generateEan13(random: () => number = Math.random): string {
  // 20x prefix = internal use
  const prefix = "20" + String(1 + Math.floor(random() * 9)); // 201..209
  let body = prefix;
  while (body.length < 12) {
    body += String(Math.floor(random() * 10));
  }
  return body + String(ean13ChecksumDigit(body));
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13ChecksumDigit(code.slice(0, 12)) === Number(code[12]);
}
