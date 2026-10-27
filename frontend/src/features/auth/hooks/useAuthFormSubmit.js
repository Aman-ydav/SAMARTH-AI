import { useCallback, useEffect, useRef } from "react";
import { errorMessageKey } from "@/lib/apiError";
import { applyServerErrors } from "@/lib/forms";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export const NO_CODE_FIELDS = Object.freeze({});

/** One-time-link failure codes that `lib/apiError.js` does not list; all mean "request a new link" (doc 20 section 9). */
export const LINK_ERROR_CODES = Object.freeze({
    VERIFY_TOKEN_INVALID: "VERIFY_TOKEN_INVALID",
    RESET_TOKEN_INVALID: "RESET_TOKEN_INVALID",
    INVITE_INVALID: "INVITE_INVALID",
    EMAIL_CHANGE_INVALID: "EMAIL_CHANGE_INVALID",
});

/**
 * Submit handling shared by every auth form (FE-76, FE-77): double-submit guard, pending state, server
 * errors mapped onto fields with `applyServerErrors` (codes in `codeFields` land on a named field), the rest
 * as a form-level failure, and focus moved to the first errored field once the controls are enabled again.
 */
export function useAuthFormSubmit(form, fields, codeFields = NO_CODE_FIELDS) {
    const action = useAsyncAction();
    const focusTarget = useRef(null);
    const { setError, setFocus } = form;
    const { run: runAction, pending } = action;

    useEffect(() => {
        if (pending || !focusTarget.current) return;
        setFocus(focusTarget.current);
        focusTarget.current = null;
    });

    const focusFieldLater = useCallback((name) => {
        focusTarget.current = name;
    }, []);

    const applyFieldErrors = useCallback(
        (error) => {
            const field = codeFields[error.code];
            if (field) {
                setError(field, {
                    type: "server",
                    message: errorMessageKey(error.code),
                });
                focusTarget.current = field;
                return true;
            }
            const { fieldCount } = applyServerErrors(error, {
                setError,
                setFocus: focusFieldLater,
                fields,
            });
            return fieldCount > 0;
        },
        [codeFields, fields, focusFieldLater, setError]
    );

    const run = useCallback(
        (work, onError) =>
            runAction(
                work,
                (error) => onError?.(error) === true || applyFieldErrors(error)
            ),
        [runAction, applyFieldErrors]
    );

    return {
        run,
        pending,
        failure: action.failure,
        clearFailure: action.clearFailure,
        cooldownSec: action.cooldownSec,
        focusFieldLater,
    };
}

/** DOM id of an auth field, shared by the field, its error text and the error summary links. */
export const authFieldId = (name) => `auth-${name}`;
