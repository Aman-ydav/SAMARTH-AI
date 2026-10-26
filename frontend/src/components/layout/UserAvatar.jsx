import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildImageUrl } from "@/components/media/CloudinaryImage";
import { env } from "@/lib/env";
import { safeExternalUrl } from "@/lib/safeUrl";

const AVATAR_PX = 256;

const segmenter =
    typeof Intl !== "undefined" && Intl.Segmenter
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null;

/** First grapheme of a string (keeps Devanagari conjuncts and emoji whole). */
function firstGrapheme(text) {
    if (segmenter) {
        for (const part of segmenter.segment(text))
            return part.segment.toUpperCase();
    }
    return Array.from(text)[0]?.toUpperCase() ?? "";
}

/** Up to two initials from the display name, then the email, then a neutral mark (EDGE-44: nothing is required). */
function getInitials(user) {
    const name = typeof user?.name === "string" ? user.name.trim() : "";
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length > 1)
        return `${firstGrapheme(words[0])}${firstGrapheme(words[words.length - 1])}`;
    if (words.length === 1) return firstGrapheme(words[0]);
    const email = typeof user?.email === "string" ? user.email.trim() : "";
    return email ? firstGrapheme(email) : "?";
}

/**
 * The API sends `{ publicId, version }` (doc 08 section 3): the URL is built at render time from the public id (MEDIA-14).
 * A plain string or `{ url }` is accepted too; only https URLs are rendered (FE-103).
 */
function avatarSource(avatar) {
    if (
        typeof avatar?.publicId === "string" &&
        avatar.publicId &&
        env.cloudinaryCloudName
    )
        return buildImageUrl(
            env.cloudinaryCloudName,
            avatar.publicId,
            AVATAR_PX
        );
    const raw = typeof avatar === "string" ? avatar : avatar?.url;
    return safeExternalUrl(raw)?.startsWith("https:") ? raw : undefined;
}

/** Profile picture with an initials fallback. Decorative: the person's name is always shown next to it or in a label. */
export function UserAvatar({ user, size = "default", className }) {
    const source = avatarSource(user?.avatar);
    return (
        <Avatar size={size} className={className}>
            {source ? <AvatarImage src={source} alt="" /> : null}
            <AvatarFallback aria-hidden="true">
                {getInitials(user)}
            </AvatarFallback>
        </Avatar>
    );
}
