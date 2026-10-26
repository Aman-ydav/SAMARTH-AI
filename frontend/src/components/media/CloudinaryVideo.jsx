import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getMediaSlot } from "@/assets/mediaManifest";
import { buildImageUrl } from "@/components/media/CloudinaryImage";
import { ErrorWarningIcon } from "@/components/icons";
import { isSaveDataEnabled, useMotionTier } from "@/hooks/useMotionTier";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

const DEFAULT_RATIO = "16 / 9";
const POSTER_WIDTH = 1280;

function buildVideoUrl(cloudName, publicId) {
    const id = publicId.split("/").map(encodeURIComponent).join("/");
    return `https://res.cloudinary.com/${cloudName}/video/upload/f_auto,q_auto/${id}`;
}

function Box({ ratio, className, children, ...props }) {
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
 * Cloudinary video (MEDIA-22, MEDIA-23). Requires a `poster` (an image publicId) and an aspect ratio
 * (`width` and `height`). `preload="none"` except `hero`. Content videos show controls and take an optional
 * `captions` track `{ src, srcLang, label }`. `decorativeLoop` makes a muted, looping, `playsinline` video that
 * never starts under reduced motion, Save-Data or in a hidden tab (the poster shows instead).
 * `label` names a content video; on error the poster and a message are shown.
 */
export function CloudinaryVideo({
    slot,
    publicId,
    poster,
    width,
    height,
    label,
    captions,
    controls = true,
    decorativeLoop = false,
    hero = false,
    className,
}) {
    const entry = slot ? getMediaSlot(slot) : null;
    const { t } = useTranslation("landing");
    const tier = useMotionTier();
    const videoRef = useRef(null);
    const [failed, setFailed] = useState(false);

    const id = publicId ?? entry?.publicId ?? null;
    const posterEntry = entry?.posterSlot
        ? getMediaSlot(entry.posterSlot)
        : null;
    const posterId = poster ?? posterEntry?.publicId ?? null;
    const w = width ?? entry?.width;
    const h = height ?? entry?.height;
    const ratio = w && h ? `${w} / ${h}` : DEFAULT_RATIO;
    const cloudName = env.cloudinaryCloudName;
    const posterUrl =
        cloudName && posterId
            ? buildImageUrl(cloudName, posterId, POSTER_WIDTH)
            : undefined;
    const mayAutoplay =
        decorativeLoop && tier !== "reduced" && !isSaveDataEnabled();
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !mayAutoplay) return undefined;
        const sync = () => {
            if (document.visibilityState === "visible") {
                video.play().catch(() => setBlocked(true));
            } else {
                video.pause();
            }
        };
        sync();
        document.addEventListener("visibilitychange", sync);
        return () => document.removeEventListener("visibilitychange", sync);
    }, [mayAutoplay, id]);

    if (!cloudName || !id) {
        return (
            <Box
                ratio={ratio}
                className={className}
                data-placeholder=""
                aria-hidden="true"
            />
        );
    }

    if (failed) {
        return (
            <Box ratio={ratio} className={className} data-error="">
                {posterUrl ? (
                    <img
                        src={posterUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : null}
                <p className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-card p-3 type-small text-foreground">
                    <ErrorWarningIcon
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                    {t("media.videoError")}
                </p>
            </Box>
        );
    }

    const showControls = decorativeLoop ? blocked : controls;

    return (
        <Box ratio={ratio} className={className}>
            <video
                ref={videoRef}
                src={buildVideoUrl(cloudName, id)}
                poster={posterUrl}
                width={w}
                height={h}
                preload={hero ? "metadata" : "none"}
                controls={showControls}
                muted={decorativeLoop}
                loop={decorativeLoop}
                playsInline
                aria-label={decorativeLoop ? undefined : label}
                aria-hidden={decorativeLoop ? "true" : undefined}
                tabIndex={decorativeLoop && !blocked ? -1 : undefined}
                onError={() => setFailed(true)}
                className="absolute inset-0 size-full object-cover"
            >
                {captions ? (
                    <track
                        kind="captions"
                        src={captions.src}
                        srcLang={captions.srcLang}
                        label={captions.label}
                    />
                ) : null}
            </video>
        </Box>
    );
}
