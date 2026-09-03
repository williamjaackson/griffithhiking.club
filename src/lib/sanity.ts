import { createClient } from "@sanity/client";
import project from "../../sanity.project.json" with { type: "json" };

/** The club's calendar, read from Sanity at build time.
 *
 *  Events are the one thing on the site that changes weekly and is edited by
 *  people who are not developers, so they live in a hosted CMS rather than in
 *  this repository. Everything else is still a file under src/content.
 *
 *  The dataset is public and this only ever reads, so there is no token: a
 *  build needs nothing but the project id. See docs/cms.md.
 */

/** Every field the site's schema knows about. Listed rather than `...` so a
 *  field added in the studio cannot reach the build until the schema in
 *  src/content.config.ts has been taught what it means. */
export const EVENTS_QUERY = `*[_type == "event"]{
  _id, title, start, end, place, detail, kind, difficulty, applyUrl
}`;

export interface EventDocument {
  _id: string;
  [field: string]: unknown;
}

/** One document, as a collection entry.
 *
 *  Ids must not contain a dot. Sanity reads `a.b` as a path, and documents off
 *  the root path are hidden from anonymous requests even in a public dataset:
 *  the query returns an empty list, and the calendar would build empty. The
 *  studio generates dot-free ids; the seed file is written by hand, so it has
 *  to be checked.
 *
 *  GROQ returns `null` for a projected field the document does not have. The
 *  schema wants such a field absent, not null - `end` is optional, never
 *  nullable - so nulls are dropped here rather than allowed for everywhere. */
export const toEntry = ({ _id, ...fields }: EventDocument) => ({
  id: _id,
  ...Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value != null),
  ),
});

/** An inline collection loader: Astro clears the collection and stores what
 *  this returns, validated against the schema, on every build. */
export const fetchEvents = async () => {
  if (!project.projectId) {
    throw new Error(
      "sanity.project.json has no projectId, so the events collection cannot " +
        "be loaded. Run scripts/setup-sanity.sh, or fill it in by hand.",
    );
  }

  const client = createClient({
    projectId: project.projectId,
    dataset: project.dataset,
    apiVersion: "2026-09-01",
    // Straight from the source, not the CDN. A publish fires a rebuild within
    // seconds, and the CDN can still be serving the previous version then.
    useCdn: false,
    perspective: "published",
  });

  const documents = await client.fetch<EventDocument[]>(EVENTS_QUERY);

  // An empty calendar is a real state between trimesters, so it cannot be an
  // error. But a private dataset produces exactly the same answer - a 200 and
  // an empty list, not a 401 - so say so, where a build log will show it.
  if (documents.length === 0) {
    console.warn(
      "[sanity] No events came back. If the studio shows some, the dataset is " +
        "private: run `pnpm -C studio exec sanity datasets visibility set " +
        "production public`.",
    );
  }

  return documents.map(toEntry);
};
