import { describe, expect, it, vi } from "vitest";
import { fireAlert } from "@/lib/alert";

describe("alert dedup", () => {
  it("deduplicates identical alerts within the window", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fireAlert({ kind: "generic", message: "boom" });
    fireAlert({ kind: "generic", message: "boom" });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
