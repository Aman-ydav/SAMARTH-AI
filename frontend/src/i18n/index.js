import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import {
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    detectLanguage,
    resolveLanguage,
} from "@/lib/format";

export const NAMESPACES = Object.freeze([
    "common",
    "nav",
    "landing",
    "about",
    "legal",
    "auth",
    "errors",
    "footer",
    "validation",
]);
export const DEFAULT_NAMESPACE = "common";
const BUNDLED_NAMESPACES = [
    "common",
    "nav",
    "auth",
    "errors",
    "validation",
    "footer",
];

/* English is the fallback for every string, so only its screen-independent namespaces ship in the initial bundle (FE-111).
   Hindi and the remaining English namespaces load on first use through the backend below; switching language awaits the load. */
const bundled = import.meta.glob(
    "./locales/en/{common,nav,auth,errors,validation,footer}.json",
    { eager: true, import: "default" }
);
const deferred = import.meta.glob(
    [
        "./locales/*/*.json",
        "!./locales/en/{common,nav,auth,errors,validation,footer}.json",
    ],
    { import: "default" }
);

function buildResources() {
    const resources = {};
    for (const [file, data] of Object.entries(bundled)) {
        const match = /\/locales\/([a-z]{2})\/([A-Za-z]+)\.json$/.exec(file);
        if (!match) continue;
        const [, language, namespace] = match;
        resources[language] ??= {};
        resources[language][namespace] = data;
    }
    return resources;
}

const deferredBackend = {
    type: "backend",
    init() {},
    read(language, namespace, callback) {
        const load = deferred[`./locales/${language}/${namespace}.json`];
        if (!load) {
            callback(null, {});
            return;
        }
        load().then(
            (data) => callback(null, data),
            (error) => callback(error, null)
        );
    },
};

function syncDocumentLanguage(language) {
    if (typeof document !== "undefined")
        document.documentElement.lang = resolveLanguage(language);
}

export const i18n = i18next.createInstance();

i18n.use(deferredBackend)
    .use(initReactI18next)
    .init({
        resources: buildResources(),
        partialBundledLanguages: true,
        lng: detectLanguage(),
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...SUPPORTED_LANGUAGES],
        ns: [...BUNDLED_NAMESPACES],
        defaultNS: DEFAULT_NAMESPACE,
        load: "languageOnly",
        returnNull: false,
        initAsync: false,
        interpolation: { escapeValue: false },
        react: { useSuspense: true },
    });

syncDocumentLanguage(i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

/** Loads every namespace for the active and fallback language (used by tests and prefetching). */
export function loadAllNamespaces() {
    return i18n.loadNamespaces([...NAMESPACES]);
}
