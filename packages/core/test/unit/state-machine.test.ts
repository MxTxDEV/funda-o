import { TASK_STATUSES } from "@vc/db/values";
import { describe, expect, it } from "vitest";
import { canTransition, TASK_TRANSITIONS, TERMINAL_STATUSES } from "../../src/tasks/state-machine";

describe("task state machine", () => {
  it("defines transitions for every status", () => {
    for (const s of TASK_STATUSES) expect(TASK_TRANSITIONS[s]).toBeDefined();
  });

  it("allows the main lifecycle", () => {
    expect(canTransition("pending", "queued")).toBe(true);
    expect(canTransition("queued", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "waiting_approval")).toBe(true);
    expect(canTransition("waiting_approval", "queued")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(true);
  });

  it("supports retries and manual retry", () => {
    expect(canTransition("in_progress", "queued")).toBe(true);
    expect(canTransition("failed", "queued")).toBe(true);
  });

  it("forbids leaving terminal states", () => {
    for (const s of TERMINAL_STATUSES) {
      for (const to of TASK_STATUSES) expect(canTransition(s, to)).toBe(false);
    }
  });

  it("forbids skipping the queue", () => {
    expect(canTransition("pending", "in_progress")).toBe(false);
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("queued", "completed")).toBe(false);
  });
});
