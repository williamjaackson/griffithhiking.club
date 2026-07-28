import { decodeBase45, encodeBase45 } from "./base45.ts";
import type { Registration } from "./validation.ts";

/** The pass record, packed as tightly as it will go.
 *
 *  Every byte spent here is a byte the face does not get, and at the sizes this
 *  runs at that is the difference between a recognisable person and a smudge. So
 *  the two numbers are stored as numbers - the student number's 7 digits fit in 3
 *  bytes, the phone's 8 digits after "04" fit in 4 - rather than as the 18
 *  characters they read as.
 *
 *    magic + format   1 B
 *    name length      1 B
 *    name             n B   UTF-8, "First Last"
 *    student number   3 B   big-endian, the 7 digits
 *    phone            4 B   big-endian, the 8 digits after 04
 *
 *  No photograph. It was the reason the earlier version needed a v13 code and a
 *  WASM encoder; without it a whole pass is about thirty bytes and fits in a
 *  code small enough to read across a car park. */

/** One byte, split in half: a magic nibble so a foreign QR is rejected rather
 *  than misread, and a format nibble so a later layout is detectable. Four bits
 *  of magic is weak on its own, which is why the structure is checked too - but
 *  a whole byte of magic is a byte the face does not get. */
const MAGIC = 0x6;
const FORMAT = 1;
const HEADER = (MAGIC << 4) | FORMAT;

export interface Pass {
  name: string;
  /** Empty when the hiker has said they are not a current student. */
  studentNumber: string;
  /** Empty when the hiker has said they have no Australian mobile. */
  phone: string;
}

/** Zero is the absent marker for both numbers, and it costs nothing: there is no
 *  student s0000000 and no mobile 0400000000, so the sentinel cannot collide with
 *  a real value and the record stays a fixed width either way. */
const ABSENT = 0;

export const packPass = (pass: Pass): Uint8Array => {
  const name = new TextEncoder().encode(pass.name);
  if (name.length > 255) throw new Error("name is too long to pack");

  const student = pass.studentNumber
    ? Number(pass.studentNumber.slice(1))
    : ABSENT;
  const phone = pass.phone ? Number(pass.phone.slice(2)) : ABSENT;

  const out = new Uint8Array(1 + 1 + name.length + 3 + 4);
  const view = new DataView(out.buffer);
  let at = 0;

  out[at++] = HEADER;
  out[at++] = name.length;
  out.set(name, at);
  at += name.length;

  // 3 bytes for a 7-digit number: max 9,999,999 < 2^24.
  out[at++] = (student >>> 16) & 0xff;
  out[at++] = (student >>> 8) & 0xff;
  out[at++] = student & 0xff;

  view.setUint32(at, phone);
  return out;
};

export const unpackPass = (bytes: Uint8Array): Pass => {
  if (bytes.length < 9) throw new Error("pass is too short");
  if (bytes[0] !== HEADER) throw new Error("not a Griffith Hiking Club pass");

  let at = 1;
  const nameLength = bytes[at++]!;
  if (bytes.length < 2 + nameLength + 7) throw new Error("pass is truncated");

  const name = new TextDecoder().decode(bytes.subarray(at, at + nameLength));
  at += nameLength;

  const student = (bytes[at]! << 16) | (bytes[at + 1]! << 8) | bytes[at + 2]!;
  at += 3;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const phone = view.getUint32(at);

  return {
    name,
    studentNumber:
      student === ABSENT ? "" : `s${String(student).padStart(7, "0")}`,
    phone: phone === ABSENT ? "" : `04${String(phone).padStart(8, "0")}`,
  };
};

/** What the QR actually carries. */
export const encodePass = (pass: Pass): string => encodeBase45(packPass(pass));

export const decodePass = (text: string): Pass =>
  unpackPass(decodeBase45(text));

export const fullName = (r: Registration): string =>
  `${r.firstName.trim()} ${r.lastName.trim()}`;
