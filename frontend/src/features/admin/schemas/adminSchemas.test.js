import { describe, expect, it } from "vitest";
import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    SEARCH_MAX_LENGTH,
    changeRoleSchema,
    inviteSchemaFor,
    makeInviteSchema,
    parseInvitesQuery,
    parseUsersQuery,
    queryKeyOf,
} from "@/features/admin/schemas/adminSchemas";

const params = (text) => new URLSearchParams(text);
const messages = (result) => result.error.issues.map((issue) => issue.message);

describe("inviteSchemaFor", () => {
    it("normalises the email like the API (trim, lowercase) and accepts a grantable role", () => {
        const result = inviteSchemaFor("admin").safeParse({
            email: "  Meera.Nair@Example.TEST ",
            role: "trainer",
        });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            email: "meera.nair@example.test",
            role: "trainer",
        });
    });

    it("lets a platform admin grant trainer and admin but an admin trainer only", () => {
        expect(
            inviteSchemaFor("superadmin").safeParse({
                email: "a@example.test",
                role: "admin",
            }).success
        ).toBe(true);
        const refused = inviteSchemaFor("admin").safeParse({
            email: "a@example.test",
            role: "admin",
        });
        expect(refused.success).toBe(false);
        expect(messages(refused)).toEqual(["admin:invites.form.roleRequired"]);
    });

    it.each(["superadmin", "learner", "", "root"])(
        "never accepts the role %j for anyone",
        (role) => {
            for (const actor of ["admin", "superadmin"])
                expect(
                    inviteSchemaFor(actor).safeParse({
                        email: "a@example.test",
                        role,
                    }).success
                ).toBe(false);
        }
    );

    it("grants nothing to roles that cannot invite", () => {
        for (const actor of ["learner", "trainer", undefined])
            expect(
                inviteSchemaFor(actor).safeParse({
                    email: "a@example.test",
                    role: "trainer",
                }).success
            ).toBe(false);
    });

    it.each([
        ["", "validation:email.required"],
        ["   ", "validation:email.required"],
        ["not-an-email", "validation:email.invalid"],
        [`${"a".repeat(250)}@example.test`, "validation:email.tooLong"],
    ])("rejects the email %j with a key, not English text", (email, key) => {
        const result = inviteSchemaFor("admin").safeParse({
            email,
            role: "trainer",
        });
        expect(result.success).toBe(false);
        expect(messages(result)).toContain(key);
    });

    it("asks for a role when none is given and refuses unknown fields' role type", () => {
        const missing = inviteSchemaFor("admin").safeParse({
            email: "a@example.test",
        });
        expect(missing.success).toBe(false);
        expect(messages(missing)).toEqual(["admin:invites.form.roleRequired"]);
    });

    it("can be built for any grant list", () => {
        const schema = makeInviteSchema(["trainer"]);
        expect(
            schema.safeParse({ email: "a@example.test", role: "trainer" })
                .success
        ).toBe(true);
    });
});

describe("changeRoleSchema", () => {
    it.each(["learner", "trainer", "admin"])("accepts %s", (role) => {
        expect(changeRoleSchema.safeParse({ role }).success).toBe(true);
    });

    it.each(["superadmin", "", undefined, "owner"])(
        "refuses %j with the dialog's own key",
        (role) => {
            const result = changeRoleSchema.safeParse({ role });
            expect(result.success).toBe(false);
            expect(messages(result)).toEqual([
                "admin:users.roleDialog.roleRequired",
            ]);
        }
    );
});

describe("parseInvitesQuery (URL input is hostile, FE-72)", () => {
    it("defaults an empty URL", () => {
        expect(parseInvitesQuery(params(""))).toEqual({
            page: 1,
            limit: DEFAULT_PAGE_SIZE,
            status: undefined,
        });
    });

    it("keeps valid values", () => {
        expect(
            parseInvitesQuery(params("page=3&limit=50&status=revoked"))
        ).toEqual({ page: 3, limit: 50, status: "revoked" });
    });

    it.each([
        ["page=0", 1],
        ["page=-4", 1],
        ["page=abc", 1],
        ["page=1.5", 1],
        ["page=999999999", 1],
    ])("falls back to page 1 for %s", (text, page) => {
        expect(parseInvitesQuery(params(text)).page).toBe(page);
    });

    it("clamps the limit to 1..100 by falling back to the default", () => {
        expect(parseInvitesQuery(params("limit=100")).limit).toBe(
            MAX_PAGE_SIZE
        );
        expect(parseInvitesQuery(params("limit=101")).limit).toBe(
            DEFAULT_PAGE_SIZE
        );
        expect(parseInvitesQuery(params("limit=0")).limit).toBe(
            DEFAULT_PAGE_SIZE
        );
        expect(parseInvitesQuery(params("limit=x")).limit).toBe(
            DEFAULT_PAGE_SIZE
        );
    });

    it("drops an unknown status instead of passing it on", () => {
        expect(
            parseInvitesQuery(params("status=%24ne&role=admin")).status
        ).toBeUndefined();
    });

    it("never carries keys the API does not know", () => {
        expect(
            Object.keys(parseInvitesQuery(params("evil=1&orgId=x&role=a")))
        ).toEqual(["page", "limit"]);
    });

    it("treats a non-URLSearchParams input as empty", () => {
        expect(parseInvitesQuery(undefined)).toMatchObject({ page: 1 });
    });
});

describe("parseUsersQuery", () => {
    it("reads search, role and status", () => {
        expect(
            parseUsersQuery(params("q=ra&role=trainer&status=suspended&page=2"))
        ).toEqual({
            page: 2,
            limit: DEFAULT_PAGE_SIZE,
            q: "ra",
            role: "trainer",
            status: "suspended",
        });
    });

    it("trims the search and caps it at 64 characters", () => {
        expect(parseUsersQuery(params("q=%20%20ra%20")).q).toBe("ra");
        expect(parseUsersQuery(params(`q=${"a".repeat(200)}`)).q).toHaveLength(
            SEARCH_MAX_LENGTH
        );
    });

    it("drops a search with control characters, and unknown role or status", () => {
        const query = parseUsersQuery(
            params("q=a%00b&role=root&status=banned")
        );
        expect(query.q).toBeUndefined();
        expect(query.role).toBeUndefined();
        expect(query.status).toBeUndefined();
    });

    it("accepts every API role and status as a filter value", () => {
        expect(parseUsersQuery(params("role=superadmin")).role).toBe(
            "superadmin"
        );
        expect(parseUsersQuery(params("status=pending_deletion")).status).toBe(
            "pending_deletion"
        );
    });
});

describe("queryKeyOf", () => {
    it("is stable regardless of key order and distinguishes values", () => {
        expect(queryKeyOf({ a: 1, b: 2 })).toBe(queryKeyOf({ b: 2, a: 1 }));
        expect(queryKeyOf({ page: 1 })).not.toBe(queryKeyOf({ page: 2 }));
        expect(queryKeyOf({ page: 1, status: undefined })).toBe(
            queryKeyOf({ page: 1, status: null })
        );
    });
});
