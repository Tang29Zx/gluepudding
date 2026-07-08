import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

interface WorldModuleErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
  resetKey: string;
}

interface WorldModuleErrorBoundaryState {
  hasError: boolean;
}

// React error boundaries require class components.
export class WorldModuleErrorBoundary extends Component<
  WorldModuleErrorBoundaryProps,
  WorldModuleErrorBoundaryState
> {
  public state: WorldModuleErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): WorldModuleErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    console.warn("World module failed; keeping 3D world active.");
    this.props.onError();
  }

  public componentDidUpdate(
    previousProps: WorldModuleErrorBoundaryProps,
  ): void {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
