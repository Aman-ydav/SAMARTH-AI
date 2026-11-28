import { useTranslation } from "react-i18next";

/* The server stores no wording, only a `type` (doc 22 section 6, as built). Each known type maps to a title and a body key in
   the `notifications` namespace, so Hindi and English both come from the i18n files (FE-82..85). An unknown or newer type gets
   neutral wording instead of breaking the list (FE-37). */
const TEXT_KEYS = Object.freeze({
    "job.completed": {
        title: "types.jobCompleted.title",
        body: "types.jobCompleted.body",
    },
    "job.failed": {
        title: "types.jobFailed.title",
        body: "types.jobFailed.body",
    },
});
const FALLBACK_KEYS = Object.freeze({
    title: "types.unknown.title",
    body: "types.unknown.body",
});

/** Translated `{ title, body }` of one notification. */
export function useNotificationText(notification) {
    const { t } = useTranslation("notifications");
    const keys = TEXT_KEYS[notification.type] ?? FALLBACK_KEYS;
    return { title: t(keys.title), body: t(keys.body) };
}
