import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

export const LOGIN_ATTEMPT_KINDS = Object.freeze({ EMAIL: "email", IP: "ip" });
const TTL_SECONDS = 86_400;

// Shadow counters (AUTH-36): kept for unknown emails too, keyed by an HMAC so no raw email or IP is stored (R9, R37).
const loginAttemptSchema = new mongoose.Schema(
    {
        keyHash: {
            type: String,
            required: [true, "KEY_HASH_REQUIRED"],
            trim: true,
            lowercase: true,
            minlength: 64,
            maxlength: 64,
        },
        kind: {
            type: String,
            required: [true, "KIND_REQUIRED"],
            enum: Object.values(LOGIN_ATTEMPT_KINDS),
        },
        count: { type: Number, default: 0, min: 0, validate: Number.isInteger },
        firstAttemptAt: {
            type: Date,
            required: [true, "FIRST_ATTEMPT_REQUIRED"],
        },
        lastAttemptAt: {
            type: Date,
            required: [true, "LAST_ATTEMPT_REQUIRED"],
        },
        lockUntil: { type: Date, default: null },
    },
    { timestamps: true, collection: "loginAttempts" }
);

// serves: every login, which reads and increments the counter of the email key and of the IP key
loginAttemptSchema.index(
    { keyHash: 1 },
    { name: "loginAttempts_keyHash_uq", unique: true }
);
// serves: retention. Counters vanish 24 h after the last attempt, which also ends the longest lock (24 h)
loginAttemptSchema.index(
    { lastAttemptAt: 1 },
    { name: "loginAttempts_lastAttemptAt_ttl", expireAfterSeconds: TTL_SECONDS }
);

loginAttemptSchema.plugin(toJsonPlugin);

export const LoginAttempt =
    mongoose.models.LoginAttempt ??
    mongoose.model("LoginAttempt", loginAttemptSchema);
