/**
 * A git-backed CMS has one unavoidable duplication: the field list exists both in
 * the CMS config and in the content schema. This asserts they agree, so an editor
 * can never be shown a field the site ignores, or miss one the site requires.
 */
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

const config = parse(readFileSync("public/admin/config.yml", "utf8"));
let failed = false;

/** A field the CMS marks `required: false` may legitimately be absent from any
 *  given entry - a single-day hike has no end date. So optional fields are
 *  allowed to be missing, while still having to exist in the CMS if the content
 *  uses them. */
const compare = (label, cmsFields, contentKeys) => {
  const cms = new Set(cmsFields.map((f) => f.name));
  const optional = new Set(
    cmsFields.filter((f) => f.required === false).map((f) => f.name),
  );
  const content = new Set(contentKeys);
  const missing = [...content].filter((k) => !cms.has(k));
  const extra = [...cms].filter((k) => !content.has(k) && !optional.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${label}`);
    if (missing.length)
      console.error(
        `  in the content but not offered by the CMS: ${missing.join(", ")}`,
      );
    if (extra.length)
      console.error(
        `  offered by the CMS but absent from the content: ${extra.join(", ")}`,
      );
  } else {
    console.log(`  ${label}: ${cms.size} fields agree`);
  }
};

for (const collection of config.collections) {
  if (collection.files) {
    for (const f of collection.files) {
      const entry = parse(readFileSync(f.file, "utf8"));
      compare(`${collection.name}/${f.name}`, f.fields, Object.keys(entry));
    }
  } else {
    for (const file of readdirSync(collection.folder).filter((n) =>
      n.endsWith(".yaml"),
    )) {
      const entry = parse(readFileSync(`${collection.folder}/${file}`, "utf8"));
      compare(
        `${collection.name}/${file}`,
        collection.fields,
        Object.keys(entry),
      );
    }
  }
}

if (failed) {
  console.error("\nCMS config and content are out of step.");
  process.exit(1);
}
console.log("CMS config matches the content schema.");
