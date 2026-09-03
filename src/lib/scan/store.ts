import type { Roll } from "./roll.ts";

/** What the scanner remembers between opens.
 *
 *  Rolls and which hike is open. All of it
 *  in localStorage: a roll is at most a few hundred short strings, and the trail
 *  pass already keeps its record the same way. Behind a factory so the same
 *  code runs against a Map in tests, and so it could become IndexedDB later
 *  without the page noticing.
 *
 *  Every read tolerates a missing or garbled value. Storage is the one part of
 *  the app another tab, a browser cleanup or a bug in an earlier build can
 *  reach into, so a broken entry reads as absent rather than throwing at the
 *  trailhead.
 */

export type Backing = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

const PREFIX = "griffith-hiking-club:scan:";
const ROLL = `${PREFIX}roll:`;
const CURRENT = `${PREFIX}hike`;

const isRoll = (value: unknown): value is Roll =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Roll).hike?.id === "string" &&
  Array.isArray((value as Roll).rows);

export const createStore = (backing: Backing) => {
  const read = (key: string): string | null => {
    try {
      return backing.getItem(key);
    } catch {
      return null;
    }
  };

  /** Private browsing or a full quota. The roll still exists for this visit;
   *  it just will not be waiting next time, and the page says so. */
  const write = (key: string, value: string): boolean => {
    try {
      backing.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const drop = (key: string) => {
    try {
      backing.removeItem(key);
    } catch {
      // Nothing to do: it is gone, or it was never there.
    }
  };

  const parseRoll = (raw: string | null): Roll | null => {
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      return isRoll(value) ? value : null;
    } catch {
      return null;
    }
  };

  const keys = (): string[] => {
    const found: string[] = [];
    for (let i = 0; i < backing.length; i++) {
      const key = backing.key(i);
      if (key?.startsWith(ROLL)) found.push(key);
    }
    return found;
  };

  return {
    loadRoll: (hikeId: string): Roll | null => parseRoll(read(ROLL + hikeId)),

    saveRoll: (roll: Roll): boolean =>
      write(ROLL + roll.hike.id, JSON.stringify(roll)),

    deleteRoll: (hikeId: string) => drop(ROLL + hikeId),

    /** Every roll on this phone, in no particular order. */
    listRolls: (): Roll[] =>
      keys()
        .map((key) => parseRoll(read(key)))
        .filter((roll): roll is Roll => roll !== null),

    currentHike: (): string | null => read(CURRENT),

    setCurrentHike: (hikeId: string | null) =>
      hikeId === null ? drop(CURRENT) : write(CURRENT, hikeId),
  };
};

export type Store = ReturnType<typeof createStore>;
