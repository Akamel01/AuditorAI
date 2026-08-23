// Image intake policy unit gates: caps, sniffing, dedupe, per-project count —
// exercised directly against buildImageAttachment (route-level round-trips in
// tests/domain/attachments.test.ts).
import { describe, expect, it } from "vitest";
import { ATTACHMENT_MAX_BYTES, MAX_ATTACHMENTS_PER_PROJECT, type Attachment } from "@/domain/types";
import { buildImageAttachment } from "@/lib/intake";

function pngFile(sizeHint = 200, name = "plan.png"): File {
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pad = new Uint8Array(Math.max(0, sizeHint - header.length));
  return new File([new Uint8Array([...header, ...pad]).buffer as ArrayBuffer], name, {
    type: "image/png",
  });
}

function form(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries({ project_id: "P-1", ...overrides })) f.append(k, v);
  return f;
}

function attachment(id: string): Attachment {
  return {
    attachment_id: id,
    project_id: "P-1",
    input_id: null,
    file_name: `${id}.png`,
    mime: "image/png",
    bytes: 10,
    data_url: "data:image/png;base64,AA==",
    created_at: "2026-08-22T00:00:00.000Z",
  };
}

const DEPS = {
  newAttachmentId: (p: string) => `ATT-${p}-generated`,
  nowIso: () => "2026-08-23T00:00:00.000Z",
};

describe("buildImageAttachment", () => {
  it("builds the record for a valid paste, honoring a supplied id", async () => {
    const out = await buildImageAttachment(form(), pngFile(), [], DEPS);
    expect(out).toEqual({
      ok: true,
      value: expect.objectContaining({
        attachment_id: "ATT-P-1-generated",
        project_id: "P-1",
        mime: "image/png",
        created_at: "2026-08-23T00:00:00.000Z",
      }),
    });
    const supplied = await buildImageAttachment(
      form({ attachment_id: "ATT-mine" }),
      pngFile(),
      [],
      DEPS,
    );
    expect(supplied.ok && supplied.value.attachment_id).toBe("ATT-mine");
  });

  it("rejects oversize payloads before sniffing", async () => {
    const out = await buildImageAttachment(
      form(),
      pngFile(ATTACHMENT_MAX_BYTES + 1),
      [],
      DEPS,
    );
    expect(out).toEqual({
      ok: false,
      error: `Image exceeds ${ATTACHMENT_MAX_BYTES / 1000} KB limit`,
    });
  });

  it("rejects wrong-mime payloads regardless of claimed type", async () => {
    const svg = new File(["<svg onload=alert(1)>"], "evil.png", { type: "image/png" });
    const out = await buildImageAttachment(form(), svg, [], DEPS);
    expect(out).toEqual({
      ok: false,
      error: "Not a valid PNG/JPEG/WebP image (magic-byte sniff failed)",
    });
  });

  it("requires project_id and enforces the per-project cap and id dedupe", async () => {
    const noProject = await buildImageAttachment(new FormData(), pngFile(), [], DEPS);
    expect(noProject).toEqual({
      ok: false,
      error: "project_id is required for image attachments",
    });

    const full = Array.from({ length: MAX_ATTACHMENTS_PER_PROJECT }, (_, i) =>
      attachment(`ATT-${i}`),
    );
    const capped = await buildImageAttachment(form(), pngFile(), full, DEPS);
    expect(capped).toEqual({ ok: false, error: `Attachment limit reached (${MAX_ATTACHMENTS_PER_PROJECT} per project)` });

    const dup = await buildImageAttachment(
      form({ attachment_id: "ATT-taken" }),
      pngFile(),
      [attachment("ATT-taken")],
      DEPS,
    );
    expect(dup).toEqual({ ok: false, error: "Duplicate attachment id ATT-taken" });
  });
});
