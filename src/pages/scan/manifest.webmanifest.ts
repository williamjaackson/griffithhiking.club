import type { APIRoute } from "astro";
// Read rather than repeated, for the same reason Base.astro reads it: the
// colours here are palette values and a second copy would drift.
import tokens from "../../styles/tokens.css?raw";

/** Attendance as an app of its own.
 *
 *  A second manifest, scoped to /scan/, so a leader installs the scanner
 *  beside the site rather than instead of it, and the installed app never
 *  navigates out into the marketing pages. Built as a static file, so the
 *  service worker can cache it with everything else.
 */
const colour = (name: string) =>
  tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];

export const GET: APIRoute = () => {
  const olive = colour("--color-olive");
  const manifest = {
    name: "Attendance",
    short_name: "Attendance",
    description:
      "Griffith Hiking Club: check trail passes at the trailhead, with no signal.",
    id: "/scan/",
    start_url: "/scan/",
    scope: "/scan/",
    display: "standalone",
    orientation: "portrait",
    background_color: olive,
    theme_color: olive,
    icons: [
      { src: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json" },
  });
};
