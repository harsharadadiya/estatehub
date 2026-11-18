import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Home, Inbox, LayoutDashboard, LogIn, LogOut, Menu, Plus, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/hooks/useRealtime';
import { features } from '@/lib/features';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/common';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 font-extrabold tracking-tight text-foreground', className)} aria-label="EstateHub home">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1F5F5B" />
        <path d="M7 15.5 16 8l9 7.5" fill="none" stroke="#F2A007" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 15v9h12v-9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M14.5 24v-4.5h3V24" fill="#fff" />
      </svg>
      <span className="text-xl">EstateHub</span>
    </Link>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-3 py-2 text-[15px] font-semibold transition-colors hover:bg-muted', isActive ? 'text-primary' : 'text-foreground/80');

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { search, pathname } = useLocation();
  const purpose = new URLSearchParams(search).get('purpose');

  function handleLogout() {
    logout();
    toast.success('You are logged out');
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-[1100] border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/properties?purpose=sale" className={() => navLink({ isActive: pathname === '/properties' && purpose === 'sale' })}>
            Buy
          </NavLink>
          <NavLink to="/properties?purpose=rent" className={() => navLink({ isActive: pathname === '/properties' && purpose === 'rent' })}>
            Rent
          </NavLink>
          <NavLink to="/properties" end className={() => navLink({ isActive: pathname === '/properties' && !purpose })}>
            All listings
          </NavLink>
          {features.aiHub && (
            <NavLink to="/ai-hub" className={navLink}>
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-marigold" aria-hidden="true" /> AI search
              </span>
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link to={user ? '/dashboard/listings/new' : '/register'} state={user ? undefined : { from: '/dashboard/listings/new' }}>
              <Plus /> List your property
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex cursor-pointer items-center gap-2 rounded-full border bg-card py-1 pr-1 pl-3 hover:bg-muted" aria-label="Open account menu">
                <Menu className="size-4" />
                {user ? <UserAvatar name={user.name} className="size-8" /> : <UserRound className="mr-1 size-6 text-muted-foreground" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {user ? (
                <>
                  <DropdownMenuLabel>
                    <p className="font-bold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
                    <LayoutDashboard /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/listings')}>
                    <Home /> My listings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/appointments')}>
                    <CalendarDays /> My viewings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/requests')}>
                    <Inbox /> Viewing requests
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut /> Log out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => navigate('/login')}>
                    <LogIn /> Log in
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/register')}>
                    <UserRound /> Create account
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="md:hidden" />
              <div className="md:hidden">
                <DropdownMenuItem onSelect={() => navigate('/properties?purpose=sale')}>Buy</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/properties?purpose=rent')}>Rent</DropdownMenuItem>
                {features.aiHub && <DropdownMenuItem onSelect={() => navigate('/ai-hub')}>AI search</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => navigate(user ? '/dashboard/listings/new' : '/register')}>List your property</DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6 lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-[15px] text-muted-foreground">Homes listed by their owners across India. No brokerage, no spam calls – book a viewing and meet the owner.</p>
        </div>
        <div className="grid content-start gap-2 text-[15px]">
          <p className="font-bold">Explore</p>
          <Link className="text-muted-foreground hover:text-foreground" to="/properties?purpose=sale">Homes for sale</Link>
          <Link className="text-muted-foreground hover:text-foreground" to="/properties?purpose=rent">Homes for rent</Link>
          {features.aiHub && <Link className="text-muted-foreground hover:text-foreground" to="/ai-hub">AI search</Link>}
        </div>
        <div className="grid content-start gap-2 text-[15px]">
          <p className="font-bold">Owners</p>
          <Link className="text-muted-foreground hover:text-foreground" to="/dashboard/listings/new">List your property</Link>
          <Link className="text-muted-foreground hover:text-foreground" to="/dashboard/requests">Viewing requests</Link>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-4 text-sm text-muted-foreground sm:px-6 lg:px-8">© {new Date().getFullYear()} EstateHub. A full stack student project.</p>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  useRealtime(user); // live updates while logged in

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[2000] focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
