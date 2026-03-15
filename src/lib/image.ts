/**
 * Compress and crop an image file to a 256×256 square avatar.
 * Uses browser Canvas API — no external dependencies.
 * Outputs WebP (JPEG fallback for older browsers).
 */
export async function compressAvatar(file: File): Promise<Blob> {
  const SIZE = 256;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    const url = URL.createObjectURL(file);
    el.src = url;
    // Clean up object URL after load
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
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
