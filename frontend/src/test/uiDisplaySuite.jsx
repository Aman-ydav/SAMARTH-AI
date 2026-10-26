import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { expectAccessible } from "./axeCheck";

describe("Card, Badge, Alert", () => {
    it("renders a card with a title and description", async () => {
        const { container } = render(
            <Card>
                <CardHeader>
                    <CardTitle>Progress</CardTitle>
                    <CardDescription>Your learning path</CardDescription>
                </CardHeader>
                <CardContent>Body</CardContent>
            </Card>
        );
        expect(screen.getByText("Progress")).toHaveClass("type-h4");
        await expectAccessible(container);
    });

    it("renders every badge variant with text", async () => {
        const { container } = render(
            <div>
                {[
                    "default",
                    "secondary",
                    "outline",
                    "success",
                    "warning",
                    "info",
                    "destructive",
                ].map((variant) => (
                    <Badge key={variant} variant={variant}>
                        {variant}
                    </Badge>
                ))}
            </div>
        );
        expect(screen.getByText("success")).toHaveClass(
            "bg-success-subtle",
            "text-success-subtle-foreground"
        );
        await expectAccessible(container);
    });

    it("announces each alert variant", async () => {
        const { container } = render(
            <div>
                {["default", "success", "warning", "info", "destructive"].map(
                    (variant) => (
                        <Alert key={variant} variant={variant}>
                            <AlertTitle>{variant} title</AlertTitle>
                            <AlertDescription>
                                {variant} message
                            </AlertDescription>
                        </Alert>
                    )
                )}
            </div>
        );
        expect(screen.getAllByRole("alert")).toHaveLength(5);
        await expectAccessible(container);
    });
});

describe("Progress, Skeleton, Spinner, Separator, Avatar", () => {
    it("exposes progress as a progressbar with its value", async () => {
        const { container } = render(
            <Progress value={40} aria-label="Course progress" />
        );
        const bar = screen.getByRole("progressbar", {
            name: "Course progress",
        });
        expect(bar).toHaveAttribute("aria-valuenow", "40");
        await expectAccessible(container);
    });

    it("clamps out-of-range progress values", () => {
        render(<Progress value={250} aria-label="Over" />);
        expect(
            screen
                .getByRole("progressbar")
                .firstElementChild.style.getPropertyValue("--progress-value")
        ).toBe("100%");
    });

    it("renders a skeleton, a labelled spinner, a separator and an avatar fallback", async () => {
        const { container } = render(
            <div>
                <Skeleton className="h-4 w-20" data-testid="skeleton" />
                <Spinner />
                <Separator />
                <Avatar>
                    <AvatarFallback>AB</AvatarFallback>
                </Avatar>
            </div>
        );
        expect(screen.getByTestId("skeleton")).toHaveClass(
            "motion-safe:animate-pulse"
        );
        expect(screen.getByRole("status")).toHaveAccessibleName();
        expect(screen.getByText("AB")).toBeInTheDocument();
        await expectAccessible(container);
    });
});
