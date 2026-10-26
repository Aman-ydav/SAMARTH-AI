import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
    it("joins truthy class names and drops falsy ones", () => {
        expect(cn("a", false, null, undefined, "b")).toBe("a b");
    });

    it("lets the later conflicting Tailwind class win", () => {
        expect(cn("px-2", "px-4")).toBe("px-4");
        expect(cn("bg-primary", "bg-secondary")).toBe("bg-secondary");
    });

    it("keeps a type-* scale utility next to a colour utility (ANIM-98 regression)", () => {
        expect(cn("type-h2", "text-muted-foreground")).toBe(
            "type-h2 text-muted-foreground"
        );
    });

    it("accepts arrays and objects", () => {
        expect(cn(["a", { b: true, c: false }])).toBe("a b");
    });
});
