// Image storage.
//  • ImageKit (CDN) when IMAGEKIT_PRIVATE_KEY is set – use this in production.
//  • Local folder "server/uploads" otherwise – handy for local development only
//    (hosting platforms like Render delete local files on every deploy).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import type { IPropertyImage } from '../models/Property.js';
import { AppError } from '../utils/AppError.js';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

type ImageKind = { ext: 'jpg' | 'png' | 'webp'; mime: string };

/** Checks the real file content ("magic bytes"), not just the file name, so fake images are rejected */
export function detectImageType(buffer: Buffer): ImageKind | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: 'png', mime: 'image/png' };
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
    return { ext: 'webp', mime: 'image/webp' };
  return null;
}

async function uploadToImageKit(file: Express.Multer.File, kind: ImageKind): Promise<IPropertyImage> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file.buffer)], { type: kind.mime }), `property.${kind.ext}`);
  form.append('fileName', `property-${Date.now()}.${kind.ext}`);
  form.append('folder', env.IMAGEKIT_FOLDER);
  form.append('useUniqueFileName', 'true');

  const response = await fetch(env.IMAGEKIT_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await response.json().catch(() => ({}))) as { fileId?: string; url?: string; message?: string };
  if (!response.ok || !data.fileId || !data.url) {
    console.error('ImageKit upload failed:', response.status, data.message);
    throw new AppError(
      response.status === 401 || response.status === 403
        ? 'Image upload failed: ImageKit rejected the private key. Check IMAGEKIT_PRIVATE_KEY.'
        : 'Image upload failed. Please try again.',
      502
    );
  }
  return { url: data.url, fileId: data.fileId, provider: 'imagekit' };
}

async function saveLocally(file: Express.Multer.File, kind: ImageKind): Promise<IPropertyImage> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${kind.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), file.buffer);
  return { url: `/uploads/${fileName}`, fileId: fileName, provider: 'local' };
}

/**
 * Uploads all images. If any upload fails, the ones already uploaded are deleted again,
 * so we never leave half-finished uploads behind.
 */
export async function uploadImages(files: Express.Multer.File[]): Promise<IPropertyImage[]> {
  const kinds = files.map((file) => {
    const kind = detectImageType(file.buffer);
    if (!kind) throw new AppError(`"${file.originalname}" is not a valid JPG, PNG or WebP image`, 400);
    return kind;
  });

  const uploaded: IPropertyImage[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const kind = kinds[index]!;
      uploaded.push(env.storageDriver === 'imagekit' ? await uploadToImageKit(file, kind) : await saveLocally(file, kind));
    }
    return uploaded;
  } catch (error) {
    await deleteImages(uploaded);
    throw error;
  }
}

/** Deletes images from ImageKit / the uploads folder. Never throws (best effort). */
export async function deleteImages(images: IPropertyImage[]): Promise<void> {
  await Promise.all(
    images.map(async (image) => {
      try {
        if (image.provider === 'imagekit') {
          if (!env.IMAGEKIT_PRIVATE_KEY) return;
          const response = await fetch(`${env.IMAGEKIT_API_URL}/files/${encodeURIComponent(image.fileId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Basic ${Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}` },
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok && response.status !== 404) console.warn(`ImageKit delete ${image.fileId} failed: ${response.status}`);
        } else {
          // basename() blocks "../" tricks
          await fs.rm(path.join(UPLOAD_DIR, path.basename(image.fileId)), { force: true });
        }
      } catch (error) {
        console.warn(`Could not delete image ${image.fileId}: ${(error as Error).message}`);
      }
    })
  );
}
