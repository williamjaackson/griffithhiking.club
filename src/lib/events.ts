/** Event dates, and the rules for which events are still upcoming.
 *
 *  The mockup hardcoded dates with no year, so it advertised a hike that had
 *  already happened. Everything here exists to make that impossible.
 *
 *  Dates are plain `YYYY-MM-DD` strings and are compared as strings. That looks
 *  primitive next to `Date` arithmetic, and it is the point: the club runs
 *  day-granular events, so the only question ever asked is "is this day past?".
 *  Answering it with string comparison means there is no instant, no offset and
 *  no daylight-saving edge to get wrong. A `Date` would introduce all three to
 *  answer the same question, which is how "vanishes at dawn on its own morning"
 *  bugs happen.
 *
 *  A timezone is needed exactly once - to ask what today is - and is confined
 *  to `clubToday`.
 */

/** Queensland does not observe daylight saving, but naming the zone rather than
 *  hardcoding +10:00 means this stays correct if that ever changes. */
export const CLUB_TIMEZONE = "Australia/Brisbane";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date. The pattern alone would accept
 *  2026-13-45, so this also requires the date to survive a round trip. */
export const isRealDate = (date: string): boolean => {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

/** Today's calendar date where the club actually walks.
 *
 *  Built from `formatToParts` rather than a formatted string, so it cannot be
 *  broken by a locale that orders or separates the parts differently. */
export const clubToday = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

/** The dates an event occupies. `end` is only set for multi-day trips. */
export interface EventDates {
  start: string;
  end?: string;
}

/** The last day an event is still happening. A weekend camping trip stays
 *  upcoming until its final day, not from its first. */
const lastDay = (event: EventDates): string => event.end ?? event.start;

/** Whether an event has yet to finish, judged on whole days.
 *
 *  Inclusive of today, so a hike is still listed on the morning it departs -
 *  which is precisely when someone is most likely to be looking it up. */
export const isUpcoming = (event: EventDates, today: string): boolean =>
  lastDay(event) >= today;

/** Upcoming events, soonest first. Past events are dropped, so no build can
 *  ship a hike that has already happened. */
export const getUpcoming = <T extends EventDates>(
  events: readonly T[],
  today: string,
): T[] =>
  events
    .filter((event) => isUpcoming(event, today))
    .sort((a, b) => a.start.localeCompare(b.start));

/** The soonest event, plus the ones behind it. `next` is null when the club has
 *  nothing scheduled - a real state at the end of a trimester, and one the
 *  section has to render rather than assume away. */
export const splitUpcoming = <T extends EventDates>(
  events: readonly T[],
  today: string,
): { next: T | null; queue: T[] } => {
  const upcoming = getUpcoming(events, today);
  return { next: upcoming[0] ?? null, queue: upcoming.slice(1) };
};

/** The date as it appears on a card: a large day over a small month.
 *
 *  Days stay zero-padded so the numerals hold a consistent width in display
 *  type. Multi-day trips collapse to a range, and a range that crosses a month
 *  boundary widens the month rather than silently losing a date. */
export const formatBadge = (
  event: EventDates,
): { day: string; month: string } => {
  const [, startMonth, startDay] = event.start.split("-");
  const month = MONTHS[Number(startMonth) - 1];

  if (!event.end || event.end === event.start) {
    return { day: startDay, month };
  }

  const [, endMonth, endDay] = event.end.split("-");
  const day = `${startDay}–${endDay}`;
  return startMonth === endMonth
    ? { day, month }
    : { day, month: `${month}–${MONTHS[Number(endMonth) - 1]}` };
};

/** The date spelled out, for screen readers and the `datetime` attribute's
 *  visible counterpart. Formatted in UTC because the string was parsed as UTC
 *  midnight - reading it back in any other zone would shift the day. */
export const formatFullDate = (date: string): string =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));

/** The full date or date range, spelled out. */
export const formatDateRange = (event: EventDates): string =>
  !event.end || event.end === event.start
    ? formatFullDate(event.start)
    : `${formatFullDate(event.start)} to ${formatFullDate(event.end)}`;
