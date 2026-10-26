import { useTranslation } from "react-i18next";
import { ChevronDownIcon, TranslateIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/features/preferences";

/**
 * English / हिन्दी menu (UI-60). The choice is stored by the preferences listener (`sai-lang`) and switches i18n.
 * `showLabel` renders the current language name next to the icon (footer, mobile menu); the default is icon only.
 */
export function LanguageSwitch({ className, showLabel = false }) {
    const { t } = useTranslation("common");
    const { language, setLanguage } = useLanguage();
    const label = t("language.label");

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {showLabel ? (
                    <Button
                        variant="outline"
                        className={className}
                        aria-label={label}
                    >
                        <TranslateIcon aria-hidden="true" />
                        <span lang={language}>
                            {language === "hi"
                                ? t("language.hi")
                                : t("language.en")}
                        </span>
                        <ChevronDownIcon aria-hidden="true" />
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={className}
                        aria-label={label}
                    >
                        <TranslateIcon className="size-5" aria-hidden="true" />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                    value={language}
                    onValueChange={setLanguage}
                >
                    <DropdownMenuRadioItem value="en" lang="en">
                        {t("language.en")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="hi" lang="hi">
                        {t("language.hi")}
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
