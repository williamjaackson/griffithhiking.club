import type { Registration } from "./validation.ts";

/** The pass, as a link.
 *
 *  What a hiker shows is a URL to the club with their details on the end of it. A
 *  leader's scanner reads the details straight off it; anyone else who happens to
 *  scan a pass is taken to the club rather than shown a screen of gibberish, which
 *  is what a packed binary code looked like to a passing phone.
 *
 *  In the fragment, not the query string. A fragment is never sent to a server, so a
 *  member's name and numbers stay on the two phones involved and out of every access
 *  log in between. Nothing is lost by it: the site is static, so anything read from
 *  one of these links is read in the browser either way.
 *
 *  It is not a signature and does not pretend to be. The origin is the only check
 *  there is - the same job the old format's magic byte did, and no harder to forge.
 *  Fine while a pass is a convenience; not enough if one ever gates anything.
 */
export const SITE = "https://griffithhiking.club/";

/** One letter each, because every character is another QR module to point a camera
 *  at. Keyed by field so the two directions cannot disagree about which is which. */
const KEYS: Record<keyof Registration, string> = {
  firstName: "f",
  lastName: "l",
  studentNumber: "s",
  phone: "p",
};

export const passLink = (registration: Registration): string => {
  const details = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS)) {
    details.set(key, registration[field as keyof Registration]);
  }
  return `${SITE}#${details}`;
};

export const readPass = (link: string): Registration => {
  const url = new URL(link);
  if (`${url.origin}${url.pathname}` !== SITE) {
    throw new Error("not a Griffith Hiking Club pass");
  }

  // A waived field is stored empty and reads back empty, so there is no absent
  // marker to agree on - which the packed format needed a reserved zero for.
  const details = new URLSearchParams(url.hash.slice(1));
  const read = (field: keyof Registration) => details.get(KEYS[field]) ?? "";

  return {
    firstName: read("firstName"),
    lastName: read("lastName"),
    studentNumber: read("studentNumber"),
    phone: read("phone"),
  };
};
