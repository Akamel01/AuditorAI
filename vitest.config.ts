import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Offline guarantee (critique m5): a suite can never open a real pool,
    // whatever the developer's shell exports. src/lib/db/config.ts treats
    // NODE_ENV === "test" as "the database is not configured" as well.
    env: { POSTGRES_URL: "", SUPABASE_URL: "" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
