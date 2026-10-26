import { describe, expect, it } from "vitest";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import {
    assertEmailDomainAllowed,
    isEmailDomainAllowed,
} from "./domainPolicy.service.js";

const open = makeTestEnv();
const restricted = makeTestEnv({ ALLOWED_EMAIL_DOMAINS: "gov.in, nic.in" });

describe("domain policy (AUTH-28)", () => {
    it("allows everything when no domains are configured", () => {
        expect(isEmailDomainAllowed("anyone@anything.example", open)).toBe(
            true
        );
        expect(() =>
            assertEmailDomainAllowed("anyone@anything.example", open)
        ).not.toThrow();
    });

    it.each([
        ["a@gov.in", true],
        ["a@NIC.in", true],
        ["a@mospi.gov.in", true],
        ["a@deep.sub.nic.in", true],
        ["a@evilgov.in", false],
        ["a@gov.in.evil.test", false],
        ["a@gmail.test", false],
        ["  a@gov.in ", true],
    ])("%s allowed=%s", (email, allowed) => {
        expect(isEmailDomainAllowed(email, restricted)).toBe(allowed);
    });

    it("throws DOMAIN_NOT_ALLOWED naming the field, without echoing the address", () => {
        try {
            assertEmailDomainAllowed("a@gmail.test", restricted, "newEmail");
            throw new Error("should have thrown");
        } catch (error) {
            expect(error).toMatchObject({
                statusCode: 403,
                code: "DOMAIN_NOT_ALLOWED",
            });
            expect(error.errors).toEqual([
                expect.objectContaining({
                    field: "newEmail",
                    code: "DOMAIN_NOT_ALLOWED",
                }),
            ]);
            expect(JSON.stringify(error.errors)).not.toContain("gmail");
        }
    });
});
