// Typed-error → HTTP-status mapping table: legit contract failures echo a
// meaningful message at their status; everything else is redacted at 500 and
// store unavailability surfaces as 503 without internals.
import { describe, expect, it, vi } from "vitest";
import { RequestContractError, serverError } from "@/lib/api";
import { StageNotEligibleError } from "@/domain/pipeline/constants";
import { UploadError } from "@/lib/extract";
import {
  ArtifactTooLargeError,
  StoreUnavailableError,
  UnknownAttachmentError,
} from "@/lib/persistence";

async function mapOf(e: unknown): Promise<{ status: number; error: string }> {
  const res = serverError(e);
  return { status: res.status, error: ((await res.json()) as { error: string }).error };
}

describe("serverError mapping table", () => {
  it("maps each typed error to its status with the message echoed", async () => {
    expect(await mapOf(new UploadError("bad file"))).toEqual({ status: 400, error: "bad file" });
    expect(await mapOf(new UnknownAttachmentError("ATT-x"))).toEqual({
      status: 400,
      error: "unknown attachment ATT-x",
    });
    expect(await mapOf(new RequestContractError("AG-RULES requires slice 'stage_context'"))).toEqual(
      { status: 422, error: "AG-RULES requires slice 'stage_context'" },
    );
    expect(
      await mapOf(new StageNotEligibleError("UK", "uk:S3", "stage not eligible", [])),
    ).toEqual({ status: 422, error: "stage not eligible" });
    expect(await mapOf(new ArtifactTooLargeError("AG-X", 1, 600000))).toEqual({
      status: 413,
      error: "artifact AG-X#1 is 600000 bytes; cap is 512000",
    });
  });

  it("store unavailability becomes 503 with a redacted message", async () => {
    expect(await mapOf(new StoreUnavailableError("http://kv REST 500"))).toEqual({
      status: 503,
      error: "internal server error",
    });
  });

  it("unexpected errors are logged then redacted at 500 (never echoed)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await mapOf(new Error("select * from secrets; stack details"))).toEqual({
        status: 500,
        error: "internal server error",
      });
      expect(await mapOf("a thrown string")).toEqual({
        status: 500,
        error: "internal server error",
      });
      expect(log).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });
});
