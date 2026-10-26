import js from "@eslint/js";
import importX from "eslint-plugin-import-x";
import globals from "globals";

const SDK_RULES = {
    cloudinary:
        "Import the Cloudinary SDK only inside src/integrations/cloudinary/ (MEDIA-03).",
    "@getbrevo/brevo":
        "Import the Brevo SDK only inside src/integrations/email/ (FS-16).",
    "google-auth-library":
        "Import the Google SDK only inside src/integrations/google/ (FS-16).",
    dotenv: "Environment files are loaded only in src/config/env.js (BE-04).",
    "express-mongo-sanitize":
        "Not compatible with Express 5: use utils/sanitize.js (BE-28).",
    hpp: "Not compatible with Express 5: use utils/sanitize.js (BE-28).",
};

export default [
    { ignores: ["node_modules/**", "coverage/**", "postman/results/**"] },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: { ...globals.node },
        },
        plugins: { "import-x": importX },
        rules: {
            "no-console": "error",
            "no-restricted-properties": [
                "error",
                {
                    object: "process",
                    property: "env",
                    message:
                        "Read configuration only through #config/env.js (BE-04, BE-26).",
                },
            ],
            "no-restricted-imports": [
                "error",
                {
                    paths: Object.entries(SDK_RULES).map(([name, message]) => ({
                        name,
                        message,
                    })),
                    patterns: [
                        {
                            regex: "^\\.\\./\\.\\./",
                            message:
                                "Use a #subpath import instead of climbing more than one directory (FS-40).",
                        },
                        {
                            regex: "^(?:\\.\\./)+src/",
                            message: "Use a #subpath import (FS-40).",
                        },
                    ],
                },
            ],
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrors: "none",
                },
            ],
            "no-var": "error",
            "prefer-const": "error",
            eqeqeq: ["error", "always"],
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            "no-throw-literal": "error",
            "no-else-return": "error",
            "no-useless-return": "error",
            "import-x/no-cycle": ["error", { maxDepth: Infinity }],
            "import-x/no-unresolved": ["error", { commonjs: false }],
            "import-x/no-duplicates": "error",
            "import-x/first": "error",
            "import-x/no-default-export": "error",
            "import-x/no-self-import": "error",
        },
    },
    {
        // The only files that may read the environment, load dotenv, or import a vendor SDK.
        files: ["src/config/env.js"],
        rules: {
            "no-restricted-properties": "off",
            "no-restricted-imports": "off",
        },
    },
    {
        files: ["src/integrations/cloudinary/**/*.js"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: Object.entries(SDK_RULES)
                        .filter(([name]) => name !== "cloudinary")
                        .map(([name, message]) => ({ name, message })),
                },
            ],
        },
    },
    {
        files: ["src/integrations/email/**/*.js"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: Object.entries(SDK_RULES)
                        .filter(([name]) => name !== "@getbrevo/brevo")
                        .map(([name, message]) => ({ name, message })),
                },
            ],
        },
    },
    {
        files: ["src/integrations/google/**/*.js"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: Object.entries(SDK_RULES)
                        .filter(([name]) => name !== "google-auth-library")
                        .map(([name, message]) => ({ name, message })),
                },
            ],
        },
    },
    {
        // Tests and test tooling may touch process.env (stubs, child-process setup) and mock vendor SDKs.
        files: ["**/*.test.js", "tests/**/*.js"],
        rules: {
            "no-restricted-properties": "off",
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        { name: "express-mongo-sanitize" },
                        { name: "hpp" },
                    ],
                },
            ],
        },
    },
    {
        // Tool entry points that must default-export by contract.
        files: [
            "eslint.config.js",
            "vitest.config.js",
            "tests/setup/globalSetup.js",
        ],
        rules: { "import-x/no-default-export": "off" },
    },
];
