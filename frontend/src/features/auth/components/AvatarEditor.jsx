import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorIcon, UploadIcon } from "@/components/icons";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { AvatarRemoveDialog } from "@/features/auth/components/AvatarRemoveDialog";
import { FormFailureAlert } from "@/features/auth/components/FormFailureAlert";
import { SectionCard } from "@/features/auth/components/SectionCard";
import { useAvatarUpload } from "@/features/auth/hooks/useAvatarUpload";
import { AVATAR_ACCEPT } from "@/features/auth/schemas/settingsSchemas";

const NOTICE_KEYS = {
    uploaded: "settings.avatar.uploaded",
    removed: "settings.avatar.removed",
    cancelled: "settings.avatar.cancelled",
};

/**
 * Profile photo card (EDGE-108): the saved photo (or initials), a local preview of the chosen file, upload progress with a
 * real cancel, remove with confirmation, and the honest limits. A failed upload keeps the previous photo.
 */
export function AvatarEditor({ user }) {
    const { t } = useTranslation(["auth", "validation"]);
    const input = useRef(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const avatar = useAvatarUpload();
    const { selection, uploading, removing } = avatar;
    const busy = uploading || removing;
    const hasPhoto = Boolean(user?.avatar?.publicId);

    function onFileChosen(event) {
        const [file] = event.target.files;
        event.target.value = "";
        if (file) avatar.choose(file);
    }

    return (
        <SectionCard
            title={t("settings.avatar.heading")}
            description={t("settings.avatar.description")}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {selection?.url ? (
                    <img
                        src={selection.url}
                        alt={t("settings.avatar.previewAlt")}
                        className="size-24 shrink-0 rounded-full border border-border object-cover"
                    />
                ) : (
                    <UserAvatar user={user} className="size-24" />
                )}
                <div className="flex flex-col gap-3">
                    <Input
                        ref={input}
                        type="file"
                        accept={AVATAR_ACCEPT}
                        className="sr-only"
                        aria-label={t("settings.avatar.fileInput")}
                        tabIndex={-1}
                        onChange={onFileChosen}
                    />
                    {selection && !uploading && (
                        <p className="text-sm text-muted-foreground">
                            {t("settings.avatar.previewNote")}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {selection ? (
                            <>
                                <Button
                                    type="button"
                                    onClick={avatar.save}
                                    disabled={
                                        uploading ||
                                        avatar.uploadCooldownSec > 0
                                    }
                                    aria-busy={uploading}
                                >
                                    {uploading ? (
                                        <Spinner />
                                    ) : (
                                        <UploadIcon aria-hidden="true" />
                                    )}
                                    {t("settings.avatar.save")}
                                </Button>
                                {uploading ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={avatar.cancel}
                                    >
                                        {t("settings.avatar.cancelUpload")}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={avatar.discard}
                                    >
                                        {t("settings.avatar.discard")}
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => input.current?.click()}
                                >
                                    <UploadIcon aria-hidden="true" />
                                    {t(
                                        hasPhoto
                                            ? "settings.avatar.change"
                                            : "settings.avatar.choose"
                                    )}
                                </Button>
                                {hasPhoto && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy}
                                        aria-busy={removing}
                                        onClick={() => setConfirmRemove(true)}
                                    >
                                        {removing && <Spinner />}
                                        {t("settings.avatar.remove")}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            {uploading && (
                <div className="flex flex-col gap-2" role="status">
                    <p className="text-sm">{t("settings.avatar.uploading")}</p>
                    <Progress
                        value={avatar.progress}
                        aria-label={t("settings.avatar.progressLabel")}
                    />
                    <p className="type-caption text-muted-foreground">
                        {t("settings.avatar.progressValue", {
                            percent: avatar.progress,
                        })}
                    </p>
                </div>
            )}
            {avatar.problem && (
                <Alert variant="destructive">
                    <ErrorIcon aria-hidden="true" />
                    <AlertDescription>{t(avatar.problem)}</AlertDescription>
                </Alert>
            )}
            <FormFailureAlert
                failure={avatar.uploadFailure ?? avatar.removeFailure}
                cooldownSec={avatar.uploadCooldownSec}
            />
            {avatar.notice && !uploading && (
                <p role="status" className="text-sm">
                    {t(NOTICE_KEYS[avatar.notice])}
                </p>
            )}
            <p className="text-sm text-muted-foreground">
                {t("settings.avatar.limits")}
            </p>
            <AvatarRemoveDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                onConfirm={avatar.remove}
            />
        </SectionCard>
    );
}
