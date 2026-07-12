import { Component, type ErrorInfo, type ReactNode } from "react";

export class ConsoleErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Console]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#080810]">
          <p className="text-[13px] text-[#ff4d6d] font-medium">
            Console failed to render
          </p>
          <p className="text-[12px] text-[#8888a0] max-w-md leading-relaxed">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
            className="h-8 px-3 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer bg-transparent text-[12px]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}