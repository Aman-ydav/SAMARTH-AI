import { SettingsNav } from "@/features/auth/components/SettingsNav";

/**
 * Frame of every account settings screen inside the app shell: the page's one `h1`, a short description, the
 * section navigation and the content. Renders the `<main>` landmark that the shell expects from each page.
 */
export function SettingsLayout({ title, description, children }) {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-3xl flex-col gap-6 outline-none"
        >
            <header className="flex flex-col gap-2">
                <h1 className="type-h1 text-foreground">{title}</h1>
                {description && (
                    <p className="type-body max-w-prose text-muted-foreground">
                        {description}
                    </p>
                )}
            </header>
            <SettingsNav />
            {children}
        </main>
    );
}
