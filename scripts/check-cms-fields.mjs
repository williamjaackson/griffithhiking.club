/**
 * A git-backed CMS has one unavoidable duplication: the field list exists both in
 * the CMS config and in the content schema. This asserts they agree, so an editor
 * can never be shown a field the site ignores, or miss one the site requires.
 */
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

const config = parse(readFileSync("public/admin/config.yml", "utf8"));
let failed = false;

const compare = (label, cmsFields, contentKeys) => {
  const cms = new Set(cmsFields);
  const content = new Set(contentKeys);
  const missing = [...content].filter((k) => !cms.has(k));
  const extra = [...cms].filter((k) => !content.has(k));
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
      compare(
        `${collection.name}/${f.name}`,
        f.fields.map((x) => x.name),
        Object.keys(entry),
      );
    }
  } else {
    const names = collection.fields.map((x) => x.name);
    for (const file of readdirSync(collection.folder).filter((n) =>
      n.endsWith(".yaml"),
    )) {
      const entry = parse(readFileSync(`${collection.folder}/${file}`, "utf8"));
      compare(`${collection.name}/${file}`, names, Object.keys(entry));
    }
  }
}

if (failed) {
  console.error("\nCMS config and content are out of step.");
  process.exit(1);
}
console.log("CMS config matches the content schema.");
