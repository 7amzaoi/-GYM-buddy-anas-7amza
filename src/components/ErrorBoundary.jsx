import { Component } from 'react';

/**
 * Catches render-time errors in the page tree so one broken chart or modal
 * doesn't blank the whole app. Resets when the user navigates (pathname dep).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleReload = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <div className="error-boundary-icon" aria-hidden>!</div>
        <h2>Something broke on this screen</h2>
        <p>{String(this.state.error?.message || this.state.error || 'Unknown error')}</p>
        <div className="error-boundary-actions">
          <button type="button" className="gx-btn gx-btn-ghost" onClick={this.handleReload}>
            Try again
          </button>
          <button type="button" className="gx-btn gx-btn-primary" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
