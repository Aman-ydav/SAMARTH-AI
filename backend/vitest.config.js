import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.js", "tests/integration/**/*.test.js"],
        globalSetup: ["tests/setup/globalSetup.js"],
        setupFiles: ["tests/setup/testSetup.js"],
        testTimeout: 15_000,
        hookTimeout: 60_000,
        restoreMocks: true,
        unstubEnvs: true,
        retry: 0,
        coverage: {
            provider: "v8",
            reporter: ["text-summary", "text"],
            include: ["src/**/*.js"],
            exclude: [
                "src/**/*.test.js",
                "src/**/*.mock.js",
                "src/index.js",
                "src/db/migrations/**",
            ],
            thresholds: {
                lines: 80,
                branches: 75,
                "src/utils/**": { lines: 90, branches: 85 },
                "src/middlewares/**": { lines: 90, branches: 85 },
                "src/modules/*/*.service.js": { lines: 90, branches: 85 },
            },
        },
    },
});
