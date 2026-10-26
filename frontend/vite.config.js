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

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), fontPreload()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
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
