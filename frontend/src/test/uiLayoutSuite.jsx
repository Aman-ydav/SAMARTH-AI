import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it } from "vitest";
import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Toaster } from "@/components/ui/sonner";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { expectAccessible } from "./axeCheck";

describe("Table", () => {
    it("renders a captioned data table with header cells", async () => {
        const { container } = render(
            <Table>
                <TableCaption>Learners</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Score</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Asha</TableCell>
                        <TableCell>82</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        );
        expect(screen.getByRole("table", { name: "Learners" })).toHaveClass(
            "tabular-nums"
        );
        expect(screen.getAllByRole("columnheader")).toHaveLength(2);
        expect(screen.getByRole("cell", { name: "82" })).toBeInTheDocument();
        await expectAccessible(container);
    });
});

describe("Breadcrumb", () => {
    it("marks the current page and labels the navigation", async () => {
        const { container } = render(
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbEllipsis />
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
        );
        expect(screen.getByRole("navigation")).toHaveAccessibleName();
        expect(screen.getByText("Settings")).toHaveAttribute(
            "aria-current",
            "page"
        );
        await expectAccessible(container);
    });
});

describe("Pagination", () => {
    it("marks the active page and labels previous and next", async () => {
        const { container } = render(
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious href="?page=1" />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationLink href="?page=2" isActive>
                            2
                        </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext href="?page=3" />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        );
        expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        expect(screen.getAllByRole("link")).toHaveLength(3);
        await expectAccessible(container);
    });
});

describe("NavigationMenu", () => {
    it("renders links and a trigger button", async () => {
        const { container } = render(
            <NavigationMenu viewport={false}>
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger>Features</NavigationMenuTrigger>
                        <NavigationMenuContent>
                            <NavigationMenuLink href="/assessment">
                                Assessment engine
                            </NavigationMenuLink>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                        <NavigationMenuLink href="/about">
                            About
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        );
        expect(
            screen.getByRole("button", { name: "Features" })
        ).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
            "href",
            "/about"
        );
        await expectAccessible(container);
    });
});

describe("Toaster", () => {
    it("shows a toast with its status text", async () => {
        render(<Toaster />);
        act(() => {
            toast.success("Profile saved");
        });
        expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    });
});
