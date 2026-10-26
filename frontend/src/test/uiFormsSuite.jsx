import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { expectAccessible } from "./axeCheck";

describe("Button", () => {
    it("renders every variant and size accessibly and fires clicks", async () => {
        const onClick = vi.fn();
        const { container } = render(
            <div>
                {[
                    "default",
                    "secondary",
                    "outline",
                    "ghost",
                    "destructive",
                    "link",
                ].map((variant) => (
                    <Button key={variant} variant={variant} onClick={onClick}>
                        {variant}
                    </Button>
                ))}
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Icon only">
                    +
                </Button>
            </div>
        );
        await userEvent.click(screen.getByRole("button", { name: "default" }));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "default" })).toHaveClass(
            "bg-primary",
            "text-primary-foreground",
            "h-10"
        );
        await expectAccessible(container);
    });

    it("does not fire while disabled", async () => {
        const onClick = vi.fn();
        render(
            <Button disabled onClick={onClick}>
                Save
            </Button>
        );
        await userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it("renders a link when asChild wraps an anchor", async () => {
        const { container } = render(
            <Button asChild>
                <a href="/about">About</a>
            </Button>
        );
        expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
            "href",
            "/about"
        );
        await expectAccessible(container);
    });
});

describe("Input, Textarea, Label", () => {
    it("binds the label, shows the value and exposes invalid state", async () => {
        const { container } = render(
            <div>
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    aria-invalid="true"
                    aria-describedby="email-error"
                />
                <p id="email-error">Enter a valid email</p>
                <Label htmlFor="note">Note</Label>
                <Textarea id="note" />
            </div>
        );
        const input = screen.getByLabelText("Email");
        await userEvent.type(input, "a@example.test");
        expect(input).toHaveValue("a@example.test");
        expect(input).toBeInvalid();
        expect(input).toHaveClass("h-10", "border-input");
        expect(screen.getByLabelText("Note")).toHaveClass("min-h-20");
        await expectAccessible(container);
    });
});

describe("Checkbox, Switch, RadioGroup", () => {
    it("toggles a checkbox with the keyboard and the mouse", async () => {
        const onChange = vi.fn();
        const { container } = render(
            <div>
                <Checkbox id="terms" onCheckedChange={onChange} />
                <Label htmlFor="terms">Accept terms</Label>
            </div>
        );
        const box = screen.getByRole("checkbox", { name: "Accept terms" });
        await userEvent.click(box);
        expect(box).toBeChecked();
        await userEvent.keyboard(" ");
        expect(box).not.toBeChecked();
        expect(onChange).toHaveBeenCalledTimes(2);
        await expectAccessible(container);
    });

    it("toggles a switch", async () => {
        const { container } = render(
            <div>
                <Switch id="notify" />
                <Label htmlFor="notify">Notifications</Label>
            </div>
        );
        const toggle = screen.getByRole("switch", { name: "Notifications" });
        expect(toggle).toHaveClass(
            "data-[size=default]:h-6",
            "data-[size=default]:w-11"
        );
        await userEvent.click(toggle);
        expect(toggle).toBeChecked();
        await expectAccessible(container);
    });

    it("selects one radio at a time", async () => {
        const { container } = render(
            <RadioGroup defaultValue="learner" aria-label="Role">
                <div>
                    <RadioGroupItem value="learner" id="r-learner" />
                    <Label htmlFor="r-learner">Learner</Label>
                </div>
                <div>
                    <RadioGroupItem value="trainer" id="r-trainer" />
                    <Label htmlFor="r-trainer">Trainer</Label>
                </div>
            </RadioGroup>
        );
        await userEvent.click(screen.getByRole("radio", { name: "Trainer" }));
        expect(screen.getByRole("radio", { name: "Trainer" })).toBeChecked();
        expect(
            screen.getByRole("radio", { name: "Learner" })
        ).not.toBeChecked();
        await expectAccessible(container);
    });
});
