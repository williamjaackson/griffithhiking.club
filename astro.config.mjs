// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import precache from "./integrations/precache.ts";

// https://astro.build/config
export default defineConfig({
  // Fills in the scanner's service worker once the asset names are known.
  integrations: [precache()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Phones only open a camera on HTTPS, so the scanner is tested through
      // `cloudflared tunnel --url http://localhost:4321`. Vite refuses hosts it
      // does not know, and the tunnel's is different every time.
      allowedHosts: [".trycloudflare.com"],
    },
  },
});
