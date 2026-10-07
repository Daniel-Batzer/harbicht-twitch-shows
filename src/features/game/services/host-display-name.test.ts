import { afterEach, describe, expect, it, vi } from "vitest";
import { readHostDisplayName } from "./host-display-name";

describe("readHostDisplayName", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured name, trimmed", () => {
    vi.stubEnv("HOST_DISPLAY_NAME", "  Louis ");

    expect(readHostDisplayName()).toBe("Louis");
  });

  it("falls back to Host when the variable is missing", () => {
    vi.stubEnv("HOST_DISPLAY_NAME", undefined);

    expect(readHostDisplayName()).toBe("Host");
  });

  it.each(["", "   ", "x".repeat(33)])("falls back to Host for the invalid value %j", (value) => {
    vi.stubEnv("HOST_DISPLAY_NAME", value);

    expect(readHostDisplayName()).toBe("Host");
  });
});
