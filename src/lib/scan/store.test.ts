import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, type Backing } from "./store.ts";
import { newRoll } from "./roll.ts";

/** localStorage, as far as the store can tell. */
const memory = (): Backing & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
};

const hike = { id: "abc123", title: "Morans Falls", start: "2026-09-12" };

test("a roll comes back as it went in", () => {
  const store = createStore(memory());
  const roll = newRoll(hike);
  assert.equal(store.saveRoll(roll), true);
  assert.deepEqual(store.loadRoll(hike.id), roll);
  assert.equal(store.loadRoll("nope"), null);
});

test("every roll on the phone is listed, and nothing else is", () => {
  const backing = memory();
  const store = createStore(backing);
  store.saveRoll(newRoll(hike));
  store.saveRoll(newRoll({ id: "other:coot-tha", title: "Coot-tha" }));
  store.setCurrentHike(hike.id);
  backing.setItem("griffith-hiking-club:trail-pass", "{}");

  assert.deepEqual(
    store
      .listRolls()
      .map((roll) => roll.hike.id)
      .sort(),
    ["abc123", "other:coot-tha"],
  );
});

test("a garbled entry reads as absent rather than throwing", () => {
  const backing = memory();
  const store = createStore(backing);
  backing.setItem("griffith-hiking-club:scan:roll:bad", "{not json");
  backing.setItem("griffith-hiking-club:scan:roll:shape", '{"hike":1}');
  assert.equal(store.loadRoll("bad"), null);
  assert.equal(store.loadRoll("shape"), null);
  assert.deepEqual(store.listRolls(), []);
});

test("a full or refused storage fails quietly", () => {
  const backing = memory();
  backing.setItem = () => {
    throw new DOMException("quota", "QuotaExceededError");
  };
  const store = createStore(backing);
  assert.equal(store.saveRoll(newRoll(hike)), false);
  assert.equal(store.currentHike(), null);
});

test("the current hike is remembered", () => {
  const store = createStore(memory());
  assert.equal(store.currentHike(), null);
  store.setCurrentHike(hike.id);
  assert.equal(store.currentHike(), hike.id);
  store.setCurrentHike(null);
  assert.equal(store.currentHike(), null);
});
