import { describe, expect, it } from "vitest";
import { APP_VERSION } from "@/lib/version";

describe("APP_VERSION", () => {
  it("is valid semver", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
