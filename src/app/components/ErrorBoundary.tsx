'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error('Uncaught error:', error, errorInfo);
  }

  private getErrorMessage(error: Error | null): string {
    if (!error) return 'An unexpected error occurred';

    // Handle specific React errors
    if (error.message.includes('Objects are not valid as a React child')) {
      return 'There was an error rendering the content. This is usually caused by trying to display an object directly. Please refresh the page or try again later.';
    }

    return error.message;
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full p-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
              <p className="text-gray-600 mb-4">
                {this.getErrorMessage(this.state.error)}
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Reload page
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="block w-full text-sm text-gray-600 hover:text-gray-900"
                >
                  Go back to previous page
                </button>
              </div>
              {typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4 text-left">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto">
                    {this.state.error && this.state.error.toString()}
                    <br />
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 