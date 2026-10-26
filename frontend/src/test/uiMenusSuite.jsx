import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { expectAccessible } from "./axeCheck";

describe("DropdownMenu", () => {
    it("opens by keyboard, runs an item and supports checkbox and radio items", async () => {
        const onSelect = vi.fn();
        const { baseElement } = render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">Options</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={onSelect}>
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked>
                        Show hints
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuRadioGroup value="en">
                        <DropdownMenuRadioItem value="en">
                            English
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="hi">
                            Hindi
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        );
        screen.getByRole("button", { name: "Options" }).focus();
        await userEvent.keyboard("{Enter}");
        const menu = await screen.findByRole("menu");
        expect(
            within(menu).getByRole("menuitemcheckbox", { name: "Show hints" })
        ).toBeChecked();
        expect(
            within(menu).getByRole("menuitemradio", { name: "English" })
        ).toBeChecked();
        await expectAccessible(baseElement);
        await userEvent.click(
            within(menu).getByRole("menuitem", { name: "Profile" })
        );
        expect(onSelect).toHaveBeenCalledTimes(1);
    });
});

describe("Popover and Tooltip", () => {
    it("opens a popover with its content", async () => {
        const { baseElement } = render(
            <Popover>
                <PopoverTrigger asChild>
                    <Button>Notifications</Button>
                </PopoverTrigger>
                <PopoverContent aria-label="Notification list">
                    Nothing new
                </PopoverContent>
            </Popover>
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Notifications" })
        );
        expect(await screen.findByText("Nothing new")).toBeVisible();
        await expectAccessible(baseElement);
    });

    it("describes its trigger with a tooltip", async () => {
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger asChild>
                        <Button size="icon" aria-label="Help">
                            ?
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open the help centre</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        expect(
            (await screen.findAllByText("Open the help centre")).length
        ).toBeGreaterThan(0);
        expect(
            screen.getByRole("button", { name: "Help" })
        ).toHaveAccessibleDescription("Open the help centre");
    });
});

describe("Tabs, Accordion, Collapsible, ScrollArea", () => {
    it("switches tabs with the keyboard", async () => {
        const { container } = render(
            <Tabs defaultValue="one">
                <TabsList>
                    <TabsTrigger value="one">One</TabsTrigger>
                    <TabsTrigger value="two">Two</TabsTrigger>
                </TabsList>
                <TabsContent value="one">First panel</TabsContent>
                <TabsContent value="two">Second panel</TabsContent>
            </Tabs>
        );
        await expectAccessible(container);
        screen.getByRole("tab", { name: "One" }).focus();
        await userEvent.keyboard("{ArrowRight}");
        expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute(
            "aria-selected",
            "true"
        );
        expect(screen.getByRole("tabpanel")).toHaveTextContent("Second panel");
    });

    it("expands and collapses an accordion item", async () => {
        const { container } = render(
            <Accordion type="single" collapsible>
                <AccordionItem value="a">
                    <AccordionTrigger>What is SAMARTH AI?</AccordionTrigger>
                    <AccordionContent>A prototype.</AccordionContent>
                </AccordionItem>
            </Accordion>
        );
        const trigger = screen.getByRole("button", {
            name: "What is SAMARTH AI?",
        });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        await userEvent.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("A prototype.")).toBeVisible();
        await expectAccessible(container);
    });

    it("toggles collapsible content", async () => {
        render(
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button>More</Button>
                </CollapsibleTrigger>
                <CollapsibleContent>Hidden details</CollapsibleContent>
            </Collapsible>
        );
        expect(screen.queryByText("Hidden details")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "More" }));
        expect(screen.getByText("Hidden details")).toBeInTheDocument();
    });

    it("renders scroll area children", async () => {
        const { container } = render(
            <ScrollArea className="h-20">
                <p>Long content</p>
            </ScrollArea>
        );
        expect(screen.getByText("Long content")).toBeInTheDocument();
        await expectAccessible(container);
    });
});
