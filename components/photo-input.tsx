'use client';
import { Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import { m } from '@/messages';

/** Shrinks a camera photo to a small JPEG so it uploads fast on mobile data. */
async function resize(file: File, max = 640): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function PhotoInput({ initialUrl, onChange }: { initialUrl?: string | null; onChange: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <label className="relative flex cursor-pointer flex-col items-center gap-2 self-center">
      {preview ? (
        <img src={preview} alt="" className="size-[104px] rounded-full object-cover" />
      ) : (
        <span className="border-line bg-surface-2 text-muted flex size-[104px] items-center justify-center rounded-full border-2 border-dashed">
          <Camera className="size-9" strokeWidth={1.8} aria-hidden />
        </span>
      )}
      <span className="text-primary-ink flex min-h-8 items-center text-[15px] font-extrabold">{preview ? m.form.changePhoto : m.form.photo}</span>
      <input
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const small = await resize(f);
          setPreview(URL.createObjectURL(small));
          onChange(small);
        }}
      />
    </label>
  );
}
