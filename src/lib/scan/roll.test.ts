/** The roll decides who is counted. A wrong answer here is a hiker missing from
 *  a list that exists to know who is on the mountain.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CSV_HEADER,
  activityAt,
  checkIn,
  checkOut,
  cooldown,
  editDetails,
  fileName,
  fill,
  gaps,
  identity,
  latestFirst,
  newRoll,
  otherHikeId,
  outCount,
  remove,
  restore,
  stillOut,
  toCsv,
  toText,
  withGaps,
} from "./roll.ts";

const hike = { id: "abc123", title: "Morans Falls", start: "2026-09-12" };

const ada = {
  firstName: "Ada",
  lastName: "Lovelace",
  studentNumber: "s5123456",
  phone: "0412345678",
};

const grace = {
  firstName: "Grace",
  lastName: "Hopper",
  studentNumber: "",
  phone: "0400000001",
};

const at = (minute: number) => new Date(Date.UTC(2026, 8, 12, 21, minute));

test("a pass checks in once", () => {
  const first = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  assert.equal(first.outcome.kind, "added");
  assert.equal(first.roll.rows.length, 1);

  const again = checkIn(first.roll, ada, { at: at(5), how: "scan" });
  assert.equal(again.outcome.kind, "repeat");
  assert.equal(again.roll, first.roll, "the roll is returned untouched");
  // The row reported is the original, so the screen can say when.
  assert.equal(again.outcome.row.at, at(0).toISOString());
});

test("the student number is the identity when there is one", () => {
  const renamed = { ...ada, firstName: "Augusta", phone: "0499999999" };
  assert.equal(identity(renamed), identity(ada));
});

test("without a student number, name and phone together are", () => {
  const same = { ...grace, firstName: "GRACE", lastName: "hopper" };
  assert.equal(identity(same), identity(grace));

  const otherPhone = { ...grace, phone: "0400000002" };
  assert.notEqual(identity(otherPhone), identity(grace));
});

test("a row without a number is a gap, not an error", () => {
  assert.deepEqual(gaps(grace), { studentNumber: true, phone: false });
  assert.deepEqual(gaps(ada), { studentNumber: false, phone: false });

  const { roll } = checkIn(newRoll(hike), grace, { at: at(0), how: "scan" });
  assert.equal(withGaps(roll).length, 1);
});

test("filling a gap keeps everything else about the row", () => {
  const { roll, outcome } = checkIn(newRoll(hike), grace, {
    at: at(0),
    how: "scan",
    id: "row-1",
  });
  assert.equal(outcome.kind, "added");

  const filled = fill(roll, "row-1", "studentNumber", "s5000001");
  const [row] = filled.rows;
  assert.equal(row.studentNumber, "s5000001");
  assert.equal(row.phone, grace.phone);
  assert.equal(row.at, at(0).toISOString());
  assert.equal(withGaps(filled).length, 0);
});

test("editing details changes the registration without changing the attendance", () => {
  const { roll, outcome } = checkIn(newRoll(hike), ada, {
    at: at(0),
    how: "scan",
    id: "row-1",
  });
  assert.equal(outcome.kind, "added");

  const edited = editDetails(roll, "row-1", {
    firstName: "Augusta",
    lastName: "King",
    studentNumber: "s5000001",
    phone: "0400000002",
  });
  const [row] = edited.rows;
  assert.deepEqual(row, {
    ...outcome.row,
    firstName: "Augusta",
    lastName: "King",
    studentNumber: "s5000001",
    phone: "0400000002",
  });
});

test("removing and restoring a row leaves it where it was", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkIn(roll, grace, { at: at(1), how: "hand" }));
  const [first, second] = roll.rows;

  const without = remove(roll, first.id);
  assert.deepEqual(without.rows, [second]);

  const back = restore(without, first);
  assert.deepEqual(latestFirst(back), [second, first]);
  assert.equal(restore(back, first).rows.length, 2, "restoring twice is once");
});

test("the list reads latest first", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkIn(roll, grace, { at: at(1), how: "scan" }));
  assert.deepEqual(
    latestFirst(roll).map((row) => row.firstName),
    ["Grace", "Ada"],
  );
});

/* ---- what leaves the phone -------------------------------------------------- */

test("the CSV has a header and one line a person in arrival order", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkIn(roll, grace, { at: at(1), how: "hand" }));

  const lines = toCsv(roll).split("\r\n");
  assert.equal(lines[0], CSV_HEADER);
  assert.equal(
    lines[1],
    "2026-09-12T21:00:00.000Z,,Ada,Lovelace,s5123456,0412345678,scan",
  );
  assert.equal(
    lines[2],
    "2026-09-12T21:01:00.000Z,,Grace,Hopper,,0400000001,hand",
  );
  assert.equal(lines[3], "", "ends with a line break");
});

