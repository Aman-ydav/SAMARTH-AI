import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { expectAccessible } from "./axeCheck";

function setViewport(isMobile) {
    window.matchMedia = vi.fn((query) => ({
        matches: isMobile,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

describe("Sidebar", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    function renderSidebar(props) {
        return render(
            <TooltipProvider>
                <SidebarProvider {...props}>
                    <Sidebar collapsible="icon" aria-label="Main">
                        <SidebarContent>
                            <SidebarGroup>
                                <SidebarGroupLabel>Learn</SidebarGroupLabel>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            asChild
                                            isActive
                                            tooltip="Dashboard"
                                        >
                                            <a href="/dashboard">Dashboard</a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>
                    <SidebarInset>
                        <SidebarTrigger />
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>
        );
    }

    it("starts expanded, marks the active item and is accessible", async () => {
        setViewport(false);
        const { container } = renderSidebar();
        expect(container.querySelector("[data-slot=sidebar]")).toHaveAttribute(
            "data-state",
            "expanded"
        );
        expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
            "data-active",
            "true"
        );
        await expectAccessible(container);
    });

    it("persists the collapsed state under sai-sidebar and never writes a cookie", async () => {
        setViewport(false);
        const { container } = renderSidebar();
        await userEvent.click(screen.getByRole("button", { name: /sidebar/i }));
        expect(container.querySelector("[data-slot=sidebar]")).toHaveAttribute(
            "data-state",
            "collapsed"
        );
        expect(window.localStorage.getItem("sai-sidebar")).toBe("collapsed");
        expect(document.cookie).not.toContain("sidebar");
    });

    it("restores the stored state on the next visit", () => {
        setViewport(false);
        window.localStorage.setItem("sai-sidebar", "collapsed");
        const { container } = renderSidebar();
        expect(container.querySelector("[data-slot=sidebar]")).toHaveAttribute(
            "data-state",
            "collapsed"
        );
    });

    it("toggles with Ctrl+B", async () => {
        setViewport(false);
        const { container } = renderSidebar();
        await userEvent.keyboard("{Control>}b{/Control}");
        expect(container.querySelector("[data-slot=sidebar]")).toHaveAttribute(
            "data-state",
            "collapsed"
        );
    });

    it("becomes an off-canvas sheet below the md breakpoint", async () => {
        setViewport(true);
        renderSidebar();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /sidebar/i }));
        const sheet = await screen.findByRole("dialog");
        expect(sheet).toHaveAttribute("data-mobile", "true");
    });
});
