import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

describe("useDocumentTitle", () => {
    it("sets the title and follows changes", () => {
        const { rerender } = renderHook(
            ({ title }) => useDocumentTitle(title),
            { initialProps: { title: "First | SAMARTH AI" } }
        );
        expect(document.title).toBe("First | SAMARTH AI");
        rerender({ title: "Second | SAMARTH AI" });
        expect(document.title).toBe("Second | SAMARTH AI");
    });

    it("ignores empty titles", () => {
        document.title = "Keep me";
        renderHook(() => useDocumentTitle(""));
        expect(document.title).toBe("Keep me");
    });
});
