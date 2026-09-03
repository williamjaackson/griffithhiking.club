import { defineCliConfig } from "sanity/cli";
import project from "../sanity.project.json";

// The project id and studio hostname live in sanity.project.json, which the
// site's build reads too, so the two can never point at different projects.
// scripts/setup-sanity.sh fills the file in.
export default defineCliConfig({
  api: { projectId: project.projectId, dataset: project.dataset },
  studioHost: project.studioHost,
});
