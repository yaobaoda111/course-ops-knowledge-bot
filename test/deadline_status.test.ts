import assert from "node:assert/strict";
import test from "node:test";
import { deadlineStatus } from "../src/deadline_status.ts";

test("flags an unfinished learner deadline inside 48 hours", () => {
  const now = new Date("2026-08-31T09:00:00.000Z");
  assert.equal(deadlineStatus("2026-09-02T08:00:00.000Z", null, now), "due_soon");
});

test("keeps completed work on track after its deadline", () => {
  const now = new Date("2026-08-31T09:00:00.000Z");
  assert.equal(deadlineStatus("2026-08-30T09:00:00.000Z", "2026-08-29T15:00:00.000Z", now), "on_track");
});
