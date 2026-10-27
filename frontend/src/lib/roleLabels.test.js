import { describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { ROLE_LABEL_KEYS, roleLabelKey } from "@/lib/roleLabels";

describe("roleLabels", () => {
    it("has one key per role and falls back to the learner label for unknown roles", () => {
        expect(Object.keys(ROLE_LABEL_KEYS)).toEqual([
            "learner",
            "trainer",
            "admin",
            "superadmin",
        ]);
        expect(roleLabelKey("trainer")).toBe("common:role.trainer");
        expect(roleLabelKey("root")).toBe("common:role.learner");
        expect(roleLabelKey(undefined)).toBe("common:role.learner");
        expect(roleLabelKey("toString")).toBe("common:role.learner");
    });

    it("labels superadmin as Platform admin in English and Hindi, never as superadmin", async () => {
        const key = roleLabelKey("superadmin");
        expect(i18n.t(key, { lng: "en" })).toBe("Platform admin");
        await i18n.loadLanguages("hi");
        expect(i18n.t(key, { lng: "hi" })).toBe("प्लेटफ़ॉर्म प्रशासक");
        for (const lng of ["en", "hi"])
            for (const role of Object.keys(ROLE_LABEL_KEYS))
                expect(i18n.t(roleLabelKey(role), { lng })).not.toMatch(
                    /superadmin/i
                );
    });
});
