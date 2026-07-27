import { getEntry } from "astro:content";

/** The home page's editable copy.
 *
 *  Three components need it, and each was reaching for `entry!.data` - an
 *  assertion that the entry exists. It does not always: Astro's dev content
 *  store goes stale after a schema change and drops the entry, at which point
 *  the assertion becomes "Cannot read properties of undefined (reading 'data')"
 *  somewhere inside a module runner, which says nothing about what is wrong.
 *
 *  The build has its own store and is unaffected, so this only ever bites in
 *  development - which is exactly where a legible message is worth having.
 */
export const getHome = async () => {
  const entry = await getEntry("home", "index");

  if (!entry) {
    throw new Error(
      "The home content entry was not found. If src/content/home/index.yaml " +
        "exists, Astro's content store is stale - stop the dev server, remove " +
        ".astro/data-store.json and node_modules/.astro, then start it again.",
    );
  }

  return entry.data;
};
