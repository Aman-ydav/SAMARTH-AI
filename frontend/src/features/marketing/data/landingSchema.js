/*
 * JSON-LD for the landing page (docs/23 SEO block): WebSite, SoftwareApplication and FAQPage in one graph.
 * No ratings, reviews or prices other than the honest "free prototype": nothing here may be invented.
 */

export function buildLandingJsonLd({
    siteUrl,
    name,
    description,
    tagline,
    faqItems,
}) {
    const graph = [
        {
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            url: `${siteUrl}/`,
            name,
            description: tagline,
        },
        {
            "@type": "SoftwareApplication",
            "@id": `${siteUrl}/#software`,
            name,
            description,
            url: `${siteUrl}/`,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        },
    ];
    if (faqItems?.length) {
        graph.push({
            "@type": "FAQPage",
            mainEntity: faqItems.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
        });
    }
    return { "@context": "https://schema.org", "@graph": graph };
}
