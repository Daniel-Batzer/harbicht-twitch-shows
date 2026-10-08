import { describe, expect, it } from "vitest";
import { createRecentMessageIds } from "./recent-message-ids";

describe("createRecentMessageIds", () => {
  it("reports a new id once and every repeat as seen", () => {
    const recentIds = createRecentMessageIds(10);

    expect(recentIds.remember("a")).toBe(true);
    expect(recentIds.remember("a")).toBe(false);
    expect(recentIds.remember("b")).toBe(true);
    expect(recentIds.remember("a")).toBe(false);
  });

  it("forgets the oldest id once the capacity is exceeded", () => {
    const recentIds = createRecentMessageIds(2);
    recentIds.remember("a");
    recentIds.remember("b");
    recentIds.remember("c");

    expect(recentIds.remember("b")).toBe(false);
    expect(recentIds.remember("c")).toBe(false);
    expect(recentIds.remember("a")).toBe(true);
  });
});
