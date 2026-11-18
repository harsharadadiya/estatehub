// Catches unexpected crashes and shows a helpful screen instead of a blank page.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed:', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    // A new deployment can remove old page files; reloading fetches the new ones
    const isChunkError = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-extrabold">{isChunkError ? 'A new version is available' : 'This page stopped working'}</h1>
        <p className="max-w-md text-muted-foreground">
          {isChunkError ? 'Reload to get the latest version of EstateHub.' : 'Reload the page to try again. If it keeps happening, go back to the home page.'}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Go to home page
          </Button>
        </div>
      </div>
    );
  }
}
