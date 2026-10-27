import { describe, expect, it } from "vitest";
import {
    EMAIL_TEMPLATE_LIST,
    EMAIL_TEMPLATES,
    PASSWORD_RESET_VARIANTS,
} from "#constants/emailTemplates.js";
import { buildFrontendLink } from "./emailLinks.mapper.js";
import { listTemplateKeys, renderEmail } from "./templateRenderer.adapter.js";

const link = (path, token) => buildFrontendLink(path, { token });
const SAMPLE = {
    [EMAIL_TEMPLATES.VERIFY_EMAIL]: {
        name: "Asha",
        link: link("/verify-email", "tok1"),
        expiresIn: "24 hours",
    },
    [EMAIL_TEMPLATES.WELCOME]: { name: "Asha", link: link("/onboarding") },
    [EMAIL_TEMPLATES.ALREADY_REGISTERED]: {
        name: "Asha",
        loginLink: link("/login"),
        resetLink: link("/forgot-password"),
    },
    [EMAIL_TEMPLATES.PASSWORD_RESET]: {
        name: "Asha",
        link: link("/reset-password", "tok2"),
        expiresIn: "30 minutes",
        requestedAt: "2026-01-01 10:00 UTC",
    },
    [EMAIL_TEMPLATES.PASSWORD_CHANGED]: {
        name: "Asha",
        changedAt: "2026-01-01 10:00 UTC",
        resetLink: link("/forgot-password"),
    },
    [EMAIL_TEMPLATES.NEW_DEVICE]: {
        name: "Asha",
        device: "Firefox on Windows",
        at: "2026-01-01 10:00 UTC",
        sessionsLink: link("/settings/sessions"),
    },
    [EMAIL_TEMPLATES.EMAIL_CHANGE_CONFIRM]: {
        name: "Asha",
        link: link("/confirm-email-change", "tok3"),
        expiresIn: "24 hours",
    },
    [EMAIL_TEMPLATES.EMAIL_CHANGE_NOTICE]: {
        name: "Asha",
        newEmailMasked: "n***@example.test",
        undoLink: link("/undo-email-change", "tok4"),
        expiresIn: "24 hours",
    },
    [EMAIL_TEMPLATES.INVITE]: {
        inviterName: "Ravi",
        orgName: "Demo Org",
        role: "trainer",
        link: link("/accept-invite", "tok5"),
        expiresIn: "7 days",
    },
    [EMAIL_TEMPLATES.ACCOUNT_LOCKED]: {
        name: "Asha",
        unlockAt: "2026-01-01 10:15 UTC",
        resetLink: link("/forgot-password"),
    },
    [EMAIL_TEMPLATES.ACCOUNT_DELETED]: {
        name: "Asha",
        deletedAt: "2026-01-01 10:00 UTC",
    },
    [EMAIL_TEMPLATES.GOOGLE_LINKED]: {
        name: "Asha",
        at: "2026-01-01 10:00 UTC",
    },
    [EMAIL_TEMPLATES.TOKEN_REUSE_ALERT]: {
        name: "Asha",
        at: "2026-01-01 10:00 UTC",
        resetLink: link("/forgot-password"),
    },
    [EMAIL_TEMPLATES.DEACTIVATION_CONFIRM]: {
        name: "Asha",
        graceEndsAt: "2026-02-01",
        link: link("/login"),
    },
    [EMAIL_TEMPLATES.DELETION_SCHEDULED]: {
        name: "Asha",
        graceEndsAt: "2026-02-01",
        link: link("/login"),
    },
};

const SUBJECTS = {
    [EMAIL_TEMPLATES.VERIFY_EMAIL]: "Confirm your email for SAMARTH AI",
    [EMAIL_TEMPLATES.WELCOME]: "Welcome to SAMARTH AI",
    [EMAIL_TEMPLATES.ALREADY_REGISTERED]:
        "You already have a SAMARTH AI account",
    [EMAIL_TEMPLATES.PASSWORD_RESET]: "Reset your SAMARTH AI password",
    [EMAIL_TEMPLATES.PASSWORD_CHANGED]: "Your SAMARTH AI password was changed",
    [EMAIL_TEMPLATES.NEW_DEVICE]: "New sign-in to your SAMARTH AI account",
    [EMAIL_TEMPLATES.EMAIL_CHANGE_CONFIRM]: "Confirm your new email address",
    [EMAIL_TEMPLATES.EMAIL_CHANGE_NOTICE]:
        "Your SAMARTH AI email address is changing",
    [EMAIL_TEMPLATES.INVITE]: "You are invited to SAMARTH AI",
    [EMAIL_TEMPLATES.ACCOUNT_LOCKED]:
        "Your SAMARTH AI account is temporarily locked",
    [EMAIL_TEMPLATES.ACCOUNT_DELETED]: "Your SAMARTH AI account was deleted",
    [EMAIL_TEMPLATES.GOOGLE_LINKED]: "Google sign-in linked to your account",
};

describe("template registry", () => {
    it("registers every template key constant (doc 20 section 11)", () => {
        expect(listTemplateKeys().sort()).toEqual(
            [...EMAIL_TEMPLATE_LIST].sort()
        );
    });
});

