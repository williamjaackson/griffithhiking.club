/** The one transformation between a Sanity document and a collection entry.
 *  Small, but a wrong answer here fails the build on the first event without an
 *  end date, and the error would point at the schema rather than at this. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTS_QUERY, toEntry } from "./sanity.ts";

test("the document id becomes the entry id", () => {
  const entry = toEntry({ _id: "morans-falls", title: "Morans Falls" });
  assert.equal(entry.id, "morans-falls");
  assert.equal("_id" in entry, false);
});

test("fields the document does not have are absent, not null", () => {
  const entry = toEntry({
    _id: "camping-trip",
    title: "Morans Falls",
    end: null,
    difficulty: null,
    applyUrl: undefined,
  });
  assert.deepEqual(entry, { id: "camping-trip", title: "Morans Falls" });
});

test("present fields pass through untouched", () => {
  const entry = toEntry({
    _id: "camping-trip",
    start: "2026-10-23",
    end: "2026-10-25",
    kind: "trip",
  });
  assert.deepEqual(entry, {
    id: "camping-trip",
    start: "2026-10-23",
    end: "2026-10-25",
    kind: "trip",
  });
});

test("the query names every field the schema knows", () => {
  for (const field of [
    "title",
    "start",
    "end",
    "place",
    "detail",
    "kind",
    "difficulty",
    "applyUrl",
  ]) {
    assert.match(EVENTS_QUERY, new RegExp(`\\b${field}\\b`));
  }
});

test("seed ids have no dot, so anonymous reads can see them", () => {
  const seed = readFileSync("studio/seed/events.ndjson", "utf8").trim();
  for (const line of seed.split("\n")) {
    const { _id } = JSON.parse(line) as { _id: string };
    assert.doesNotMatch(_id, /\./, `${_id} would be hidden from the site`);
  }
});
