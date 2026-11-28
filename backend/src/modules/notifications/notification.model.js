import mongoose from "mongoose";
import { NOTIFICATION_TYPE_LIST } from "#constants/notificationTypes.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";
import {
    NOTIFICATION_LIMITS,
    NOTIFICATION_LINK_PATTERN,
} from "./notifications.constants.js";

const notificationSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "NOTIFICATION_ORG_REQUIRED"],
            immutable: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "NOTIFICATION_USER_REQUIRED"],
            immutable: true,
        },
        // The client renders the text from the type (en and hi), so no title or body is stored here.
        type: {
            type: String,
            required: [true, "NOTIFICATION_TYPE_REQUIRED"],
            trim: true,
            lowercase: true,
            enum: NOTIFICATION_TYPE_LIST,
            immutable: true,
        },
        // Short, non-personal label of what the notification is about (for example a job type). Interpolated by the client.
        subject: {
            type: String,
            trim: true,
            maxlength: NOTIFICATION_LIMITS.subjectMaxLength,
            default: undefined,
        },
        // Id of the thing it refers to (for example a job id); lets the client deep-link without a second lookup.
        refId: {
            type: String,
            trim: true,
            maxlength: NOTIFICATION_LIMITS.refIdMaxLength,
            default: undefined,
        },
        // In-app path to open on click (never a full URL).
        link: {
            type: String,
            trim: true,
            maxlength: NOTIFICATION_LIMITS.linkMaxLength,
            match: NOTIFICATION_LINK_PATTERN,
            default: undefined,
        },
        // Same key for the same event means one notification, even if the event is delivered twice (doc 22 section 8).
        dedupeKey: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: NOTIFICATION_LIMITS.dedupeKeyMaxLength,
            immutable: true,
            default: undefined,
        },
        readAt: { type: Date, default: null },
        // TTL clock (doc 22 section 6: 90 days). Reads never rely on the TTL sweep running on time (DB-24).
        expiresAt: {
            type: Date,
            required: [true, "NOTIFICATION_EXPIRES_REQUIRED"],
        },
    },
    { timestamps: true, collection: "notifications" }
);

notificationSchema.plugin(toJsonPlugin);

// serves: the unread list and the bell's unread count (doc 22 section 6)
notificationSchema.index(
    { userId: 1, readAt: 1, createdAt: -1 },
    { name: "notifications_userId_readAt_createdAt" }
);
// serves: the full list of a user, newest first, and the per-user cap trim
notificationSchema.index(
    { userId: 1, createdAt: -1 },
    { name: "notifications_userId_createdAt" }
);
// serves: de-duplication on create; unique only where a key exists (DB-22)
notificationSchema.index(
    { userId: 1, dedupeKey: 1 },
    {
        name: "notifications_userId_dedupeKey_uq",
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: "string" } },
    }
);
// serves: removal of notifications 90 days after they were created
notificationSchema.index(
    { expiresAt: 1 },
    { name: "notifications_expiresAt_ttl", expireAfterSeconds: 0 }
);

export const Notification = mongoose.model("Notification", notificationSchema);
