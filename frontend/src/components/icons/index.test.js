import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as icons from "@/components/icons";

const registrySource = fs.readFileSync(
    path.resolve(import.meta.dirname, "index.js"),
    "utf8"
);

// Every icon the shadcn components, rule 01 (UI-33) and doc 23 (sections 2.3 and 6.2) rely on.
const REQUIRED = [
    "CheckIcon",
    "CheckCircleIcon",
    "ChevronDownIcon",
    "ChevronUpIcon",
    "ChevronLeftIcon",
    "ChevronRightIcon",
    "CloseIcon",
    "PanelLeftIcon",
    "MoreHorizontalIcon",
    "SpinnerIcon",
    "InfoIcon",
    "WarningIcon",
    "ErrorIcon",
    "MenuIcon",
    "SearchIcon",
    "SunIcon",
    "MoonIcon",
    "TranslateIcon",
    "LanguageIcon",
    "BellIcon",
    "UserIcon",
    "UsersIcon",
    "SettingsIcon",
    "LogoutIcon",
    "HomeIcon",
    "DashboardIcon",
    "BookIcon",
    "ChartIcon",
    "CertificateIcon",
    "ShieldIcon",
    "LockIcon",
    "KeyIcon",
    "MailIcon",
    "EyeIcon",
    "EyeOffIcon",
    "GoogleIcon",
    "ExternalLinkIcon",
    "UploadIcon",
    "TrashIcon",
    "EditIcon",
    "PlusIcon",
    "ArrowRightIcon",
    "BranchIcon",
    "HistoryIcon",
];

describe("icon registry", () => {
    it("exports every required icon as a renderable component", () => {
        for (const name of REQUIRED) {
            expect(icons[name], name).toBeTypeOf("function");
        }
    });

    it("names every export with the Icon suffix", () => {
        for (const name of Object.keys(icons)) {
            expect(name).toMatch(/^[A-Z][A-Za-z0-9]*Icon$/);
        }
    });

    it("keeps the exports alphabetical by alias", () => {
        const names = Object.keys(icons);
        expect(names).toEqual(
            [...names].sort((a, b) => a.localeCompare(b, "en"))
        );
    });

    it("imports only filled glyphs from the four allowed react-icons subsets", () => {
        const packages = [
            ...registrySource.matchAll(/from "(react-icons\/[a-z0-9]+)"/g),
        ].map((m) => m[1]);
        expect(packages.length).toBeGreaterThan(0);
        for (const pkg of packages)
            expect([
                "react-icons/ri",
                "react-icons/md",
                "react-icons/fa6",
                "react-icons/fc",
            ]).toContain(pkg);
        expect(registrySource).not.toMatch(
            /Outline|Line\b|FaReg|TwoTone|Sharp/
        );
        const remix = [...registrySource.matchAll(/\bRi[A-Za-z0-9]+/g)].map(
            (m) => m[0]
        );
        for (const name of remix)
            expect(name.endsWith("Fill"), name).toBe(true);
    });
});
