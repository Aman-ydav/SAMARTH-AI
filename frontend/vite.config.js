import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/* ANIM-80: preload only the latin Fraunces and Instrument Sans files used on first view.
   Fontsource emits hashed file names, so the links are generated from the build bundle. */
const PRELOAD_FONTS = [
    /fraunces-latin-opsz-normal-[\w-]+\.woff2$/,
    /instrument-sans-latin-wght-normal-[\w-]+\.woff2$/,
];

function fontPreload() {
    return {
        name: "samarth-font-preload",
        transformIndexHtml: {
            order: "post",
            handler(_html, ctx) {
                if (!ctx.bundle) return [];
                const files = Object.keys(ctx.bundle);
                return PRELOAD_FONTS.flatMap((pattern) =>
                    files.filter((file) => pattern.test(file))
                ).map((file) => ({
                    tag: "link",
                    attrs: {
                        rel: "preload",
                        as: "font",
                        type: "font/woff2",
                        crossorigin: "",
                        href: `/${file}`,
                    },
                    injectTo: "head",
                }));
            },
        },
    };
}

/* One manual chunk for the build: the modules whose path matches the `test` pattern are bundled together under `name`. */
/* `includeDependenciesRecursively: false` keeps recharts' own dependencies that the app shares (redux, immer, reselect) out of the chart chunks. */
const chartGroup = (name, test, priority) => ({
    name,
    test,
    priority,
    includeDependenciesRecursively: false,
});

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), fontPreload()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
        },
    },
    build: {
        rolldownOptions: {
            output: {
                // FE-111: the chart library alone is about 170 kB gzip, over the 150 kB route-chunk limit, so it is cut into three
                // lazy chunks. Only packages used by nothing else are listed, so nothing that the entry needs (immer, reselect,
                // react-redux, tiny-invariant) is pulled out of the entry chunk and into the initial load.
                codeSplitting: {
                    groups: [
                        chartGroup(
                            "charts-d3",
                            /node_modules[\\/](?:victory-vendor|d3-[\w-]+|internmap|decimal\.js-light)[\\/]/,
                            30
                        ),
                        chartGroup(
                            "charts-utils",
                            /node_modules[\\/](?:es-toolkit|eventemitter3)[\\/]/,
                            20
                        ),
                        chartGroup(
                            "charts",
                            /node_modules[\\/]recharts[\\/]/,
                            10
                        ),
                    ],
                },
            },
        },
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: false,
            },
        },
    },
});
