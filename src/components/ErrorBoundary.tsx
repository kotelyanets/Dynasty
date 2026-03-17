import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'white', overflow: 'auto', height: '100%', width: '100%', zIndex: 9999, position: 'absolute', top: 0, left: 0 }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Crash in Component!</h1>
          <p style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '18px' }}>{this.state.error?.toString()}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: '#8b0000', padding: '10px', borderRadius: '4px' }}>
            {this.state.error?.stack}
            {'\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
