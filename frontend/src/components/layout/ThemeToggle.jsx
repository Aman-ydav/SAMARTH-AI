import { useTranslation } from "react-i18next";
import { ComputerIcon, MoonIcon, SunIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/features/preferences";

/** Light / dark / system menu (UI-60). Reflects and updates the persisted `ui.theme` preference. */
export function ThemeToggle({ className }) {
    const { t } = useTranslation("nav");
    const { theme, resolvedTheme, setTheme } = useTheme();
    const CurrentIcon = resolvedTheme === "dark" ? MoonIcon : SunIcon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={className}
                    aria-label={t("themeLabel")}
                >
                    <CurrentIcon className="size-5" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light">
                        <SunIcon aria-hidden="true" />
                        {t("themeLight")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                        <MoonIcon aria-hidden="true" />
                        {t("themeDark")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                        <ComputerIcon aria-hidden="true" />
                        {t("themeSystem")}
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
