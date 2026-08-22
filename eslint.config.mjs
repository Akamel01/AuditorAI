import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", ".next/", "out/", "coverage/", "next-env.d.ts"] },
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
