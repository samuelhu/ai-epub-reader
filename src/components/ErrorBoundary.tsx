import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ height: '100vh', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h3>
          <p style={{ maxWidth: '400px', opacity: 0.7, lineHeight: 1.5 }}>
            {this.state.error.message}
          </p>
          <button
            className="action-btn secondary"
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: '0.5rem' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
