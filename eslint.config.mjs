import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", ".next/", ".vercel/", "out/", "coverage/", "next-env.d.ts", "tmp/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);
