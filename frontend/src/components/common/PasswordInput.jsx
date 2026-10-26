import * as React from "react";
import { useTranslation } from "react-i18next";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ref, ...props }) {
    const { t } = useTranslation("common");
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOffIcon : EyeIcon;

    return (
        <div className="relative">
            <Input
                ref={ref}
                type={visible ? "text" : "password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={cn("pr-11", className)}
                {...props}
            />
            <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? t("hidePassword") : t("showPassword")}
                aria-pressed={visible}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Icon aria-hidden="true" className="size-5" />
            </button>
        </div>
    );
}
