import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/** Photos live beside their entry rather than in src/assets, because that is
 *  where an entry-relative CMS upload lands. `image()` resolves the bare
 *  filename the CMS writes and still runs it through the build pipeline. */

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
      /** Names the place in the photo, so it has to change when the photo does. */
      caption: z.string(),
      statement: z.string(),
    }),
});

const moments = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/moments" }),
  schema: ({ image }) =>
    z.object({
      order: z.number().int(),
      photo: image(),
      alt: z.string().min(1, "every photo needs a description"),
      caption: z.string(),
    }),
});

export const collections = { home, moments };
