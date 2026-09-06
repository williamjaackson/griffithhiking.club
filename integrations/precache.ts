import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, posix } from "node:path";
import type { AstroIntegration } from "astro";

/** Tells the scanner's service worker what to cache.
 *
 *  The worker has to hold everything /scan/ needs to open with no signal, and
 *  Astro gives its assets hashed names that are not known until the build has
 *  finished. So this runs last, reads the built page, follows what it
 *  references, and writes the list into the copy of the worker that Astro has
 *  already placed in dist/.
 *
 *  Following matters. The page names its script and stylesheet, but Vite splits
 *  code the trail pass and the scanner share into a chunk only the script
 *  names, and the stylesheet names the fonts. A list taken from the page alone
 *  left the shared chunk out, and a phone installed and taken offline before a
 *  second visit would have opened a page that could not run.
 *
 *  Fonts: the Latin files only. The other subsets are for names in other
 *  scripts, which fall back to the system face offline. That keeps the fonts
 *  under 150 kB rather than the 600 kB of every subset.
 *
 *  The version written alongside is a digest of the page and the list, so a
 *  deploy that changes anything the worker serves also changes the worker,
 *  which is what makes a browser install the new one.
 */
export default function precache(): AstroIntegration {
  return {
    name: "scan-precache",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const page = await readFile(join(root, "scan/index.html"), "utf8");

        const found = new Set<string>(page.match(/\/_astro\/[^"'\s)]+/g) ?? []);
        const queue = [...found];

        while (queue.length) {
          const url = queue.pop()!;
          const add = (next: string) => {
            if (!found.has(next)) {
              found.add(next);
              queue.push(next);
            }
          };

          if (url.endsWith(".js")) {
            const source = await readFile(join(root, url), "utf8");
            for (const [, target] of source.matchAll(
              /(?:from|import\()\s*"(\.\/[^"]+\.js)"/g,
            )) {
              add(posix.join(posix.dirname(url), target));
            }
          }

          if (url.endsWith(".css")) {
            const source = await readFile(join(root, url), "utf8");
            for (const [, target] of source.matchAll(
              /url\((\/_astro\/[^)]*-latin-[^)]*\.woff2)\)/g,
            )) {
              add(target);
            }
          }
        }

        const urls = ["/scan/", "/scan/manifest.webmanifest", ...found].sort();

        const version = createHash("sha256")
          .update(page)
          .update(urls.join("\n"))
          .digest("hex")
          .slice(0, 12);

        const sourceWorkerPath = join(root, "sw.js");
        // The worker must control /_astro/ as well as /scan/, so it is emitted
        // at the site root. Its fetch handler still limits navigation caching
        // to the scanner.
        const workerPath = join(root, "sw.js");
        const worker = await readFile(sourceWorkerPath, "utf8");
        const stamped = worker
          .replace(
            /^const VERSION = .*$/m,
            `const VERSION = ${JSON.stringify(version)};`,
          )
          .replace(
            /^const PRECACHE = .*$/m,
            `const PRECACHE = ${JSON.stringify(urls)};`,
          );

        if (stamped === worker) {
          throw new Error(
            "public/sw.js has no VERSION and PRECACHE lines to fill in",
          );
        }

        await writeFile(workerPath, stamped);
        logger.info(`scan/sw.js ${version}: ${urls.length} files to cache`);
      },
    },
  };
}
