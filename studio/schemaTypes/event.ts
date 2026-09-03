import { defineField, defineType } from "sanity";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  KINDS,
  KIND_LABELS,
} from "../../src/lib/events";

/** An outing on the club calendar.
 *
 *  Mirrors the `events` collection schema in src/content.config.ts: the site
 *  validates what it fetches, so anything this form lets through and the site
 *  rejects would fail the build after publishing, where nobody is watching.
 *  Every rule the site enforces is therefore also enforced here, before Publish.
 *
 *  The option lists are imported from the site's own source, so a new grade or
 *  kind is added in one place and appears in both.
 */
export const event = defineType({
  name: "event",
  title: "Hike or event",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Name",
      type: "string",
      description: "What the hike is called, e.g. Morans Falls.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "start",
      title: "Date",
      type: "date",
      description:
        "Past hikes disappear from the site by themselves the day after they finish. There is no need to delete them.",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "end",
      title: "Last day",
      type: "date",
      description:
        "Only for trips over more than one day. Leave empty for a normal hike.",
      options: { dateFormat: "YYYY-MM-DD" },
      validation: (rule) =>
        rule.custom((end, context) => {
          const start = context.document?.start;
          if (!end || typeof start !== "string") return true;
          return end >= start || "The last day cannot be before the first.";
        }),
    }),
    defineField({
      name: "place",
      title: "Place",
      type: "string",
      description: "The park or suburb, e.g. Lamington National Park.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "detail",
      title: "Description",
      type: "string",
      description: "One short line, e.g. Sunset hike, Full day, Club social.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "kind",
      title: "Type",
      type: "string",
      description:
        "A social night is not a hike, and the site lists it differently.",
      initialValue: "hike",
      options: {
        layout: "radio",
        list: KINDS.map((value) => ({ value, title: KIND_LABELS[value] })),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "difficulty",
      title: "Difficulty",
      type: "string",
      description:
        "Leave empty for a social event. Never guess: this is safety information.",
      options: {
        layout: "dropdown",
        list: DIFFICULTIES.map((value) => ({
          value,
          title: DIFFICULTY_LABELS[value],
        })),
      },
      // Shown rather than hidden for a social event, so an editor who set a
      // grade and then changed the type can see the value the error is about.
      validation: (rule) =>
        rule.custom((difficulty, context) =>
          difficulty && context.document?.kind === "social"
            ? "A social event has no difficulty grade. Clear it."
            : true,
        ),
    }),
    defineField({
      name: "applyUrl",
      title: "Application form link",
      type: "url",
      description:
        "Any form link works: Google Forms, Microsoft Forms, anything. Adding a link here is what marks the hike application-only.",
      validation: (rule) =>
        rule
          .uri({ scheme: ["https"] })
          .error(
            "Must start with https://. Paste the whole link from your browser's address bar.",
          ),
    }),
  ],
  orderings: [
    {
      title: "Date, soonest first",
      name: "startAsc",
      by: [{ field: "start", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", start: "start", place: "place" },
    prepare: ({ title, start, place }) => ({
      title,
      subtitle: [start, place].filter(Boolean).join(" · "),
    }),
  },
});
