import { Component } from "react";
import { logger } from "@/lib/logger";

/**
 * Local error boundary of the bell (FE-94): a crash in the notifications widget swaps it for `fallback` (a plain bell) and
 * never takes the top bar or the page down with it. React only supports boundaries as classes, which is the one place the
 * app uses a class component (an intentional exception to FE-88). Only a non-PII label is logged (FE-109).
 */
export class NotificationsBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch() {
        logger.error("Notifications widget failed", {
            name: "NotificationsWidget",
        });
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
