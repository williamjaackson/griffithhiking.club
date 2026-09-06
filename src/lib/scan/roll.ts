import { fullName, type Registration } from "../pass/validation.ts";

/** The roll: who has checked in to one hike.
 *
 *  Pure. Nothing here touches the camera, the screen or storage, so every rule
 *  about who counts as already here, what a gap is and what leaves the phone as
 *  a CSV can be tested in Node without a browser. The page and the store are
 *  thin wrappers around this.
 *
 *  A row is a registration as read from a pass, plus when it was read and how.
 *  The registration is kept whole rather than flattened so the same validators
 *  the trail pass uses can be run on a row when a leader fills a gap in it.
 */

export interface Hike {
  /** The Sanity document id, or `other:<slug>` for a hike typed in by hand. */
  id: string;
  title: string;
  /** `YYYY-MM-DD`. Absent for a hike typed in by hand. */
  start?: string;
}

/** How a row got here. Shown in the export so a spreadsheet can tell a pass
 *  from a name a leader typed while someone's phone was dead. */
export type How = "scan" | "hand";

export interface Row extends Registration {
  id: string;
  /** When they checked in, as an ISO instant. */
  at: string;
  /** When they checked out again, if they have. The safety half of a roll:
   *  who is still out on the track. */
  outAt?: string;
  how: How;
}

export interface Roll {
  hike: Hike;
  rows: Row[];
}

export const newRoll = (hike: Hike): Roll => ({ hike, rows: [] });

/** Who this is, for the purpose of noticing the same person twice.
 *
 *  The student number when there is one: it is the one field that is meant to
 *  be unique. Without it, the name and phone together, lowercased, because two
 *  hikers who share a name and a phone are one hiker. Two "Sam Lee"s with no
 *  numbers at all do collide, and the second one is added by hand. */
export const identity = (r: Registration): string =>
  r.studentNumber
    ? `s:${r.studentNumber}`
    : `n:${fullName(r).toLowerCase()}|${r.phone}`;

/** The two fields a pass may be missing. A gap is a fact about the row that the
 *  screen flags and the roll can filter on; it is not an error. */
export interface Gaps {
  studentNumber: boolean;
  phone: boolean;
}

export const gaps = (r: Registration): Gaps => ({
  studentNumber: !r.studentNumber,
  phone: !r.phone,
});

export const hasGaps = (r: Registration): boolean =>
  !r.studentNumber || !r.phone;

export type Outcome =
  | { kind: "added"; row: Row }
  /** Already on this roll. The row returned is the one that was already
   *  there, so the screen can show when they first checked in. */
  | { kind: "repeat"; row: Row }
  /** Checked out, having checked in earlier. */
  | { kind: "out"; row: Row }
  /** Checked out twice. */
  | { kind: "already-out"; row: Row }
  /** Checked out without ever checking in. They are added and marked out in
   *  one go, because they are plainly here, but the screen makes a point of
   *  it: someone walked past the check-in. */
  | { kind: "out-unknown"; row: Row };

export interface CheckIn {
  at: Date;
  how: How;
  /** Overridable so a test can pin it. */
  id?: string;
}

/** Add someone, unless they are already here. Returns the roll unchanged on a
 *  repeat, so a caller can save whatever comes back without checking. */
export const checkIn = (
  roll: Roll,
  registration: Registration,
  { at, how, id = crypto.randomUUID() }: CheckIn,
): { roll: Roll; outcome: Outcome } => {
  const who = identity(registration);
  const already = roll.rows.find((row) => identity(row) === who);
  if (already) return { roll, outcome: { kind: "repeat", row: already } };

  const row: Row = { ...registration, id, at: at.toISOString(), how };
  return {
    roll: { ...roll, rows: [...roll.rows, row] },
    outcome: { kind: "added", row },
  };
};

/** Mark someone as back. Someone who never checked in is added and marked out
 *  at once, so the roll ends up complete rather than arguing with the leader
 *  at the car park. */
export const checkOut = (
  roll: Roll,
  registration: Registration,
  { at, how, id = crypto.randomUUID() }: CheckIn,
): { roll: Roll; outcome: Outcome } => {
  const who = identity(registration);
  const existing = roll.rows.find((row) => identity(row) === who);

  if (!existing) {
    const stamp = at.toISOString();
    const row: Row = { ...registration, id, at: stamp, outAt: stamp, how };
    return {
      roll: { ...roll, rows: [...roll.rows, row] },
      outcome: { kind: "out-unknown", row },
    };
  }

  if (existing.outAt) {
    return { roll, outcome: { kind: "already-out", row: existing } };
  }

  const row: Row = { ...existing, outAt: at.toISOString() };
  return {
    roll: {
      ...roll,
      rows: roll.rows.map((r) => (r.id === row.id ? row : r)),
    },
    outcome: { kind: "out", row },
  };
};

