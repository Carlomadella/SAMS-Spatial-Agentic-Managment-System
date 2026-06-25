import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render errors so a crash shows a friendly screen, not a white page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SAMS crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-ink-950 p-6 text-center">
          <div className="text-3xl">🛠️</div>
          <h1 className="text-lg font-semibold text-white">Qualcosa è andato storto</h1>
          <p className="max-w-md break-words text-sm text-mut">{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary mt-2">
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
