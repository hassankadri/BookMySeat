
import React from "react";

/**
 * Wraps lazily loaded code. If the download fails (a flaky connection, or a deploy that has replaced
 * the old files) the page keeps working and shows `fallback` instead of going blank.
 */
export default class LazyBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Retries a dynamic import once after a short pause. */
export const withRetry = (load) => () =>
  load().catch(() => new Promise((resolve) => setTimeout(resolve, 700)).then(load));
