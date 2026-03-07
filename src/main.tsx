import { StrictMode, Component, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', fontFamily: 'sans-serif', color: '#fff', padding: '2rem', textAlign: 'center' }}>
          <div>
            <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>Something went wrong</h2>
            <code style={{ display: 'block', background: '#18181b', padding: '1rem', borderRadius: '8px', color: '#a78bfa', textAlign: 'left', maxWidth: '600px', wordBreak: 'break-all' }}>
              {err.message}
            </code>
            <button onClick={() => window.location.reload()} style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
