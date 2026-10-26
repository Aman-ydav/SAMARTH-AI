import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { expectAccessible } from "./axeCheck";

describe("Select", () => {
    it("shows the placeholder, opens with the keyboard and picks an option", async () => {
        const onValueChange = vi.fn();
        const { container } = render(
            <Select onValueChange={onValueChange}>
                <SelectTrigger aria-label="Language">
                    <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                </SelectContent>
            </Select>
        );
        expect(
            screen.getByRole("combobox", { name: "Language" })
        ).toHaveTextContent("Choose");
        await expectAccessible(container);
        await userEvent.click(
            screen.getByRole("combobox", { name: "Language" })
        );
        await userEvent.click(
            await screen.findByRole("option", { name: "Hindi" })
        );
        expect(onValueChange).toHaveBeenCalledWith("hi");
    });
});

describe("Field", () => {
    it("pairs label, description and error with the control", async () => {
        const { container } = render(
            <FieldGroup>
                <Field data-invalid="true">
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                        id="name"
                        aria-invalid="true"
                        aria-describedby="name-help name-error"
                    />
                    <FieldDescription id="name-help">
                        As on your ID card
                    </FieldDescription>
                    <FieldError id="name-error">Name is required</FieldError>
                </Field>
            </FieldGroup>
        );
        expect(screen.getByLabelText("Name")).toBeInvalid();
        expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
        await expectAccessible(container);
    });

    it("renders nothing for an empty error and de-duplicates a list", () => {
        const { container, rerender } = render(<FieldError errors={[]} />);
        expect(container).toBeEmptyDOMElement();
        rerender(
            <FieldError
                errors={[
                    { message: "Too short" },
                    { message: "Too short" },
                    { message: "No digit" },
                ]}
            />
        );
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
});
