import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useNotify } from "@/hooks/useNotify";
import {
    checkAvatarSignature,
    validateAvatarFile,
} from "@/features/auth/schemas/settingsSchemas";
import {
    removeAvatar,
    selectAvatarProgress,
    uploadAvatar,
} from "@/features/auth/slice/profileSlice";

/** Local preview address; browsers without `URL.createObjectURL` simply show no preview. */
function previewAddress(file) {
    try {
        return URL.createObjectURL(file);
    } catch {
        return null;
    }
}

/**
 * Avatar flow for the profile page (EDGE-108, MEDIA-08): pick a file, check it on the client (type, size, first bytes),
 * preview it, upload with progress and a real cancel, or remove the saved photo. A failed upload keeps the previous
 * photo and the chosen file so the person can retry. Server limits and magic-byte checks stay authoritative.
 */
export function useAvatarUpload() {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const notify = useNotify();
    const progress = useAppSelector(selectAvatarProgress);
    const upload = useAsyncAction();
    const removal = useAsyncAction();
    const [selection, setSelection] = useState(null);
    const [problem, setProblem] = useState(null);
    const [notice, setNotice] = useState(null);
    const pickCount = useRef(0);
    const request = useRef(null);
    const cancelled = useRef(false);
    const { clearFailure } = upload;
    const { run: runUpload } = upload;
    const { run: runRemoval } = removal;

    useEffect(
        () => () => {
            if (selection?.url) URL.revokeObjectURL(selection.url);
        },
        [selection]
    );

    const choose = useCallback(
        async (file) => {
            pickCount.current += 1;
            const pick = pickCount.current;
            setNotice(null);
            clearFailure();
            const found =
                validateAvatarFile(file) ?? (await checkAvatarSignature(file));
            if (pick !== pickCount.current) return;
            setProblem(found);
            setSelection(found ? null : { file, url: previewAddress(file) });
        },
        [clearFailure]
    );

    const discard = useCallback(() => {
        pickCount.current += 1;
        setSelection(null);
        setProblem(null);
        clearFailure();
    }, [clearFailure]);

    const save = useCallback(() => {
        if (!selection) return undefined;
        return runUpload(
            async () => {
                cancelled.current = false;
                request.current = dispatch(
                    uploadAvatar({ file: selection.file })
                );
                await request.current.unwrap();
                setSelection(null);
                setNotice("uploaded");
                await notify(
                    "success",
                    t("settings.avatar.uploaded"),
                    "avatar-updated"
                );
            },
            () => {
                if (!cancelled.current) return false;
                setNotice("cancelled");
                return true;
            }
        );
    }, [dispatch, notify, runUpload, selection, t]);

    const cancel = useCallback(() => {
        cancelled.current = true;
        request.current?.abort();
    }, []);

    const remove = useCallback(
        () =>
            runRemoval(async () => {
                await dispatch(removeAvatar()).unwrap();
                setNotice("removed");
                await notify(
                    "success",
                    t("settings.avatar.removed"),
                    "avatar-removed"
                );
            }),
        [dispatch, notify, runRemoval, t]
    );

    return {
        selection,
        problem,
        notice,
        progress,
        uploading: upload.pending,
        uploadFailure: upload.failure,
        uploadCooldownSec: upload.cooldownSec,
        removing: removal.pending,
        removeFailure: removal.failure,
        choose,
        discard,
        save,
        cancel,
        remove,
    };
}