describe.each(EMAIL_TEMPLATE_LIST)("template %s", (templateKey) => {
    const rendered = () =>
        renderEmail({ templateKey, data: SAMPLE[templateKey] });

    it("renders subject, HTML and a text alternative", () => {
        const { subject, html, text, lang } = rendered();
        expect(subject.length).toBeGreaterThan(5);
        expect(html).toMatch(/^<!doctype html>/);
        expect(text.length).toBeGreaterThan(40);
        expect(lang).toBe("en");
        if (SUBJECTS[templateKey]) expect(subject).toBe(SUBJECTS[templateKey]);
    });

    it("is plain (no tracking pixel or script) and carries the prototype disclaimer", () => {
        const { html, text } = rendered();
        expect(html).not.toMatch(/<img|<script|<iframe/i);
        expect(text).toContain("prototype");
    });

    it("keeps every link on FRONTEND_URL and never puts a token in a query string", () => {
        const { text } = rendered();
        for (const url of text.match(/https?:\/\/\S+/g) ?? []) {
            if (url.includes("example.test")) continue;
            expect(url.startsWith("http://localhost:5173")).toBe(true);
            expect(new URL(url).search).toBe("");
        }
    });

    it("refuses a call that is missing a required variable", () => {
        const data = { ...SAMPLE[templateKey] };
        delete data[Object.keys(data)[0]];
        expect(() => renderEmail({ templateKey, data })).toThrowError(
            expect.objectContaining({ isOperational: false })
        );
    });
});

describe("renderEmail", () => {
    it("carries the one-time token in the link fragment", () => {
        const { text } = renderEmail({
            templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL,
            data: SAMPLE[EMAIL_TEMPLATES.VERIFY_EMAIL],
        });
        expect(text).toContain("http://localhost:5173/verify-email#token=tok1");
    });

    it("escapes user-controlled values in HTML", () => {
        const { html, subject } = renderEmail({
            templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL,
            data: {
                ...SAMPLE[EMAIL_TEMPLATES.VERIFY_EMAIL],
                name: '<script>alert("x")</script>',
            },
        });
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(subject).not.toContain("<");
    });

    it("rejects a link that does not point at FRONTEND_URL (Host-header injection guard)", () => {
        const data = {
            ...SAMPLE[EMAIL_TEMPLATES.VERIFY_EMAIL],
            link: "https://evil.example/verify-email#token=stolen",
        };
        expect(() =>
            renderEmail({ templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL, data })
        ).toThrow(/FRONTEND_URL/);
    });

    it("falls back to English for a language without a translation", () => {
        expect(
            renderEmail({
                templateKey: EMAIL_TEMPLATES.WELCOME,
                data: SAMPLE[EMAIL_TEMPLATES.WELCOME],
                lang: "hi",
            }).lang
        ).toBe("en");
    });

    it("rejects unknown templates and blank variables as programmer errors", () => {
        expect(() =>
            renderEmail({ templateKey: "nope", data: {} })
        ).toThrowError(
            expect.objectContaining({ statusCode: 500, isOperational: false })
        );
        expect(() =>
            renderEmail({
                templateKey: EMAIL_TEMPLATES.WELCOME,
                data: { name: "  ", link: link("/x") },
            })
        ).toThrow(/needs "name"/);
    });

    it("adds the Google-only and unverified lines to the password-reset mail (AUTH-48)", () => {
        const base = SAMPLE[EMAIL_TEMPLATES.PASSWORD_RESET];
        const google = renderEmail({
            templateKey: EMAIL_TEMPLATES.PASSWORD_RESET,
            data: { ...base, variant: PASSWORD_RESET_VARIANTS.GOOGLE_ONLY },
        });
        const unverified = renderEmail({
            templateKey: EMAIL_TEMPLATES.PASSWORD_RESET,
            data: { ...base, variant: PASSWORD_RESET_VARIANTS.UNVERIFIED },
        });
        const active = renderEmail({
            templateKey: EMAIL_TEMPLATES.PASSWORD_RESET,
            data: { ...base, variant: PASSWORD_RESET_VARIANTS.ACTIVE },
        });
        expect(google.text).toContain("signs in with Google");
        expect(unverified.text).toContain("confirms your email");
        expect(active.text).not.toContain("Google");
        expect(active.text).toContain("30 minutes");
    });

    it("the setup variant tells a new platform admin to choose a first password and where to get a new link", () => {
        const rendered = renderEmail({
            templateKey: EMAIL_TEMPLATES.PASSWORD_RESET,
            data: {
                ...SAMPLE[EMAIL_TEMPLATES.PASSWORD_RESET],
                variant: PASSWORD_RESET_VARIANTS.SETUP,
            },
        });
        expect(rendered.subject).toBe(
            "Set your SAMARTH AI platform admin password"
        );
        expect(rendered.text).toContain("platform admin account was created");
        expect(rendered.text).toContain("Forgot password");
        expect(rendered.text).toContain("30 minutes");
        expect(rendered.text).not.toContain("request to reset");
        expect(rendered.html).not.toMatch(/<img/i);
    });
});
