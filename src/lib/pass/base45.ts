/** Base45, as used by the EU digital covid certificates (RFC 9285 draft).
 *
 *  The QR carries binary, but jsQR hands back a *string* - arbitrary bytes do not
 *  survive that. Base45 maps two bytes onto three characters drawn from QR's
 *  alphanumeric set, so the payload stays inside a mode the decoder returns
 *  intact. It costs about 6% against raw byte mode, which is the price of the
 *  data arriving unmangled.
 */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const VALUES = new Map([...ALPHABET].map((c, i) => [c, i]));

export const encodeBase45 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const v = bytes[i]! * 256 + bytes[i + 1]!;
      out +=
        ALPHABET[v % 45]! +
        ALPHABET[Math.floor(v / 45) % 45]! +
        ALPHABET[Math.floor(v / 45 / 45)]!;
    } else {
      const v = bytes[i]!;
      out += ALPHABET[v % 45]! + ALPHABET[Math.floor(v / 45)]!;
    }
  }
  return out;
};

export const decodeBase45 = (text: string): Uint8Array => {
  const digits = [...text].map((c) => {
    const v = VALUES.get(c);
    if (v === undefined) throw new Error(`not base45: ${JSON.stringify(c)}`);
    return v;
  });

  const out: number[] = [];
  for (let i = 0; i < digits.length; i += 3) {
    if (i + 2 < digits.length) {
      const v = digits[i]! + digits[i + 1]! * 45 + digits[i + 2]! * 45 * 45;
      if (v > 0xffff) throw new Error("base45 triplet out of range");
      out.push(v >> 8, v & 0xff);
    } else if (i + 1 < digits.length) {
      const v = digits[i]! + digits[i + 1]! * 45;
      if (v > 0xff) throw new Error("base45 pair out of range");
      out.push(v);
    } else {
      throw new Error("base45 length is not 2 or 3 per group");
    }
  }
  return Uint8Array.from(out);
};
