/** The pass has to survive the round trip byte for byte. A name that comes back
 *  mangled is not a cosmetic bug: it is the wrong person on a hike list.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeBase45, encodeBase45 } from "./base45.ts";
import { decodePass, encodePass, packPass, unpackPass } from "./payload.ts";
import {
  formatPhone,
  normalisePhone,
  normaliseStudentNumber,
  phoneError,
  studentNumberError,
} from "./validation.ts";

const pass = {
  name: "Ada Lovelace",
  studentNumber: "s5123456",
  phone: "0412345678",
};

test("base45 round-trips arbitrary bytes, both parities of length", () => {
  for (const length of [0, 1, 2, 3, 255, 256]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 91) % 256);
    assert.deepEqual(
      decodeBase45(encodeBase45(bytes)),
      bytes,
      `length ${length}`,
    );
  }
});

test("base45 output stays inside QR's alphanumeric set", () => {
  // Which is the whole reason for using it: the alphanumeric mode packs two
  // characters into 11 bits, and a decoder hands it back as text intact.
  const bytes = Uint8Array.from({ length: 512 }, (_, i) => i % 256);
  assert.match(encodeBase45(bytes), /^[0-9A-Z $%*+\-./:]*$/);
});

test("a pass round-trips every field exactly", () => {
  assert.deepEqual(decodePass(encodePass(pass)), pass);
});

test("names that are not plain ASCII survive", () => {
  for (const name of [
    "Siobhán O'Connor",
    "Jean-Luc Baptiste",
    "Konstantinos Papadopoulos",
    "Nguyễn Văn An",
  ]) {
    assert.equal(decodePass(encodePass({ ...pass, name })).name, name, name);
  }
});

test("leading zeros in the numbers are not lost", () => {
  // Both numbers are packed as integers rather than text, so padding them back
  // is the only thing standing between s0001234 and "s1234".
  const back = decodePass(
    encodePass({ ...pass, studentNumber: "s0001234", phone: "0400000001" }),
  );
  assert.equal(back.studentNumber, "s0001234");
  assert.equal(back.phone, "0400000001");
});

test("the numbers cost 7 bytes, not the 18 characters they read as", () => {
  assert.equal(packPass(pass).length, 2 + "Ada Lovelace".length + 3 + 4);
});

test("a whole pass fits a code anybody can scan", () => {
  // About thirty bytes, against the 411 the version carrying a photograph
  // needed - which is why this one needs no encoder and no byte budget.
  assert.ok(
    encodePass(pass).length < 60,
    `${encodePass(pass).length} characters`,
  );
});

test("a foreign or corrupt payload is rejected, not misread", () => {
  assert.throws(() => unpackPass(new Uint8Array([1, 2, 3])), /too short/);
  assert.throws(
    () => unpackPass(Uint8Array.from({ length: 20 }, () => 0)),
    /not a Griffith Hiking Club pass/,
  );
  assert.throws(() => unpackPass(packPass(pass).slice(0, 12)), /truncated/);
});

test("the student number rules match what the member is told", () => {
  assert.equal(studentNumberError("s5123456"), null);
  assert.equal(
    studentNumberError("S5123456"),
    null,
    "an uppercase S is corrected",
  );
  assert.equal(normaliseStudentNumber(" S5123456 "), "s5123456");
  assert.match(studentNumberError("5123456")!, /start with s/);
  assert.match(studentNumberError("s54250")!, /exactly 7/);
  assert.match(studentNumberError("sabcdefg")!, /digits/);
});

test("the phone rules match what the member is told", () => {
  assert.equal(phoneError("0412345678"), null);
  assert.equal(phoneError("0412 345 678"), null, "spaces are ignored");
  assert.equal(phoneError("+61431307335"), null, "+61 is treated as 0");
  assert.match(phoneError("0231307335")!, /starts with 04/);
  assert.match(phoneError("041234567")!, /exactly 10/);
  assert.equal(normalisePhone("(0412) 345-678"), "0412345678");
});

test("the phone formats as it is typed", () => {
  assert.equal(formatPhone("0412"), "0412");
  assert.equal(formatPhone("0412345"), "0412 345");
  assert.equal(formatPhone("0412345678"), "0412 345 678");
});

/* ---- hikers without a student number or a mobile ----------------------------
 * Staff, alumni, guests from another club, anyone visiting on an overseas
 * number. The pass still has to be a pass.
 */

test("a missing number round-trips as missing, not as zeros", () => {
  for (const absent of [
    { studentNumber: "" },
    { phone: "" },
    { studentNumber: "", phone: "" },
  ]) {
    const partial = { ...pass, ...absent };
    assert.deepEqual(
      decodePass(encodePass(partial)),
      partial,
      JSON.stringify(absent),
    );
  }
});

test("an absent number does not read back as a real one", () => {
  const { studentNumber, phone } = decodePass(
    encodePass({ ...pass, studentNumber: "", phone: "" }),
  );
  assert.equal(studentNumber, "", "not s0000000");
  assert.equal(phone, "", "not 0400000000");
});

test("a pass with nothing but a name still fits a scannable code", () => {
  const text = encodePass({ name: "Bo Li", studentNumber: "", phone: "" });
  assert.ok(text.length < 60, `${text.length} characters`);
  assert.match(text, /^[0-9A-Z $%*+\-./:]+$/);
});

test("the record is one width whether the numbers are there or not", () => {
  // A leader's scanner reads a fixed layout; an absent number must not shorten
  // it, or every field after it shifts.
  assert.equal(
    packPass({ ...pass, studentNumber: "", phone: "" }).length,
    packPass(pass).length,
  );
});

test("a waived field stops being required, and only that field", async () => {
  const { registrationErrors } = await import("./validation.ts");
  const blank = {
    firstName: "Ada",
    lastName: "Lovelace",
    studentNumber: "",
    phone: "",
  };

  const none = registrationErrors(blank);
  assert.ok(none.studentNumber, "required by default");
  assert.ok(none.phone, "required by default");

  const waived = registrationErrors(blank, { studentNumber: true });
  assert.equal(waived.studentNumber, null, "waived");
  assert.ok(waived.phone, "the other one is untouched");
  assert.equal(waived.firstName, null);
});
