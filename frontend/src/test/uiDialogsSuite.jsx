import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { expectAccessible } from "./axeCheck";

describe("Dialog", () => {
    it("opens, traps focus, is accessible and closes with Escape", async () => {
        const { baseElement } = render(
            <Dialog>
                <DialogTrigger asChild>
                    <Button>Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit profile</DialogTitle>
                        <DialogDescription>
                            Change your display name.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter showCloseButton />
                </DialogContent>
            </Dialog>
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Open dialog" })
        );
        const dialog = await screen.findByRole("dialog", {
            name: "Edit profile",
        });
        expect(dialog).toHaveAccessibleDescription("Change your display name.");
        expect(dialog).toHaveClass("bg-popover", "shadow-md");
        await expectAccessible(baseElement);
        await userEvent.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Open dialog" })
        ).toHaveFocus();
    });
});

describe("AlertDialog", () => {
    it("confirms through its action and cancels with the cancel button", async () => {
        const onConfirm = vi.fn();
        const { baseElement } = render(
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={onConfirm}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
        await userEvent.click(screen.getByRole("button", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog", {
            name: "Delete account?",
        });
        await expectAccessible(baseElement);
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Delete" })
        );
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
});

describe("Sheet", () => {
    it("opens from the side with a titled, closable panel", async () => {
        const { baseElement } = render(
            <Sheet>
                <SheetTrigger asChild>
                    <Button>Menu</Button>
                </SheetTrigger>
                <SheetContent side="right">
                    <SheetHeader>
                        <SheetTitle>Navigation</SheetTitle>
                        <SheetDescription>Site links</SheetDescription>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
        );
        await userEvent.click(screen.getByRole("button", { name: "Menu" }));
        const panel = await screen.findByRole("dialog", { name: "Navigation" });
        expect(panel).toHaveAttribute("data-side", "right");
        expect(panel).toHaveAttribute("data-lenis-prevent");
        await expectAccessible(baseElement);
    });
});
