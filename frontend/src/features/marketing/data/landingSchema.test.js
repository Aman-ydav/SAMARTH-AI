import { describe, expect, it } from "vitest";
import { buildLandingJsonLd } from "@/features/marketing/data/landingSchema";

const INPUT = {
    siteUrl: "https://app.example.test",
    name: "SAMARTH AI",
    description: "A prototype platform.",
    tagline: "Smart Competency Intelligence for Official Statistics",
    faqItems: [{ q: "Is it official?", a: "No." }],
};

describe("buildLandingJsonLd", () => {
    const graph = buildLandingJsonLd(INPUT)["@graph"];
    const byType = (type) => graph.find((node) => node["@type"] === type);

    it("describes the site, the software and the FAQ", () => {
        expect(graph.map((node) => node["@type"])).toEqual([
            "WebSite",
            "SoftwareApplication",
            "FAQPage",
        ]);
    });

    it("marks the software as a free educational web application", () => {
        expect(byType("SoftwareApplication")).toMatchObject({
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            isAccessibleForFree: true,
            offers: { price: "0", priceCurrency: "INR" },
        });
    });

    it("never invents ratings or reviews", () => {
        const text = JSON.stringify(graph);
        expect(text).not.toMatch(/aggregateRating|ratingValue|review/i);
    });

    it("turns FAQ items into questions and accepted answers", () => {
        expect(byType("FAQPage").mainEntity).toEqual([
            {
                "@type": "Question",
                name: "Is it official?",
                acceptedAnswer: { "@type": "Answer", text: "No." },
            },
        ]);
    });

    it("omits FAQPage when there are no items", () => {
        const types = buildLandingJsonLd({ ...INPUT, faqItems: [] })[
            "@graph"
        ].map((node) => node["@type"]);
        expect(types).not.toContain("FAQPage");
    });
});
