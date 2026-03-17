/**
 * Compress and crop an image file to a 256×256 square avatar.
 * Uses browser Canvas API — no external dependencies.
 * Outputs WebP (JPEG fallback for older browsers).
 */
export async function compressAvatar(file: File): Promise<Blob> {
  const SIZE = 256;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const url = URL.createObjectURL(file);
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = reject;
    el.src = url;
  });

  // Center-crop to square, then scale to SIZE×SIZE
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const min = Math.min(img.width, img.height);
  const sx = (img.width - min) / 2;
  const sy = (img.height - min) / 2;

  ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);

  // Try WebP first, fall back to JPEG
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/webp',
      0.8,
    );
  });

  // If browser doesn't support WebP, toBlob returns PNG — check and retry as JPEG
  if (blob.type !== 'image/webp') {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        0.85,
      );
    });
  }

  return blob;
}

/**
 * Compress a chat image to max 800px on longest side.
 * Preserves aspect ratio (no cropping). Outputs JPEG for smaller size.
 */
export async function compressChatImage(file: File): Promise<Blob> {
  const MAX = 800;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const url = URL.createObjectURL(file);
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = reject;
    el.src = url;
  });

  // Scale down preserving aspect ratio
  let w = img.width;
  let h = img.height;
  if (w > MAX || h > MAX) {
    const ratio = Math.min(MAX / w, MAX / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.8,
    );
  });
}
