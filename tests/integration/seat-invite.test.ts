import { describe, expect, it } from "vitest";
import { INVITE_TTL_DAYS, canInvite, seatsUsed } from "@/lib/db/seats";

describe("seat arithmetic (M8)", () => {
  it("INVITE_TTL_DAYS is 14", () => {
    expect(INVITE_TTL_DAYS).toBe(14);
  });

  it("seatsUsed sums active + pending", () => {
    expect(seatsUsed(2, 1)).toBe(3);
    expect(seatsUsed(0, 0)).toBe(0);
  });

  it("canInvite allows when under seat count", () => {
    expect(canInvite(1, 0, 3)).toBe(true);
    expect(canInvite(2, 1, 3)).toBe(false);
    expect(canInvite(3, 0, 3)).toBe(false);
  });
});
