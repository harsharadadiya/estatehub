// Photo gallery: one large photo + up to three thumbnails, and a full-screen viewer.
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { SafeImage } from '@/components/common';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PropertyImage } from '@/types';

export function PropertyGallery({ images, title }: { images: PropertyImage[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const step = useCallback((dir: number) => setIndex((i) => (i + dir + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const [first, ...rest] = images;

  return (
    <>
      <div className={cn('grid gap-2 overflow-hidden rounded-2xl md:h-[460px]', rest.length > 0 && 'md:grid-cols-[2fr_1fr]')}>
        <button type="button" onClick={() => show(0)} className="relative block aspect-[16/10] min-h-0 cursor-zoom-in overflow-hidden bg-muted md:aspect-auto md:h-full">
          <SafeImage src={first?.url} width={1400} alt={`${title} – photo 1`} className="size-full" loading="eager" />
        </button>
        {rest.length > 0 && (
          <div className={cn('hidden min-h-0 gap-2 md:grid', rest.length === 1 ? 'grid-rows-1' : rest.length === 2 ? 'grid-rows-2' : 'grid-rows-3')}>
            {rest.map((img, i) => (
              <button key={img.fileId} type="button" onClick={() => show(i + 1)} className="min-h-0 cursor-zoom-in overflow-hidden bg-muted">
                <SafeImage src={img.url} width={600} alt={`${title} – photo ${i + 2}`} className="size-full transition-opacity hover:opacity-90" />
              </button>
            ))}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <Button variant="outline" size="sm" className="mt-3 md:hidden" onClick={() => show(0)}>
          <Images /> See all {images.length} photos
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl gap-3 p-3 sm:p-4">
          <DialogTitle className="sr-only">{title} photos</DialogTitle>
          <DialogDescription className="px-1 text-sm tabular">
            Photo {index + 1} of {images.length}
          </DialogDescription>
          <div className="relative">
            <SafeImage src={images[index]?.url} width={1800} alt={`${title} – photo ${index + 1}`} className="max-h-[75dvh] w-full rounded-lg bg-muted object-contain" />
            {images.length > 1 && (
              <>
                <Button variant="outline" size="icon" className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full" onClick={() => step(-1)} aria-label="Previous photo">
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full" onClick={() => step(1)} aria-label="Next photo">
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
