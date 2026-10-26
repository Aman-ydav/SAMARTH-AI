import { useTranslation } from "react-i18next";
import { getMediaSlot } from "@/assets/mediaManifest";
import { buildImageUrl } from "@/components/media/CloudinaryImage";
import { Seo } from "@/features/marketing/components/Seo";
import { buildLandingJsonLd } from "@/features/marketing/data/landingSchema";
import {
    SITE_CONFIG,
    absoluteUrl,
    getSiteUrl,
} from "@/features/marketing/data/siteConfig";
import { env } from "@/lib/env";

const LOCALES = { en: "en_IN", hi: "hi_IN" };
const OG_WIDTH = 1200;

/** Head tags and JSON-LD for `/` (docs/23 SEO block). No ratings or invented claims. */
export function LandingSeo() {
    const { t, i18n } = useTranslation(["landing", "common"]);
    const language = i18n.language === "hi" ? "hi" : "en";
    const slot = getMediaSlot(SITE_CONFIG.ogImageSlot);
    const ogId = slot?.publicId;
    const image =
        env.cloudinaryCloudName && ogId
            ? buildImageUrl(env.cloudinaryCloudName, ogId, OG_WIDTH)
            : undefined;
    const faqItems = t("landing:faq.items", { returnObjects: true });

    const jsonLd = buildLandingJsonLd({
        siteUrl: getSiteUrl(),
        name: t("landing:seo.siteName"),
        description: t("landing:seo.softwareDescription"),
        tagline: t("common:brand.tagline"),
        faqItems: Array.isArray(faqItems) ? faqItems : [],
    });

    return (
        <Seo
            title={t("landing:seo.title")}
            description={t("landing:seo.description")}
            url={absoluteUrl("/")}
            image={image}
            imageAlt={image ? t("landing:media.ogDefault") : undefined}
            locale={LOCALES[language]}
            alternateLocale={LOCALES[language === "en" ? "hi" : "en"]}
            siteName={t("landing:seo.siteName")}
            twitterCard={SITE_CONFIG.twitterCard}
            jsonLd={jsonLd}
        />
    );
}