export const remove = (roll: Roll, id: string): Roll => ({
  ...roll,
  rows: roll.rows.filter((row) => row.id !== id),
});

/** Fill a gap. The value is expected to be normalised and valid already; the
 *  page runs the trail pass validators before it gets here. */
export const fill = (
  roll: Roll,
  id: string,
  field: keyof Gaps,
  value: string,
): Roll => ({
  ...roll,
  rows: roll.rows.map((row) =>
    row.id === id ? { ...row, [field]: value } : row,
  ),
});

/** Replace the editable registration details on one row. */
export const editDetails = (
  roll: Roll,
  id: string,
  details: Registration,
): Roll => ({
  ...roll,
  rows: roll.rows.map((row) => (row.id === id ? { ...row, ...details } : row)),
});

/** When a row last changed: the check-out if there was one, else the
 *  check-in. The feed on the scanner is ordered by this, so whoever was just
 *  scanned, in or out, is at the top. */
export const activityAt = (row: Row): string => row.outAt ?? row.at;

/** Latest activity first, which is what a leader looking for the person they
 *  just scanned wants. */
export const latestFirst = (roll: Roll): Row[] =>
  [...roll.rows].sort((a, b) => activityAt(b).localeCompare(activityAt(a)));

/** The rows still missing a number. */
export const withGaps = (roll: Roll): Row[] => roll.rows.filter(hasGaps);

/** Checked in and not yet out. At the end of a hike this list should be
 *  empty, and if it is not, these are the names to go looking for. */
export const stillOut = (roll: Roll): Row[] =>
  roll.rows.filter((row) => !row.outAt);

export const outCount = (roll: Roll): number =>
  roll.rows.filter((row) => row.outAt).length;

/* ---- what leaves the phone ------------------------------------------------- */

/** Anything with a comma, quote or line break is quoted, and quotes inside are
 *  doubled. Everything else is written bare, so the file stays readable in a
 *  text editor as well as a spreadsheet. */
const cell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const CSV_HEADER =
  "checked_in,checked_out,first_name,last_name,student_number,phone,added_by";

/** Rows in the order they were scanned: a spreadsheet can sort, and the order
 *  of arrival is information a reversed list would lose. */
export const toCsv = (roll: Roll): string =>
  [
    CSV_HEADER,
    ...roll.rows.map((row) =>
      [
        row.at,
        row.outAt ?? "",
        row.firstName,
        row.lastName,
        row.studentNumber,
        row.phone,
        row.how,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n") + "\r\n";

/** For pasting into a group chat: the hike, then one name a line. */
export const toText = (roll: Roll): string => {
  const heading = [roll.hike.title, roll.hike.start].filter(Boolean).join(", ");
  const names = roll.rows.map(
    (row, i) => `${i + 1}. ${fullName(row)}${row.outAt ? "" : " (still out)"}`,
  );
  const out = outCount(roll);
  return [
    heading,
    `${roll.rows.length} checked in, ${out} checked out`,
    "",
    ...names,
  ].join("\n");
};

const slug = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 40) || "hike";

/** `roll-morans-falls-2026-09-12.csv`. The date is the hike's when it has
 *  one, otherwise the day the file was made. */
export const fileName = (roll: Roll, today: string): string =>
  `roll-${slug(roll.hike.title)}-${roll.hike.start ?? today}.csv`;

/** An id for a hike a leader typed in, stable across the same name so coming
 *  back to "Other: Mt Coot-tha" finds the same roll. */
export const otherHikeId = (title: string): string => `other:${slug(title)}`;

/* ---- the camera's memory --------------------------------------------------- */

/** Whether a code is new, or the same one still held up to the camera.
 *
 *  A detector reads the same code on every frame it can see it, so without this
 *  one hiker would produce a read a frame. Keyed on the code's content and
 *  refreshed on every sighting, so the window slides: a code stays "seen" for as
 *  long as it stays in view plus the window, and the next hiker's code, being
 *  different, is fresh at once. Nothing is ever paused. */
export const cooldown = (windowMs: number) => {
  const seen = new Map<string, number>();
  return (code: string, now: number): boolean => {
    const last = seen.get(code);
    seen.set(code, now);
    return last === undefined || now - last > windowMs;
  };
};

/** Put back a row that was removed by mistake, exactly as it was, so the undo
 *  does not move them to the bottom of the list with a new time. */
export const restore = (roll: Roll, row: Row): Roll =>
  roll.rows.some((r) => r.id === row.id)
    ? roll
    : { ...roll, rows: [...roll.rows, row] };
