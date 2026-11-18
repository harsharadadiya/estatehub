import type { ReactNode } from 'react';
import { Seo } from '@/components/common/Seo';

export function AuthShell({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center px-4 py-12 sm:items-center">
      <Seo title={title} noIndex />
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[15px] text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

/** Same password rules as the API */
export const PASSWORD_RULES = 'At least 8 characters, with a letter and a number';
