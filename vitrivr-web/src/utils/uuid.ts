export function uuid(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;

  // Prefer native implementation when available
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  if (!cryptoObj?.getRandomValues) {
    // Last-resort fallback (should be rare in browsers)
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  // RFC 4122 v4 fallback using getRandomValues
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
