import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <Seo title="Page not found" noIndex />
      <span className="price-tag text-2xl">404</span>
      <h1 className="mt-6 text-2xl font-extrabold">This page does not exist</h1>
      <p className="mt-2 text-muted-foreground">The link may be old or mistyped. Listings that were sold or removed also end up here.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/properties">Browse listings</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Home page</Link>
        </Button>
      </div>
    </div>
  );
}
