'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** What to call the panel in the message, e.g. "Tools". */
  label: string;
};

type State = {
  failed: boolean;
};

/**
 * Keeps one panel's crash from taking the board with it. The board lives in the
 * engine beside the React tree, so a panel that throws mid-render can be
 * replaced by a message without losing a single shape. The message says what to
 * do next: reload, and the autosaved board comes back.
 *
 * A class is the only shape React accepts for an error boundary.
 */
export class PanelBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  private readonly reload = (): void => {
    window.location.reload();
  };

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `the ${this.props.label} panel failed`,
      error,
      info.componentStack
    );
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div
          className='absolute bottom-3 left-3 z-50 max-w-xs rounded-lg border border-destructive/40 bg-background/95 p-3 text-xs shadow-md'
          data-testid='panel-error'
          role='alert'
        >
          <p>
            The {this.props.label} panel hit an unexpected error. Your board is
            safe.
          </p>
          <button
            className='mt-2 rounded border border-border px-2 py-0.5 font-medium'
            onClick={this.reload}
            type='button'
          >
            Reload to try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
