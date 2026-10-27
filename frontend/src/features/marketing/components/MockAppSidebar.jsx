import {
    AwardIcon,
    ChatIcon,
    CompassIcon,
    DashboardIcon,
    HelpIcon,
    QuizIcon,
    RouteIcon,
    SettingsIcon,
    TargetIcon,
} from "@/components/icons";
import { MOCK_NAV } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

const ICONS = {
    dashboard: DashboardIcon,
    competency: TargetIcon,
    path: RouteIcon,
    quizzes: QuizIcon,
    tutor: ChatIcon,
    certificates: AwardIcon,
    settings: SettingsIcon,
    help: HelpIcon,
};

function NavRow({ id, active, label }) {
    const Icon = ICONS[id];
    return (
        <li
            data-active={active ? "true" : undefined}
            className={cn(
                "relative flex h-9 items-center gap-2 rounded-md px-2 type-small",
                active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
            )}
        >
            {active ? (
                <span className="absolute inset-y-1.5 left-0 w-0.5 bg-sidebar-primary" />
            ) : null}
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
        </li>
    );
}

/** Sidebar of the mock web app: brand, role-filtered navigation with the active item, and help (UI-61 look). */
export function MockAppSidebar({ t }) {
    return (
        <aside className="flex w-44 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-3">
            <div className="flex flex-col gap-1">
                <div className="mb-3 flex items-center gap-2 px-1">
                    <span className="grid size-7 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                        <CompassIcon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="font-display text-base text-sidebar-foreground">
                        {t("hero.mock.app.brand")}
                    </span>
                </div>
                <ul className="flex flex-col gap-1">
                    {MOCK_NAV.map((item) => (
                        <NavRow
                            key={item.id}
                            id={item.id}
                            active={item.active}
                            label={t(`hero.mock.nav.${item.id}`)}
                        />
                    ))}
                </ul>
            </div>
            <ul>
                <NavRow id="help" label={t("hero.mock.nav.help")} />
            </ul>
        </aside>
    );
}
