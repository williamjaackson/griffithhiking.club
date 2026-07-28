/** The three fields a member types, and the rules they have to meet.
 *
 *  Each rule is stated to the member up front rather than only after they get it
 *  wrong, so `hint` is the label copy and `error` is the correction.
 */

export interface Registration {
  firstName: string;
  lastName: string;
  /** A lowercase s followed by seven digits, e.g. s5123456. */
  studentNumber: string;
  /** Ten digits beginning 04, stored without spaces. */
  phone: string;
}

export const STUDENT_NUMBER_HINT =
  "As it appears on your student ID or in myGriffith.";
export const PHONE_HINT = "An Australian mobile phone number.";

/** What the fields show before anything is typed. Deliberately not a real
 *  number: an example that looks like somebody's actual details invites people
 *  to submit it. */
export const STUDENT_NUMBER_EXAMPLE = "5123456";
export const PHONE_EXAMPLE = "0412 345 678";

const STUDENT_NUMBER = /^s\d{7}$/;
const PHONE = /^04\d{8}$/;

/** Typing an uppercase S is the obvious slip, so it is corrected rather than
 *  rejected. Spaces in a pasted number are dropped for the same reason. */
export const normaliseStudentNumber = (raw: string): string =>
  raw.trim().replace(/\s/g, "").toLowerCase();

export const normalisePhone = (raw: string): string =>
  raw.replace(/[\s()-]/g, "").replace(/^\+61/, "0");

/** Grouped as 04xx xxx xxx while typing - how the number is read aloud. */
export const formatPhone = (digits: string): string => {
  const d = digits.slice(0, 10);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
};

export const nameError = (value: string, field: string): string | null => {
  const v = value.trim();
  if (!v) return `Your ${field} is required`;
  if (v.length > 40) return `Your ${field} has to be 40 characters or fewer`;
  return null;
};

export const studentNumberError = (value: string): string | null => {
  const v = normaliseStudentNumber(value);
  if (!v) return "Your student number is required";
  if (!v.startsWith("s")) return "It has to start with s";
  if (!/^s\d*$/.test(v)) return "Only the letter s and digits";
  if (v.length !== 8)
    return `That is ${v.length - 1} digits, and it needs exactly 7`;
  return STUDENT_NUMBER.test(v) ? null : "A lowercase s then 7 digits";
};

export const phoneError = (value: string): string | null => {
  const v = normalisePhone(value);
  if (!v) return "Your phone number is required";
  if (!/^\d+$/.test(v)) return "Digits only";
  if (!v.startsWith("04")) return "An Australian mobile starts with 04";
  if (v.length !== 10)
    return `That is ${v.length} digits, and it needs exactly 10`;
  return PHONE.test(v) ? null : "An Australian mobile: 04 then 8 more digits";
};

/** Some hikers genuinely have neither: staff, alumni, guests from another club,
 *  and anyone visiting on an overseas number. They say so on the form, and the
 *  field stops being required rather than being faked.
 *
 *  The pass is worse off without them and the form says so before it is made -
 *  this is what a hiker is allowed to do, not what they should do. */
export interface Waived {
  studentNumber?: boolean;
  phone?: boolean;
}

export const registrationErrors = (r: Registration, waived: Waived = {}) => ({
  firstName: nameError(r.firstName, "first name"),
  lastName: nameError(r.lastName, "last name"),
  studentNumber: waived.studentNumber
    ? null
    : studentNumberError(r.studentNumber),
  phone: waived.phone ? null : phoneError(r.phone),
});

export const fullName = (r: Registration): string =>
  `${r.firstName.trim()} ${r.lastName.trim()}`;

export const isComplete = (r: Registration, waived: Waived = {}): boolean =>
  Object.values(registrationErrors(r, waived)).every((e) => e === null);