test("a name with a comma or a quote does not break the CSV", () => {
  const tricky = { ...ada, lastName: 'O\'Brien, "Obie"' };
  const { roll } = checkIn(newRoll(hike), tricky, { at: at(0), how: "scan" });
  const [, line] = toCsv(roll).split("\r\n");
  assert.ok(line.includes('"O\'Brien, ""Obie"""'), line);
});

test("the text version is one name a line under the hike", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkIn(roll, grace, { at: at(1), how: "scan" }));
  ({ roll } = checkOut(roll, ada, { at: at(30), how: "scan" }));
  assert.equal(
    toText(roll),
    "Morans Falls, 2026-09-12\n2 checked in, 1 checked out\n\n1. Ada Lovelace\n2. Grace Hopper (still out)",
  );
});

test("the file is named for the hike and its date", () => {
  assert.equal(
    fileName(newRoll(hike), "2026-09-03"),
    "roll-morans-falls-2026-09-12.csv",
  );
  const other = newRoll({
    id: otherHikeId("Mt Coot-tha!"),
    title: "Mt Coot-tha!",
  });
  assert.equal(
    fileName(other, "2026-09-03"),
    "roll-mt-coot-tha-2026-09-03.csv",
  );
});

test("a hike typed twice with the same name is the same hike", () => {
  assert.equal(otherHikeId("Mt Coot-tha"), otherHikeId("  mt coot-tha "));
  assert.equal(otherHikeId(""), "other:hike");
});

/* ---- the camera's memory ---------------------------------------------------- */

test("a code held up to the camera is read once", () => {
  const fresh = cooldown(1000);
  assert.equal(fresh("A", 0), true);
  assert.equal(fresh("A", 500), false, "still in view");
  assert.equal(
    fresh("A", 1400),
    false,
    "the window slid with the last sighting",
  );
  assert.equal(fresh("B", 1400), true, "a different code is fresh at once");
  assert.equal(fresh("A", 2500), true, "and after the window, so is the first");
});

/* ---- coming back --------------------------------------------------------- */

test("checking out marks the row and moves it to the top of the feed", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkIn(roll, grace, { at: at(1), how: "scan" }));
  assert.deepEqual(
    latestFirst(roll).map((r) => r.firstName),
    ["Grace", "Ada"],
  );

  const back = checkOut(roll, ada, { at: at(300), how: "scan" });
  assert.equal(back.outcome.kind, "out");
  assert.equal(back.outcome.row.outAt, at(300).toISOString());
  assert.equal(back.outcome.row.at, at(0).toISOString(), "check-in kept");
  assert.equal(back.roll.rows.length, 2, "nothing added");
  assert.deepEqual(
    latestFirst(back.roll).map((r) => r.firstName),
    ["Ada", "Grace"],
  );
  assert.equal(activityAt(back.outcome.row), at(300).toISOString());

  assert.deepEqual(
    stillOut(back.roll).map((r) => r.firstName),
    ["Grace"],
  );
  assert.equal(outCount(back.roll), 1);
});

test("checking out twice changes nothing", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkOut(roll, ada, { at: at(300), how: "scan" }));
  const again = checkOut(roll, ada, { at: at(305), how: "scan" });
  assert.equal(again.outcome.kind, "already-out");
  assert.equal(again.roll, roll);
  assert.equal(again.outcome.row.outAt, at(300).toISOString());
});

test("someone who never checked in is added and marked out, and flagged", () => {
  const { roll, outcome } = checkOut(newRoll(hike), grace, {
    at: at(300),
    how: "scan",
  });
  assert.equal(outcome.kind, "out-unknown");
  assert.equal(roll.rows.length, 1);
  assert.equal(outcome.row.at, at(300).toISOString());
  assert.equal(outcome.row.outAt, at(300).toISOString());
  assert.equal(stillOut(roll).length, 0);
});

test("the CSV carries the check-out time", () => {
  let { roll } = checkIn(newRoll(hike), ada, { at: at(0), how: "scan" });
  ({ roll } = checkOut(roll, ada, { at: at(300), how: "scan" }));
  const [header, line] = toCsv(roll).split("\r\n");
  assert.equal(header, CSV_HEADER);
  assert.equal(
    line,
    "2026-09-12T21:00:00.000Z,2026-09-13T02:00:00.000Z,Ada,Lovelace,s5123456,0412345678,scan",
  );
});
