/** The date rules are the only real logic on the site, and the one thing that
 *  breaks silently - a wrong answer here does not throw, it just quietly shows
 *  a hike that has already happened. So they are tested directly.
 *
 *  Run with `pnpm test`. Node executes TypeScript natively, so this needs no
 *  test runner and no build step.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clubToday,
  formatBadge,
  formatDateRange,
  getUpcoming,
  isRealDate,
  isUpcoming,
  splitUpcoming,
} from "./events.ts";

test("clubToday reads the date in Brisbane, not UTC", () => {
  // 15:00 UTC is already the next calendar day in Brisbane (+10). A naive
  // implementation using UTC would answer the 27th and hide nothing all day.
  assert.equal(clubToday(new Date("2026-07-27T15:00:00Z")), "2026-07-28");

  // And just before, it is still the 27th there.
  assert.equal(clubToday(new Date("2026-07-27T13:59:00Z")), "2026-07-27");
});

test("clubToday is unaffected by the machine's own timezone", () => {
  // A CI runner is on UTC and this laptop is not, so a Brisbane answer must not
  // depend on where the build happens.
  const instant = new Date("2026-07-27T15:00:00Z");
  const before = process.env.TZ;
  const localDay = () => instant.getDate();

  try {
    process.env.TZ = "UTC";
    assert.equal(clubToday(instant), "2026-07-28", "wrong under TZ=UTC");
    const asUtc = localDay();

    process.env.TZ = "Pacific/Kiritimati";
    assert.equal(clubToday(instant), "2026-07-28", "wrong under TZ=+14");
    // Guards the test itself: if Node ever stops honouring a mutated TZ, the
    // assertions above would pass while proving nothing at all.
    assert.notEqual(
      localDay(),
      asUtc,
      "TZ changes are not taking effect, so this test is not testing anything",
    );
  } finally {
    process.env.TZ = before;
  }
});

test("an event is still upcoming on its own day", () => {
  const hike = { start: "2026-08-02" };
  assert.equal(isUpcoming(hike, "2026-08-01"), true, "the day before");
  assert.equal(isUpcoming(hike, "2026-08-02"), true, "its own morning");
  assert.equal(isUpcoming(hike, "2026-08-03"), false, "the day after");
});

test("a multi-day trip stays upcoming until its final day", () => {
  const trip = { start: "2026-10-23", end: "2026-10-25" };
  assert.equal(isUpcoming(trip, "2026-10-23"), true, "first day");
  assert.equal(isUpcoming(trip, "2026-10-24"), true, "middle day");
  assert.equal(isUpcoming(trip, "2026-10-25"), true, "final day");
  assert.equal(isUpcoming(trip, "2026-10-26"), false, "the day after");
});

test("getUpcoming drops past events and sorts the rest soonest first", () => {
  const events = [
    { start: "2026-09-12", title: "Morans Falls" },
    { start: "2026-07-18", title: "already happened" },
    { start: "2026-08-02", title: "Mt Maroon Caves" },
  ];
  assert.deepEqual(
    getUpcoming(events, "2026-07-27").map((e) => e.title),
    ["Mt Maroon Caves", "Morans Falls"],
  );
});

test("getUpcoming does not mutate its input", () => {
  const events = [{ start: "2026-09-12" }, { start: "2026-08-02" }];
  getUpcoming(events, "2026-01-01");
  assert.deepEqual(
    events.map((e) => e.start),
    ["2026-09-12", "2026-08-02"],
    "sort() sorts in place, so the caller's array must be copied first",
  );
});

test("splitUpcoming separates the next departure from the queue", () => {
  const events = [
    { start: "2026-08-02", title: "next" },
    { start: "2026-07-01", title: "past" },
    { start: "2026-08-23", title: "after" },
  ];
  const { next, queue } = splitUpcoming(events, "2026-07-27");
  assert.equal(next?.title, "next");
  assert.deepEqual(
    queue.map((e) => e.title),
    ["after"],
  );
});

test("splitUpcoming reports no next event when nothing is scheduled", () => {
  const { next, queue } = splitUpcoming(
    [{ start: "2026-01-01" }],
    "2026-07-27",
  );
  assert.equal(next, null);
  assert.deepEqual(queue, []);
});

test("formatBadge shows a padded day over an abbreviated month", () => {
  assert.deepEqual(formatBadge({ start: "2026-08-02" }), {
    day: "02",
    month: "AUG",
  });
  assert.deepEqual(formatBadge({ start: "2026-12-31" }), {
    day: "31",
    month: "DEC",
  });
});

test("formatBadge collapses a multi-day trip to a range", () => {
  assert.deepEqual(formatBadge({ start: "2026-10-23", end: "2026-10-25" }), {
    day: "23–25",
    month: "OCT",
  });
});

test("formatBadge widens the month when a range crosses one", () => {
  assert.deepEqual(formatBadge({ start: "2026-10-30", end: "2026-11-01" }), {
    day: "30–01",
    month: "OCT–NOV",
  });
});

test("formatBadge treats an end equal to the start as a single day", () => {
  assert.deepEqual(formatBadge({ start: "2026-08-02", end: "2026-08-02" }), {
    day: "02",
    month: "AUG",
  });
});

test("formatDateRange spells the date out for screen readers", () => {
  assert.equal(
    formatDateRange({ start: "2026-08-02" }),
    "Sunday 2 August 2026",
  );
  assert.equal(
    formatDateRange({ start: "2026-10-23", end: "2026-10-25" }),
    "Friday 23 October 2026 to Sunday 25 October 2026",
  );
});

test("isRealDate rejects anything that is not a real calendar date", () => {
  assert.equal(isRealDate("2026-08-02"), true);
  assert.equal(isRealDate("2028-02-29"), true, "a genuine leap day");

  assert.equal(isRealDate("2026-13-01"), false, "month 13");
  assert.equal(isRealDate("2026-08-45"), false, "day 45");
  assert.equal(isRealDate("2026-02-30"), false, "February never has 30 days");
  assert.equal(isRealDate("2027-02-29"), false, "not a leap year");
  assert.equal(isRealDate("2026-8-2"), false, "must be zero-padded");
  assert.equal(isRealDate("02/08/2026"), false, "wrong format entirely");
  assert.equal(isRealDate("2026-08-02T06:00:00Z"), false, "date only");
  assert.equal(isRealDate(""), false);
});
