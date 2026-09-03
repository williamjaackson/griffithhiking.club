import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import project from "../sanity.project.json";
import { event } from "./schemaTypes/event";

/** The editing UI the club's executives use.
 *
 *  Hosted by Sanity at <studioHost>.sanity.studio, so nobody needs a GitHub
 *  account or a terminal to change the calendar. Deployed by
 *  .github/workflows/deploy-studio.yml whenever this directory changes.
 *
 *  One document type, on purpose. The rest of the site's copy still lives in
 *  src/content and changes rarely enough to go through a pull request.
 */
export default defineConfig({
  name: "default",
  title: "Griffith Hiking Club",
  projectId: project.projectId,
  dataset: project.dataset,
  plugins: [structureTool()],
  schema: { types: [event] },
});
