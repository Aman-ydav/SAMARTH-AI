import { CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { ValueTick } from "@/components/motion/ValueTick";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MockLevelBar } from "@/features/marketing/components/MockLevelBar";
import { MockWindow } from "@/features/marketing/components/MockWindow";
import {
    MAX_LEVEL,
    MOCK_COMPETENCIES,
    MOCK_CONFIDENCE,
} from "@/features/marketing/data/heroMock";

const SHOWN = ["sampling", "surveyDesign", "python", "privacy", "ml", "sdmx"];
const CONFIDENCE_VARIANT = { high: "success", medium: "info", low: "warning" };

function SelectField({ id, label, value }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="type-caption text-muted-foreground">
                {label}
            </Label>
            <Select value="current">
                <SelectTrigger id={id} size="sm" className="w-full type-small">
                    <SelectValue>{value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="current">{value}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

function Form({ t }) {
    const key = (name) => t(`how.visual.profile.${name}`);
    const list = (name) =>
        t(`how.visual.profile.${name}`, { returnObjects: true });
    return (
        <div className="flex flex-col gap-4 border-border p-4 lg:col-span-2 lg:border-r">
            <p className="type-h4">{key("formTitle")}</p>
            <SelectField
                id="how-designation"
                label={key("designation")}
                value={key("designationValue")}
            />
            <SelectField
                id="how-role"
                label={key("role")}
                value={key("roleValue")}
            />
            <div className="flex flex-col gap-1.5">
                <span className="type-caption text-muted-foreground">
                    {key("experience")}
                </span>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={key("decrease")}
                    >
                        <MinusIcon aria-hidden="true" />
                    </Button>
                    <span className="min-w-10 text-center font-mono tabular-nums">
                        {key("experienceValue")}
                    </span>
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={key("increase")}
                    >
                        <PlusIcon aria-hidden="true" />
                    </Button>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className="type-caption text-muted-foreground">
                    {key("qualifications")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                    {list("qualificationItems").map((item) => (
                        <Badge key={item} variant="secondary">
                            <CheckIcon aria-hidden="true" />
                            {item}
                        </Badge>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className="type-caption text-muted-foreground">
                    {key("training")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                    {list("trainingItems").map((item) => (
                        <Badge key={item} variant="outline">
                            {item}
                        </Badge>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Results({ t, active }) {
    const rows = SHOWN.map((id) =>
        MOCK_COMPETENCIES.find((item) => item.id === id)
    );
    return (
        <div className="flex flex-col gap-3 p-4 lg:col-span-3">
            <div className="flex items-center justify-between gap-2">
                <p className="type-h4">{t("how.visual.profile.resultTitle")}</p>
                <Badge variant="success">{t("how.visual.profile.live")}</Badge>
            </div>
            <div className="flex items-center gap-3 type-caption text-muted-foreground">
                <span className="w-28">{t("how.visual.profile.level")}</span>
                <span className="flex flex-1 justify-between font-mono">
                    {Array.from({ length: MAX_LEVEL + 1 }, (_, index) => (
                        <span key={index}>{index}</span>
                    ))}
                </span>
                <span className="w-6" />
                <span className="w-16">
                    {t("how.visual.profile.confidence")}
                </span>
            </div>
            <ul className="flex flex-col gap-2.5">
                {rows.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                        <span className="w-28 truncate type-small">
                            {t(`hero.mock.competencies.${item.id}`)}
                        </span>
                        <MockLevelBar
                            className="flex-1"
                            level={active ? item.current : 0}
                            required={item.required}
                            showRequired={active}
                        />
                        <ValueTick
                            className="w-6 text-right type-small"
                            value={active ? item.current : 0}
                            initial={0}
                        />
                        <Badge
                            className="w-16"
                            variant={
                                CONFIDENCE_VARIANT[MOCK_CONFIDENCE[item.id]]
                            }
                        >
                            {t(
                                `how.visual.confidence.${MOCK_CONFIDENCE[item.id]}`
                            )}
                        </Badge>
                    </li>
                ))}
            </ul>
            <p className="flex items-center gap-2 type-caption text-muted-foreground">
                <span className="h-3 w-0.5 bg-foreground" />
                {t("how.visual.profile.required")}
            </p>
            <p className="type-caption text-muted-foreground">
                {t("how.visual.profile.note")}
            </p>
        </div>
    );
}

/** Profile step: an onboarding form beside live estimated levels that fill and count up when the step is active. */
export function HowVisualProfile({ t, active }) {
    return (
        <MockWindow
            title={t("how.visual.window.profile")}
            demoLabel={t("how.visual.demo")}
        >
            <div className="grid lg:grid-cols-5">
                <Form t={t} />
                <Results t={t} active={active} />
            </div>
        </MockWindow>
    );
}
