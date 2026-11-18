// Multi-image picker: drag & drop or browse, up to 4 photos, previews, remove, choose the cover.
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Star, X } from 'lucide-react';
import { imageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

export type UploadItem =
  | { kind: 'existing'; id: string; fileId: string; url: string }
  | { kind: 'new'; id: string; file: File; preview: string };

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  items: UploadItem[];
  onChange: (items: UploadItem[]) => void;
  max: number;
  error?: string;
}

export function ImageUploader({ items, onChange, max, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  // Free the memory used by preview URLs when they are no longer shown
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => i.kind === 'new' && URL.revokeObjectURL(i.preview)), []);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setLocalError('');
    const room = max - items.length;
    const accepted: UploadItem[] = [];
    const problems: string[] = [];
    for (const file of Array.from(fileList)) {
      if (!TYPES.includes(file.type)) problems.push(`${file.name}: use JPG, PNG or WebP`);
      else if (file.size > MAX_SIZE) problems.push(`${file.name}: larger than 5 MB`);
      else if (accepted.length >= room) problems.push(`Only ${max} photos allowed`);
      else accepted.push({ kind: 'new', id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    if (problems.length) setLocalError([...new Set(problems)].join('. '));
    if (accepted.length) onChange([...items, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.kind === 'new') URL.revokeObjectURL(item.preview);
    onChange(items.filter((i) => i.id !== id));
  }

  function makeCover(id: string) {
    const item = items.find((i) => i.id === id);
    if (item) onChange([item, ...items.filter((i) => i.id !== id)]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  const message = localError || error;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item, index) => (
          <figure key={item.id} className={cn('group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted', index === 0 && 'ring-2 ring-marigold ring-offset-2')}>
            <img src={item.kind === 'new' ? item.preview : imageUrl(item.url, 400)} alt={`Photo ${index + 1}`} className="size-full object-cover" />
            {index === 0 ? (
              <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-marigold px-1.5 py-0.5 text-xs font-bold text-marigold-foreground">Cover</figcaption>
            ) : (
              <button type="button" onClick={() => makeCover(item.id)} className="absolute bottom-1.5 left-1.5 flex cursor-pointer items-center gap-1 rounded bg-card/95 px-1.5 py-0.5 text-xs font-semibold shadow-sm hover:bg-card">
                <Star className="size-3" /> Make cover
              </button>
            )}
            <button type="button" onClick={() => remove(item.id)} className="absolute top-1.5 right-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-card/95 shadow-sm hover:bg-card" aria-label={`Remove photo ${index + 1}`}>
              <X className="size-4" />
            </button>
          </figure>
        ))}

        {items.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center text-sm transition-colors',
              dragging ? 'border-primary bg-accent' : 'border-input bg-card hover:border-primary',
              message && 'border-destructive'
            )}
          >
            <ImagePlus className="size-6 text-primary" />
            <span className="font-semibold">Add photos</span>
            <span className="text-xs text-muted-foreground tabular">
              {items.length} of {max} added
            </span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={TYPES.join(',')} multiple hidden onChange={(e) => addFiles(e.target.files)} />
      {message ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {message}
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">Up to {max} photos, JPG, PNG or WebP, 5 MB each. The first photo is the cover.</p>
      )}
    </div>
  );
}
