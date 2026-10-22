import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Offline guarantee (critique m5): a suite can never open a real pool,
    // whatever the developer's shell exports. src/lib/db/pg-client.ts refuses
    // to build a pool in NODE_ENV === "test" as well.
    env: { POSTGRES_URL: "", TENANT_POSTGRES_URL: "", TENANT_STORE: "", SUPABASE_URL: "" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
