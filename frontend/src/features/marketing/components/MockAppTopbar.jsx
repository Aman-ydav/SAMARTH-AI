import { BellIcon, LanguageIcon, SearchIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/** Top bar of the mock web app: page title, search, language badge, bell and avatar. Decorative and inert. */
export function MockAppTopbar({ t }) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
            <p className="type-h4 text-foreground">
                {t("hero.mock.app.pageTitle")}
            </p>
            <div className="relative ml-auto w-64">
                <SearchIcon
                    aria-hidden="true"
                    className="absolute top-2 left-2.5 size-4 text-muted-foreground"
                />
                <Input
                    readOnly
                    tabIndex={-1}
                    aria-label={t("hero.mock.app.search")}
                    placeholder={t("hero.mock.app.search")}
                    className="h-8 pl-8 type-small"
                />
            </div>
            <Badge variant="outline">
                <LanguageIcon aria-hidden="true" />
                {t("hero.mock.app.language")}
            </Badge>
            <BellIcon
                aria-hidden="true"
                className="size-5 text-muted-foreground"
            />
            <Avatar size="sm">
                <AvatarFallback className="type-caption">
                    {t("hero.mock.app.initials")}
                </AvatarFallback>
            </Avatar>
        </header>
    );
}
