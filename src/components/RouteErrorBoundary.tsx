import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Route-level Error Boundary for React Router
 * 
 * Catches errors that occur during route rendering, data loading,
 * or route component lifecycle. Displays a user-friendly error page
 * instead of a blank screen.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage = 'An unexpected error occurred';
  let errorDetails: string | null = null;

  if (isRouteErrorResponse(error)) {
    // Handle route errors (404, 403, etc.)
    errorMessage = error.statusText || `Error ${error.status}`;
    errorDetails = error.data as string || null;
  } else if (error instanceof Error) {
    // Handle JavaScript errors
    errorMessage = error.message || 'An unexpected error occurred';
    errorDetails = error.stack || null;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">Route Error</CardTitle>
              <CardDescription>
                Something went wrong while loading this page. Please try again.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription className="mt-2">
              <code className="text-xs bg-muted p-2 rounded block overflow-auto">
                {errorMessage}
              </code>
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => navigate('/')} variant="default">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && errorDetails && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Stack Trace (Development Only)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-4 rounded overflow-auto max-h-64">
                {errorDetails}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Wrapper component that provides error boundary for individual routes
 */
interface RouteErrorBoundaryWrapperProps {
  children: ReactNode;
}

interface RouteErrorBoundaryWrapperState {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundaryWrapper extends Component<
  RouteErrorBoundaryWrapperProps,
  RouteErrorBoundaryWrapperState
> {
  constructor(props: RouteErrorBoundaryWrapperProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryWrapperState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Page Error</CardTitle>
                  <CardDescription>
                    This page encountered an error. Please try refreshing or navigating away.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {this.state.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {this.state.error.message || 'An unexpected error occurred'}
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={() => window.location.reload()} variant="default">
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

