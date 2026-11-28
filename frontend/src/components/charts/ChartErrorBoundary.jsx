import { Component } from "react";

/** Local boundary: a chart that throws while rendering shows `fallback` instead of taking the page down. */
export class ChartErrorBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
