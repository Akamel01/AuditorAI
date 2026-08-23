import { fileURLToPath } from "node:url";
import path from "node:path";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function fromRoot(...parts) {
  return path.join(REPO_ROOT, ...parts);
}
