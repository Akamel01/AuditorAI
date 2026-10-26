// M4 gate: the multipart upload route validates its NON-file form fields
// against contracts/schemas/api/upload-fields.schema.json. The auth gate
// stays first (401 before 400); the file policy stays with lib/intake.ts
// and lib/extract.ts (the File is never part of the validated field set).
import { describe, expect, it } from "vitest";
import { POST as createProject } from "@/app/api/projects/route";
import { POST as upload } from "@/app/api/upload/route";

// One workspace key per test: the rate limiter allows 120/min per workspace.
let keySeq = 0;
function freshKey(): string {
  keySeq += 1;
  return `m4-upload-body-${keySeq}-0123456789abcdef`;
}

function pngBytes(sizeHint = 200): Uint8Array {
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pad = new Uint8Array(Math.max(0, sizeHint - header.length));
  return new Uint8Array([...header, ...pad]);
}

function pngFile(name = "plan.png", sizeHint = 200): File {
  return new File([new Uint8Array(pngBytes(sizeHint)).buffer as ArrayBuffer], name, {
    type: "image/png",
  });
}

async function makeProject(key: string): Promise<string> {
  const created = await createProject(
    new Request("http://local/api/projects", {
      method: "POST",
      headers: { "x-workspace-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        name: "M4 Upload Validation",
        jurisdiction: "UK",
        native_stage_id: "uk:S2",
      }),
    }),
  );
  const d = (await created.json()) as { project: { project_id: string } };
  return d.project.project_id;
}

describe("upload body validation (M4)", () => {
  it("rejects an unknown non-file form field with 400", async () => {
    const key = freshKey();
    const form = new FormData();
    form.append("kind", "image");
    form.append("surprise", "boom");
    form.append("file", pngFile());
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /^invalid form field: /,
    );
  });

  it("rejects an unknown field even when the upload would otherwise succeed", async () => {
    const key = freshKey();
    const pid = await makeProject(key);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("not_a_field", "x");
    form.append("file", pngFile());
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("unexpected field");
  });

  it("keeps the intake 400 for kind=image without project_id", async () => {
    const key = freshKey();
    const form = new FormData();
    form.append("kind", "image");
    form.append("file", pngFile());
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/project_id is required/);
  });

  it("keeps the magic-byte 400 for a non-image file in the image branch", async () => {
    const key = freshKey();
    const pid = await makeProject(key);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append(
      "file",
      new File([new TextEncoder().encode("<svg onload=alert(1)>")], "evil.png", {
        type: "image/png",
      }),
    );
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/magic-byte/i);
  });

  it("keeps the 400 for an oversize image", async () => {
    const key = freshKey();
    const pid = await makeProject(key);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("file", pngFile("big.png", 501 * 1000));
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/500 KB/);
  });

  it("answers 401 before validating the body when no key is presented", async () => {
    const form = new FormData();
    form.append("surprise", "boom");
    form.append("file", pngFile());
    const res = await upload(
      new Request("http://local/api/upload", { method: "POST", body: form }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts a valid image upload (the File part is never an unknown field)", async () => {
    const key = freshKey();
    const pid = await makeProject(key);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", pid);
    form.append("input_id", "drawing_document_register");
    form.append("file", pngFile());
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { attachment: { mime: string } };
    expect(body.attachment.mime).toBe("image/png");
  });

  it("accepts a valid document upload", async () => {
    const key = freshKey();
    const form = new FormData();
    form.append("file", new File(["hello world"], "notes.txt", { type: "text/plain" }));
    const res = await upload(
      new Request("http://local/api/upload", {
        method: "POST",
        headers: { "x-workspace-key": key },
        body: form,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { extracted_text: string; file_name: string };
    expect(body.file_name).toBe("notes.txt");
    expect(body.extracted_text).toBe("hello world");
  });
});
