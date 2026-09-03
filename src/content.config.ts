import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { DIFFICULTIES, KINDS, isRealDate } from "./lib/events";
import { fetchEvents } from "./lib/sanity";

/** Photos live beside their entry rather than in src/assets, so a section's
 *  words and its pictures change together in one folder. `image()` resolves
 *  the bare filename and still runs it through the build pipeline. */

const home = defineCollection({
  loader: glob({ pattern: "index.yaml", base: "./src/content/home" }),
  schema: ({ image }) =>
    z.object({
      eyebrow: z.string(),
      /** Plain text. The line break comes from `text-wrap: balance`, so an
       *  editor never has to know about markup. */
      headline: z.string(),
      photo: image(),
      /** Describes the photograph. Empty is valid: the hero image is a backdrop
       *  behind the headline, so decorative is a legitimate choice. */
      photoAlt: z.string(),
      /** Which part of the photo to keep as the crop narrows. Constrained to a
       *  CSS object-position value so content cannot inject arbitrary CSS. */
      focalPoint: z
        .string()
        .regex(/^[\d.%a-z\s]+$/i, "must be a CSS object-position value")
        .default("50% 54%"),
      /** The photograph behind the next departure. Belongs to the page rather
       *  than to any one hike: only the soonest event shows a photo, so a field
       *  on every event would ask editors to upload photos that never appear. */
      eventsPhoto: image(),
      eventsPhotoAlt: z
        .string()
        .min(1, "the events photo shows people, so it needs a description"),
      /** As with the hero: the card crops a tall photo, and which part to keep
       *  depends on the photo, so it travels with the photo rather than being
       *  fixed in the component. Defaults to the mockup's crop, which holds
       *  the faces above the text. */
      eventsFocalPoint: z
        .string()
        .regex(/^[\d.%a-z\s]+$/i, "must be a CSS object-position value")
        .default("50% 38%"),
      /** Names the place in the photo, so it has to change when the photo does. */
      caption: z.string(),
      /** The photograph in the closing band. Editable: which photo closes the
       *  page is a judgement about the club, not about the layout. */
      invitationPhoto: image(),
      invitationPhotoAlt: z
        .string()
        .min(1, "the closing photo shows people, so it needs a description"),
      invitationFocalPoint: z
        .string()
        .regex(/^[\d.%a-z\s]+$/i, "must be a CSS object-position value")
        .default("50% 67%"),
      statement: z.string(),
    }),
});

/** Both galleries hold the same thing - an ordered set of club photographs with
 *  a description and a caption - so the shape is declared once and pointed at
 *  two folders. They stay separate collections because they are separate
 *  sections: an editor should never have to tag a photo with where it belongs. */
const gallery = (base: string) =>
  defineCollection({
    loader: glob({ pattern: "*.yaml", base }),
    schema: ({ image }) =>
      z.object({
        order: z.number().int(),
        photo: image(),
        alt: z.string().min(1, "every photo needs a description"),
        caption: z.string(),
      }),
  });

const moments = gallery("./src/content/moments");
const instagram = gallery("./src/content/instagram");

/** A calendar date, always `YYYY-MM-DD`, which is how Sanity's date type
 *  stores it. The pattern alone would accept 2026-13-45. */
const eventDate = z
  .string()
  .refine(isRealDate, "must be a real calendar date, written as YYYY-MM-DD");

/** The calendar. Fetched from Sanity rather than read from files, because it
 *  changes weekly and is edited by the club's executives, who should never
 *  need a GitHub account - see docs/cms.md.
 *
 *  The schema still runs on every document. The studio enforces the same rules
 *  before Publish, but the build is the last line, and a build that trusted the
 *  CMS would ship whatever a future studio change let through. */
const events = defineCollection({
  loader: fetchEvents,
  schema: z
    .object({
      title: z.string().min(1, "every event needs a name"),
      start: eventDate,
      /** Only for trips spanning more than one day. A single-day hike leaves
       *  this out entirely rather than repeating the start date. */
      end: eventDate.optional(),
      /** Where it is - the park or suburb, not a street address. */
      place: z.string().min(1, "every event needs a place"),
      /** The one-line character of the outing: "Sunset hike", "Full day". */
      detail: z.string(),
      /** Drives how the entry is presented. A social night is not a hike and
       *  must not be listed as though it were. */
      kind: z.enum(KINDS),
      /** Left unset when it does not apply. Grading is safety information, so
       *  it is never guessed on an editor's behalf. */
      difficulty: z.enum(DIFFICULTIES).optional(),
      /** Present when places are by application rather than turning up. The
       *  presence of the link is what makes an outing application-only, so the
       *  two can never disagree. */
      applyUrl: z.string().url().optional(),
    })
    .refine((event) => !event.end || event.end >= event.start, {
      message: "the end date cannot be before the start date",
      path: ["end"],
    })
    .refine((event) => !(event.kind === "social" && event.difficulty), {
      message: "a social event has no difficulty grade",
      path: ["difficulty"],
    }),
});

export const collections = { home, moments, instagram, events };
