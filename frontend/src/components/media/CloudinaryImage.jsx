import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getMediaSlot } from "@/assets/mediaManifest";
import { ErrorWarningIcon } from "@/components/icons";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

/* One small, fixed set of widths keeps the transformation count low on the free plan (MEDIA-40). */
const WIDTHS = [320, 480, 640, 800, 1024, 1280, 1600];
const DEFAULT_RATIO = "16 / 9";

function encodeId(publicId) {
    return publicId.split("/").map(encodeURIComponent).join("/");
}

/**
 * Delivery URL for an image: f_auto,q_auto, optionally limited to a width. The only place besides
 * CloudinaryVideo that knows the delivery host (MEDIA-20).
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared URL builder, also used by CloudinaryVideo and Seo
export function buildImageUrl(cloudName, publicId, width) {
    const size = width ? `,c_limit,w_${width}` : "";
    return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto${size}/${encodeId(publicId)}`;
}

function widthsFor(maxWidth) {
    if (!maxWidth) return WIDTHS;
    const fitting = WIDTHS.filter((width) => width < maxWidth);
    return [...fitting, maxWidth];
}

function Frame({ className, ratio, children, ...props }) {
    return (
        <div
            style={{ "--ratio": ratio }}
            className={cn(
                "relative aspect-(--ratio) w-full overflow-clip rounded-lg bg-muted",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * Cloudinary still image (MEDIA-21). Pass a manifest `slot` (alt comes from i18n) or a raw `publicId`.
 * Builds f_auto,q_auto URLs with a responsive srcset, reserves space with an aspect-ratio box, lazy-loads unless
 * `priority`, and shows a flat token-coloured placeholder when the cloud name or asset is missing or the image
 * fails. `alt` is mandatory unless `decorative`. `optional` renders nothing while the slot is still a placeholder.
 */
export function CloudinaryImage({
    slot,
    publicId,
    alt,
    decorative,
    width,
    height,
    sizes = "100vw",
    priority = false,
    optional = false,
    className,
}) {
    const entry = slot ? getMediaSlot(slot) : null;
    const namespace = entry?.altKey?.split(":")[0] ?? "common";
    const { t } = useTranslation(namespace);
    const [failed, setFailed] = useState(false);

    const id = publicId ?? entry?.publicId ?? null;
    const intrinsicWidth = width ?? entry?.width;
    const intrinsicHeight = height ?? entry?.height;
    const isDecorative = decorative ?? entry?.decorative ?? false;
    const text = alt ?? (entry?.altKey ? t(entry.altKey) : "");
    const missingAlt = !isDecorative && !text;
    const cloudName = env.cloudinaryCloudName;
    const ratio =
        intrinsicWidth && intrinsicHeight
            ? `${intrinsicWidth} / ${intrinsicHeight}`
            : DEFAULT_RATIO;

    useEffect(() => {
        if (missingAlt)
            logger.warn("CloudinaryImage rendered without alt text", {
                name: slot ?? publicId ?? "unknown",
            });
    }, [missingAlt, slot, publicId]);

    const a11y =
        isDecorative || missingAlt
            ? { "aria-hidden": "true" }
            : { role: "img", "aria-label": text };

    if (!cloudName || !id) {
        if (optional) return null;
        return (
            <Frame
                ratio={ratio}
                className={className}
                data-placeholder=""
                {...a11y}
            >
                {env.isDev && slot ? (
                    <span className="absolute inset-0 grid place-items-center font-mono type-caption text-muted-foreground">
                        {slot}
                    </span>
                ) : null}
            </Frame>
        );
    }

    if (failed) {
        return (
            <Frame ratio={ratio} className={className} data-error="" {...a11y}>
                <ErrorWarningIcon
                    aria-hidden="true"
                    className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
                />
            </Frame>
        );
    }

    const srcSet = widthsFor(intrinsicWidth)
        .map((size) => `${buildImageUrl(cloudName, id, size)} ${size}w`)
        .join(", ");
    const fallbackWidth = widthsFor(intrinsicWidth).at(-1);

    return (
        <Frame ratio={ratio} className={className}>
            <img
                src={buildImageUrl(cloudName, id, fallbackWidth)}
                srcSet={srcSet}
                sizes={sizes}
                alt={isDecorative || missingAlt ? "" : text}
                width={intrinsicWidth}
                height={intrinsicHeight}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                onError={() => setFailed(true)}
                className="absolute inset-0 size-full object-cover"
            />
        </Frame>
    );
}
