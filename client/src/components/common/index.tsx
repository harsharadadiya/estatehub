// Small reusable building blocks used across many pages.
import { useState, type ComponentProps, type ReactNode } from 'react';
import { AlertTriangle, Eye, EyeOff, ImageOff, SearchX, type LucideIcon } from 'lucide-react';
import CircularProgress from '@mui/material/CircularProgress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { initials } from '@/lib/format';
import { imageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

/** Full-area spinner (MUI) for page and data loading */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-muted-foreground" role="status" aria-live="polite">
      <CircularProgress size={34} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** "Nothing here yet" – always says what to do next */
export function EmptyState({ icon: Icon = SearchX, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-input bg-card/60 px-6 py-14 text-center', className)}>
      <Icon className="mb-3 size-8 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
      <h3 className="text-lg font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-[15px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** "Something went wrong" – shows the real reason and a retry button */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-2xl border border-orange-200 bg-orange-50/70 px-6 py-12 text-center', className)}>
      <AlertTriangle className="mb-3 size-8 text-destructive" aria-hidden="true" />
      <h3 className="text-lg font-bold">Could not load this</h3>
      <p className="mt-1 max-w-md text-[15px] text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Label + field + error message */
export function FormField({ label, htmlFor, error, hint, className, children }: { label?: ReactNode; htmlFor?: string; error?: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function PasswordInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** <img> with lazy loading, CDN resizing and a placeholder when the link is broken */
export function SafeImage({ src, alt, width, className, ...props }: Omit<ComponentProps<'img'>, 'src' | 'width'> & { src?: string | null; width?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)} role="img" aria-label={alt}>
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    );
  }
  return <img src={imageUrl(src, width)} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn('object-cover', className)} {...props} />;
}

export function UserAvatar({ name, className }: { name?: string; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback>{initials(name) || '?'}</AvatarFallback>
    </Avatar>
  );
}

/** "Are you sure?" dialog. The confirm button names the exact action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Keep it',
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* the caller shows the error */
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
