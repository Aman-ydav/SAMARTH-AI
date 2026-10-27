/**
 * Frame of an admin screen inside the app shell: the page's one `h1`, a short description and the content. It renders the
 * `<main>` landmark that the shell expects from each page (UI-61).
 */
export function AdminPageFrame({ title, description, children }) {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-6 outline-none"
        >
            <header className="flex flex-col gap-2">
                <h1 className="type-h1 text-foreground">{title}</h1>
                {description && (
                    <p className="type-body max-w-prose text-muted-foreground">
                        {description}
                    </p>
                )}
            </header>
            {children}
        </main>
    );
}
