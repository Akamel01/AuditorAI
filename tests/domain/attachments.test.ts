// M2 gates: image attachment intake through the real upload route —
// oversize rejection, magic-byte mime sniffing, duplicate-id handling,
// per-project cap, round-trip via the DataStore seam (MemoryStore in tests).
import { describe, expect, it } from "vitest";
import { POST as createProject } from "@/app/api/projects/route";
import { GET as getProject, PATCH as patchProject } from "@/app/api/projects/[projectId]/route";
import { POST as upload } from "@/app/api/upload/route";
import {
  DELETE as deleteAttachment,
  GET as getAttachment,
} from "@/app/api/projects/[projectId]/attachments/[attachmentId]/route";
import { sniffImageMime } from "@/lib/extract";
import type { Attachment } from "@/domain/types";

const KEY = "test-workspace-key-0123456789";
const H = { "x-workspace-key": KEY };

function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(`http://local${url}`, {
    method,
    headers: { ...H, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params<T extends object>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

function pngBytes(sizeHint = 200): Uint8Array {
  // Minimal valid PNG header + padding.
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pad = new Uint8Array(Math.max(0, sizeHint - header.length));
  return new Uint8Array([...header, ...pad]);
}

async function makeProject(): Promise<string> {
  const created = await createProject(
    jsonReq("/api/projects", "POST", {
      name: "M2 Attachment Corridor",
      jurisdiction: "UK",
      native_stage_id: "uk:S2",
    }),
  );
  const d = (await created.json()) as { project: { project_id: string } };
  return d.project.project_id;
}

describe("attachment intake (M2)", () => {
  it("sniffs mime by magic bytes, never trusting headers", () => {
    expect(sniffImageMime(pngBytes())).toBe("image/png");
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    const webp = new Uint8Array([
      ...new TextEncoder().encode("RIFF"),
      0, 0, 0, 0,
      ...new TextEncoder().encode("WEBP"),
      ...new Uint8Array(8).fill(0),
    ]);
    expect(sniffImageMime(webp)).toBe("image/webp");
    expect(sniffImageMime(new TextEncoder().encode("<html>"))).toBeNull();
  });

  it("round-trips a pasted PNG: upload → record → thumbnail data-url → input link", async () => {
    const pid = await makeProject();
    const bytes = pngBytes(400);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("input_id", "drawing_document_register");
    form.append("file", new File([new Uint8Array(bytes).buffer as ArrayBuffer], "plan.png", { type: "image/png" }));
    const up = await upload(
      new Request("http://local/api/upload", { method: "POST", headers: H, body: form }),
    );
    expect(up.status).toBe(200);
    const { attachment } = (await up.json()) as { attachment: Attachment };
    expect(attachment.attachment_id).toMatch(/^ATT-/);
    expect(attachment.mime).toBe("image/png");
    expect(attachment.data_url.startsWith("data:image/png;base64,")).toBe(true);

    // Link the attachment to the input.
    const patch = await patchProject(
      jsonReq(`/api/projects/${pid}`, "PATCH", {
        input_values: {
          drawing_document_register: {
            state: "provided",
            value: "Plan sheet attached.",
            attachments: [attachment.attachment_id],
          },
        },
      }),
      params({ projectId: pid }),
    );
    expect(patch.status).toBe(200);
    const gp = await getProject(
      jsonReq(`/api/projects/${pid}`, "GET"),
      params({ projectId: pid }),
    );
    const p = (await gp.json()) as { project: { input_values: Record<string, { attachments?: string[] }> } };
    expect(p.project.input_values.drawing_document_register.attachments).toContain(
      attachment.attachment_id,
    );

    // Thumbnail fetch returns the stored data-url.
    const got = await getAttachment(
      jsonReq(`/api/projects/${pid}/attachments/${attachment.attachment_id}`, "GET"),
      params({ projectId: pid, attachmentId: attachment.attachment_id }),
    );
    expect(got.status).toBe(200);
  });

  it("rejects an oversize image (>500 KB) before storing anything", async () => {
    const pid = await makeProject();
    const big = pngBytes(501 * 1000);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("file", new File([new Uint8Array(big).buffer as ArrayBuffer], "big.png", { type: "image/png" }));
    const res = await upload(
      new Request("http://local/api/upload", { method: "POST", headers: H, body: form }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/500 KB/);
  });

  it("rejects wrong-mime payloads claiming to be images", async () => {
    const pid = await makeProject();
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append(
      "file",
      new File([new Uint8Array(new TextEncoder().encode("<svg onload=alert(1)>")).buffer as ArrayBuffer], "evil.png", {
        type: "image/png",
      }),
    );
    const res = await upload(
      new Request("http://local/api/upload", { method: "POST", headers: H, body: form }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/magic-byte/i);
  });

  it("rejects duplicate client-supplied ids", async () => {
    const pid = await makeProject();
    for (const attempt of [1, 2]) {
      const form = new FormData();
      form.append("kind", "image");
      form.append("project_id", pid);
      form.append("attachment_id", "ATT-p-fixed01");
      form.append("file", new File([new Uint8Array(pngBytes()).buffer as ArrayBuffer], `plan${attempt}.png`, { type: "image/png" }));
      const res = await upload(
        new Request("http://local/api/upload", { method: "POST", headers: H, body: form }),
      );
      expect(res.status).toBe(attempt === 1 ? 200 : 400);
    }
  });

  it("enforces the ≤12 attachments per project cap", async () => {
    const pid = await makeProject();
    let lastStatus = 200;
    for (let i = 0; i < 13; i++) {
      const form = new FormData();
      form.append("kind", "image");
      form.append("project_id", pid);
      form.append("file", new File([new Uint8Array(pngBytes()).buffer as ArrayBuffer], `plan-${i}.png`, { type: "image/png" }));
      const res = await upload(
        new Request("http://local/api/upload", { method: "POST", headers: H, body: form }),
      );
      lastStatus = res.status;
      if (i < 12) expect(res.status).toBe(200);
    }
    expect(lastStatus).toBe(400);
  });

  it("a text-only PATCH preserves existing attachment links", async () => {
    const pid = await makeProject();
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("attachment_id", "ATT-p-keep001");
    form.append("file", new File([new Uint8Array(pngBytes()).buffer as ArrayBuffer], "plan.png", { type: "image/png" }));
    await upload(new Request("http://local/api/upload", { method: "POST", headers: H, body: form }));
    await patchProject(
      jsonReq(`/api/projects/${pid}`, "PATCH", {
        input_values: {
          drawing_document_register: {
            state: "provided",
            value: "v1",
            attachments: ["ATT-p-keep001"],
          },
        },
      }),
      params({ projectId: pid }),
    );

    // Text edit blur path: patch WITHOUT the attachments key.
    await patchProject(
      jsonReq(`/api/projects/${pid}`, "PATCH", {
        input_values: {
          drawing_document_register: { state: "provided", value: "v2 edited" },
        },
      }),
      params({ projectId: pid }),
    );

    const gp = await getProject(jsonReq(`/api/projects/${pid}`, "GET"), params({ projectId: pid }));
    const p = (await gp.json()) as { project: { input_values: Record<string, { attachments?: string[] }> } };
    expect(p.project.input_values.drawing_document_register.attachments).toEqual([
      "ATT-p-keep001",
    ]);
  });

  it("delete frees the record and strips the id from inputs", async () => {
    const pid = await makeProject();
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("attachment_id", "ATT-p-del0001");
    form.append("file", new File([new Uint8Array(pngBytes()).buffer as ArrayBuffer], "plan.png", { type: "image/png" }));
    await upload(new Request("http://local/api/upload", { method: "POST", headers: H, body: form }));
    await patchProject(
      jsonReq(`/api/projects/${pid}`, "PATCH", {
        input_values: {
          drawing_document_register: {
            state: "provided",
            value: "",
            attachments: ["ATT-p-del0001"],
          },
        },
      }),
      params({ projectId: pid }),
    );

    const del = await deleteAttachment(
      jsonReq(`/api/projects/${pid}/attachments/ATT-p-del0001`, "DELETE"),
      params({ projectId: pid, attachmentId: "ATT-p-del0001" }),
    );
    expect(del.status).toBe(200);

    const gp = await getProject(jsonReq(`/api/projects/${pid}`, "GET"), params({ projectId: pid }));
    const p = (await gp.json()) as { project: { input_values: Record<string, { attachments?: string[] }> } };
    expect(p.project.input_values.drawing_document_register.attachments ?? []).not.toContain(
      "ATT-p-del0001",
    );

    const gone = await getAttachment(
      jsonReq(`/api/projects/${pid}/attachments/ATT-p-del0001`, "GET"),
      params({ projectId: pid, attachmentId: "ATT-p-del0001" }),
    );
    expect(gone.status).toBe(404);
  });
});
