/**
 * Stand-in for `@react-oauth/google` in component tests: the provider renders its children and the login button is a plain
 * button that "succeeds" with `fakeGoogle.credential` or "fails". Use it from `vi.mock("@react-oauth/google", ...)` with a
 * dynamic import, since mocks are hoisted above static imports. No script is loaded and no network is touched (TEST-22).
 */
export const fakeGoogle = { credential: "google-credential-1" };

export function createGoogleModuleMock() {
    return {
        GoogleOAuthProvider: ({ children, onScriptLoadError }) => (
            <div data-testid="google-provider">
                <button type="button" onClick={() => onScriptLoadError?.()}>
                    fake google script error
                </button>
                {children}
            </div>
        ),
        GoogleLogin: ({ onSuccess, onError }) => (
            <div>
                <button
                    type="button"
                    onClick={() =>
                        onSuccess({ credential: fakeGoogle.credential })
                    }
                >
                    fake google ok
                </button>
                <button type="button" onClick={() => onSuccess({})}>
                    fake google empty
                </button>
                <button type="button" onClick={() => onError()}>
                    fake google error
                </button>
            </div>
        ),
    };
}
