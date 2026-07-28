/** A pass has to survive the round trip field for field. A name that comes back
 *  mangled is not a cosmetic bug: it is the wrong person on a hike list.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { SITE, passLink, readPass } from "./link.ts";
import {
  formatPhone,
  normalisePhone,
  normaliseStudentNumber,
  phoneError,
  registrationErrors,
  studentNumberError,
} from "./validation.ts";

const pass = {
  firstName: "Ada",
  lastName: "Lovelace",
  studentNumber: "s5123456",
  phone: "0412345678",
};

test("a pass round-trips every field exactly", () => {
  assert.deepEqual(readPass(passLink(pass)), pass);
});

test("a name survives whatever it is spelled with", () => {
  for (const [firstName, lastName] of [
    ["Siobhán", "O’Connor"],
    ["Nguyễn", "Văn An"],
    ["Ada", "Lovelace-Byron"],
    ["Æthelred", "Þórsdóttir"],
    ["李", "明"],
  ]) {
    const back = readPass(passLink({ ...pass, firstName, lastName }));
    assert.equal(back.firstName, firstName, firstName);
    assert.equal(back.lastName, lastName, lastName);
  }
});

test("a space in a name is a space when it comes back", () => {
  // URLSearchParams writes a space as +, which only round-trips if it is read
  // back through URLSearchParams too.
  const lastName = "van der Berg";
  assert.equal(readPass(passLink({ ...pass, lastName })).lastName, lastName);
});

test("leading zeros are not lost", () => {
  const back = readPass(
    passLink({ ...pass, studentNumber: "s0001234", phone: "0400000001" }),
  );
  assert.equal(back.studentNumber, "s0001234");
  assert.equal(back.phone, "0400000001");
});

/* ---- what a stranger's phone does with it ---------------------------------- */

test("anyone who scans a pass is taken to the club", () => {
  assert.ok(passLink(pass).startsWith(SITE), passLink(pass));
  assert.doesNotThrow(() => new URL(passLink(pass)));
});

test("the details are in the fragment, never the query string", () => {
  // The whole reason for the fragment: a query string is sent to the server, and
  // these are somebody's name, student number and mobile.
  const url = new URL(passLink(pass));
  assert.equal(url.search, "", "nothing in the query string");
  assert.match(url.hash, /s=s5123456/);
  assert.ok(!passLink(pass).includes("?"), "no query string at all");
});

test("a link that is not ours is refused", () => {
  for (const foreign of [
    "https://example.com/#f=Ada&l=Lovelace",
    "https://griffithhiking.club.evil.test/#f=Ada",
    "https://griffithict.club/#f=Ada",
    `${SITE}somewhere-else#f=Ada`,
  ]) {
    assert.throws(
      () => readPass(foreign),
      /not a Griffith Hiking Club pass/,
      foreign,
    );
  }
});

test("a pass missing its fields reads back empty rather than guessing", () => {
  assert.deepEqual(readPass(SITE + "#"), {
    firstName: "",
    lastName: "",
    studentNumber: "",
    phone: "",
  });
});

/* ---- hikers without a student number or a mobile --------------------------- */

test("a waived field round-trips as absent", () => {
  for (const absent of [
    { studentNumber: "" },
    { phone: "" },
    { studentNumber: "", phone: "" },
  ]) {
    const partial = { ...pass, ...absent };
    assert.deepEqual(
      readPass(passLink(partial)),
      partial,
      JSON.stringify(absent),
    );
  }
});

test("an absent number does not read back as a real one", () => {
  const back = readPass(passLink({ ...pass, studentNumber: "", phone: "" }));
  assert.equal(back.studentNumber, "", "not s0000000");
  assert.equal(back.phone, "", "not 0400000000");
});

test("a waived field stops being required, and only that field", () => {
  const blank = { ...pass, studentNumber: "", phone: "" };

  const none = registrationErrors(blank);
  assert.ok(none.studentNumber, "required by default");
  assert.ok(none.phone, "required by default");

  const waived = registrationErrors(blank, { studentNumber: true });
  assert.equal(waived.studentNumber, null, "waived");
  assert.ok(waived.phone, "the other one is untouched");
  assert.equal(waived.firstName, null);
});

/* ---- and it has to stay scannable ------------------------------------------ */

test("a pass fits a code a phone can read across a car park", async () => {
  // The longest realistic pass: a long double-barrelled name with accents, which
  // percent-encoding makes longer still.
  const longest = await QRCode.create(
    passLink({
      ...pass,
      firstName: "Konstantinos",
      lastName: "Papadopoulos-Whitfield",
    }),
    { errorCorrectionLevel: "M" },
  );

  assert.ok(
    longest.version <= 8,
    `version ${longest.version} (${longest.modules.size} modules) is denser than a phone camera should have to cope with`,
  );
});

/* ---- the rules a hiker has to meet ---------------------------------------- */

test("a student number is a lowercase s and seven digits", () => {
  assert.equal(studentNumberError("s5123456"), null);
  assert.equal(
    studentNumberError("S5123456"),
    null,
    "an uppercase S is corrected",
  );
  assert.equal(normaliseStudentNumber(" S5123456 "), "s5123456");
  assert.match(studentNumberError("5123456")!, /start with s/);
  assert.match(studentNumberError("s512")!, /exactly 7/);
  assert.match(studentNumberError("")!, /required/);
});

test("a phone number is an Australian mobile", () => {
  assert.equal(phoneError("0412345678"), null);
  assert.equal(phoneError("0412 345 678"), null, "spaces are ignored");
  assert.equal(normalisePhone("+61412345678"), "0412345678", "+61 becomes 0");
  assert.match(phoneError("0312345678")!, /starts with 04/);
  assert.match(phoneError("041234567")!, /exactly 10/);
  assert.equal(normalisePhone("(0412) 345-678"), "0412345678");
});

test("a phone number is grouped the way it is read aloud", () => {
  assert.equal(formatPhone("0412"), "0412");
  assert.equal(formatPhone("0412345"), "0412 345");
  assert.equal(formatPhone("0412345678"), "0412 345 678");
});
