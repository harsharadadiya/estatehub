import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Home, Inbox, LayoutDashboard, UserRound } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services';

export function useSummary() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardService.summary });
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const summary = useSummary();
  const pending = summary.data?.pendingRequests ?? 0;

  const links = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/dashboard/listings', label: 'My listings', icon: Home },
    { to: '/dashboard/appointments', label: 'My viewings', icon: CalendarDays },
    { to: '/dashboard/requests', label: 'Viewing requests', icon: Inbox, count: pending },
    { to: '/dashboard/profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Seo title="Dashboard" noIndex />
      <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside>
          <p className="mb-3 hidden text-sm text-muted-foreground lg:block">
            Signed in as <b className="text-foreground">{user?.name}</b>
          </p>
          <nav aria-label="Dashboard" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0 [scrollbar-width:none]">
            {links.map(({ to, label, icon: Icon, end, count }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-foreground/75 hover:bg-muted'
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {!!count && <span className="ml-auto rounded-full bg-marigold px-2 text-xs font-bold text-marigold-foreground tabular">{count}</span>}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
