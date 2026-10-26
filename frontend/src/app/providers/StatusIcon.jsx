import {
    ErrorWarningIcon,
    ForbidIcon,
    HelpIcon,
    HourglassIcon,
    RefreshIcon,
    WifiOffIcon,
} from "@/components/icons";

const ICONS = {
    errorWarning: ErrorWarningIcon,
    forbid: ForbidIcon,
    help: HelpIcon,
    hourglass: HourglassIcon,
    refresh: RefreshIcon,
    wifiOff: WifiOffIcon,
};

/**
 * Glyphs for the always-loaded app frame (status banners, route error view). Imported lazily through `LazyStatusIcon`
 * so the icon registry (and react-icons) stays out of the initial bundle (FE-111, UI-31).
 */
export default function StatusIcon({ name, ...props }) {
    const Icon = ICONS[name];
    return <Icon aria-hidden="true" {...props} />;
}
