import * as React from "react";

type State = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};
type BoundaryProps = {
  children: React.ReactNode;
};
export default class TestErrorBoundary extends React.PureComponent<
  BoundaryProps,
  State
> {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
    };
    this.retry = this.retry.bind(this);
  }

  componentDidCatch(error, errorInfo) {
    this.setState((old) => ({
      ...old,
      error,
      errorInfo,
    }));
  }

  retry() {
    this.setState((old) => ({
      error: null,
      errorInfo: null,
    }));
  }

  render() {
    const {children} = this.props;
    const {error, errorInfo} = this.state;

    if (errorInfo) {
      return (
        <span data-testid="error-boundary">{error?.toString?.()}</span>
      );
    }
    return children
  }
}
