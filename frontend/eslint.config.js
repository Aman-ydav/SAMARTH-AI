import path from "node:path";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { createNodeResolver, importX } from "eslint-plugin-import-x";
import { defineConfig, globalIgnores } from "eslint/config";

/* Rule IDs: FE-96 (no lucide / react-icons in app code), FE-38/39 (axios only in api files), FE-38 (no fetch),
   FE-109 (no console), FE-106 (storage only via lib/storage.js, no token keys), FS-44 (no import cycles).
   eslint-plugin-jsx-a11y is not installable with ESLint 10; accessibility is covered by vitest-axe tests. */

const TOKEN_KEY =
    "/token|jwt|auth|session|csrf|password|secret|refresh|access/i";

const LUCIDE = {
    group: ["lucide-react", "lucide-react/*", "lucide", "lucide/*"],
    message:
        "lucide-react is forbidden (UI-30, FE-96). Use icons from @/components/icons.",
};
const REACT_ICONS = {
    group: ["react-icons", "react-icons/*"],
    message:
        "Import icons only through @/components/icons (UI-31). react-icons is imported in components/icons/index.js alone.",
};
const AXIOS = {
    group: ["axios"],
    message:
        "axios is imported only in features/*/api/*Api.js and lib/apiClient.js (FE-39).",
};
const API_CLIENT = {
    group: ["@/lib/apiClient", "**/apiClient", "**/apiClient.js"],
    message:
        "apiClient is imported only in features/*/api/*Api.js (FE-39). Use a thunk.",
};

const restrictImports = (...patterns) => ["error", { patterns }];

const restrictedSyntax = [
    "error",
    {
        selector: `CallExpression[callee.property.name=/^(setItem|getItem|removeItem)$/][arguments.0.value=${TOKEN_KEY}]`,
        message:
            "Never store tokens or credentials in browser storage (AUTH-01, FE-106).",
    },
    {
        selector: `CallExpression[callee.object.name="storage"][arguments.0.value=${TOKEN_KEY}]`,
        message:
            "Token-like storage key (FE-106). Only sai-theme, sai-lang, sai-sidebar and the session keys are allowed.",
    },
];

export default defineConfig([
    globalIgnores(["dist", "coverage", "node_modules"]),
    {
        files: ["**/*.{js,jsx}"],
        extends: [
            js.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        plugins: { "import-x": importX },
        settings: {
            "import-x/resolver-next": [
                createNodeResolver({
                    extensions: [".js", ".jsx", ".json"],
                    alias: { "@": [path.resolve(import.meta.dirname, "src")] },
                }),
            ],
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.browser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: {
            "no-unused-vars": [
                "error",
                { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" },
            ],
            "no-console": "error",
            "no-restricted-globals": [
                "error",
                {
                    name: "fetch",
                    message:
                        "Use the axios apiClient through a thunk (FE-38). No fetch.",
                },
                {
                    name: "XMLHttpRequest",
                    message: "Use the axios apiClient through a thunk (FE-38).",
                },
                {
                    name: "localStorage",
                    message:
                        "Browser storage goes through lib/storage.js (FE-106).",
                },
                {
                    name: "sessionStorage",
                    message:
                        "Browser storage goes through lib/storage.js (FE-106).",
                },
            ],
            "no-restricted-properties": [
                "error",
                {
                    object: "window",
                    property: "fetch",
                    message: "Use the axios apiClient (FE-38).",
                },
                {
                    object: "globalThis",
                    property: "fetch",
                    message: "Use the axios apiClient (FE-38).",
                },
            ],
            "no-restricted-imports": restrictImports(
                LUCIDE,
                REACT_ICONS,
                AXIOS,
                API_CLIENT
            ),
            "no-restricted-syntax": restrictedSyntax,
            "import-x/no-cycle": ["error", { maxDepth: Infinity }],
            "import-x/no-duplicates": "error",
        },
    },
    {
        // The icon registry is the only file that imports react-icons (UI-31).
        files: ["src/components/icons/index.js"],
        rules: {
            "no-restricted-imports": restrictImports(LUCIDE, AXIOS, API_CLIENT),
        },
    },
    {
        // API files and the single axios instance are the only axios users (FE-39).
        files: ["src/features/*/api/*Api.js", "src/lib/apiClient.js"],
        rules: {
            "no-restricted-imports": restrictImports(LUCIDE, REACT_ICONS),
        },
    },
    {
        // The storage gateway is the only file that touches web storage (FE-106).
        files: ["src/lib/storage.js"],
        rules: {
            "no-restricted-syntax": "off",
            "no-restricted-globals": "off",
        },
    },
    {
        // shadcn files export variant helpers and hooks next to their components; fast refresh is not the goal there.
        files: ["src/components/ui/**/*.{js,jsx}"],
        rules: { "react-refresh/only-export-components": "off" },
    },
    {
        // Tests, MSW and test support may use node and vitest globals; they never talk to the network for real.
        files: [
            "**/*.test.{js,jsx}",
            "src/test/**/*.{js,jsx}",
            "src/mocks/**/*.js",
        ],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: {
            "react-refresh/only-export-components": "off",
            "no-restricted-imports": restrictImports(
                LUCIDE,
                REACT_ICONS,
                AXIOS
            ),
            // Tests seed and inspect web storage directly; fetch stays banned (TEST-22).
            "no-restricted-globals": [
                "error",
                {
                    name: "fetch",
                    message:
                        "Tests mock the network with MSW; no fetch (TEST-22).",
                },
                {
                    name: "XMLHttpRequest",
                    message: "Tests mock the network with MSW (TEST-22).",
                },
            ],
        },
    },
    {
        files: ["*.config.js", "scripts/**/*.js"],
        languageOptions: { globals: globals.node },
    },
]);
