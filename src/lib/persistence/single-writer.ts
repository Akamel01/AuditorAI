// Simple in-process single-writer lock to guard persistence micro-paths
// that mutate shared state (e.g., filesystem KV mirrors). This is a
// minimal, test-friendly primitive suitable for unit tests and single-process
// runs.
let PERSISTENCE_SINGLE_WRITER_LOCK = false;

export async function withPersistenceSingleWriter<T>(fn: () => Promise<T> | T): Promise<T> {
  if (PERSISTENCE_SINGLE_WRITER_LOCK) {
    throw new Error("persistence write in progress");
  }
  PERSISTENCE_SINGLE_WRITER_LOCK = true;
  try {
    return await Promise.resolve(fn());
  } finally {
    PERSISTENCE_SINGLE_WRITER_LOCK = false;
  }
}
