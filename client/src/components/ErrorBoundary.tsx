import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to error tracking service in production
    if (import.meta.env.PROD) {
      // TODO: Send to error tracking service (e.g., Sentry)
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = () => {
    // Reset error state and force remount by updating key
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    }, () => {
      // Force a full remount by reloading the page
      // This ensures the failed component tree is completely reset
      window.location.reload();
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-background">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle>Something went wrong</CardTitle>
                  <CardDescription>
                    We encountered an unexpected error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The application encountered an error and couldn't continue. 
                Please try refreshing the page or return to the home page.
              </p>
              
              {import.meta.env.DEV && this.state.error && (
                <details className="rounded-md bg-muted p-4">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="text-xs overflow-auto">
                    <code>
                      {this.state.error.toString()}
                      {'\n\n'}
                      {this.state.error.stack}
                    </code>
                  </pre>
                </details>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                onClick={this.handleReset} 
                variant="default"
                className="flex-1"
                data-testid="button-retry"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={this.handleGoHome} 
                variant="outline"
                className="flex-1"
                data-testid="button-home"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WidgetProps {
  children: ReactNode;
  name?: string;
}

interface WidgetState {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<WidgetProps, WidgetState> {
  constructor(props: WidgetProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<WidgetState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.name || 'Widget'}] Error:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {this.props.name ? `${this.props.name} encountered an issue` : 'Something went wrong'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Try again or return to the home page
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={this.handleRetry}
              data-testid="button-widget-retry"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { window.location.href = '/'; }}
              data-testid="button-widget-home"
            >
              <Home className="mr-1.5 h-3.5 w-3.5" />
              Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
