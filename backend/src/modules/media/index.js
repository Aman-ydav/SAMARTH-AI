import { authenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createMediaRouter } from "./media.routes.js";

/** The media routes with the real guards, ready for `api.use("/", mediaRouter)` in `mountModules` (R41). */
export const mediaRouter = createMediaRouter({ authenticate, authorize });

export { createMediaRouter } from "./media.routes.js";
export {
    confirmMediaUpload,
    requestMediaSignature,
    toPublicMedia,
} from "./media.service.js";
export {
    deleteMedia,
    findReadyMedia,
    getMediaAccessUrl,
} from "./mediaAccess.service.js";
export { removeAvatar, setAvatar } from "./mediaAvatar.service.js";
export { retireMedia } from "./mediaCleanup.service.js";
export { sweepMedia } from "./mediaSweep.service.js";
export { handleMediaWebhook } from "./mediaWebhook.service.js";
