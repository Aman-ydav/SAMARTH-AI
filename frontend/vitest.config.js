import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.js"],
        // Shadcn component smoke tests live in src/test (kebab-case ui files cannot carry a PascalCase test name, FS-22).
        include: ["src/**/*.test.{js,jsx}", "src/test/*Suite.{js,jsx}"],
        css: false,
        retry: 0,
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: "v8",
            reporter: ["text-summary", "lcov"],
            include: ["src/**/*.{js,jsx}"],
            exclude: [
                "src/**/*.test.{js,jsx}",
                "src/test/**",
                "src/mocks/**",
                "src/main.jsx",
                "src/i18n/locales/**",
            ],
            thresholds: {
                lines: 70,
                branches: 65,
                "src/lib/**": { lines: 90, branches: 85 },
                "src/app/**": { lines: 90, branches: 85 },
                "src/features/*/slice/**": { lines: 90, branches: 85 },
                "src/features/*/schemas/**": { lines: 90, branches: 85 },
            },
        },
    },
});
