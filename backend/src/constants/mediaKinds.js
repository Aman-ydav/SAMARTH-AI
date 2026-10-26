/** Cloudinary folder kinds (MEDIA-04). Limits and allowed types live in integrations/cloudinary/mediaPolicy.mapper.js. */
export const MEDIA_KINDS = Object.freeze({
    AVATARS: "avatars",
    MARKETING: "marketing",
    LEARNING_CONTENT: "learning-content",
    CERTIFICATES: "certificates",
    TEMP: "temp",
});

export const MEDIA_KIND_LIST = Object.freeze(Object.values(MEDIA_KINDS));

export const MEDIA_RESOURCE_TYPES = Object.freeze({
    IMAGE: "image",
    VIDEO: "video",
    RAW: "raw",
});
export const MEDIA_RESOURCE_TYPE_LIST = Object.freeze(
    Object.values(MEDIA_RESOURCE_TYPES)
);

export const MEDIA_DELIVERY_TYPES = Object.freeze({
    PUBLIC: "public",
    AUTHENTICATED: "authenticated",
});
export const MEDIA_DELIVERY_TYPE_LIST = Object.freeze(
    Object.values(MEDIA_DELIVERY_TYPES)
);
