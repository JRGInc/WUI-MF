import { useEffect, useState } from 'react';
import { getLocalPhotos, photoDisplayUrl } from '@/shared/services/offlineStorage';
import type { AssessmentPhoto } from '@/shared/types';

interface PhotoGalleryProps {
  assessmentId: string;
}

/**
 * Photo grid for an assessment. Resolves each photo's URL via photoDisplayUrl,
 * so locally-captured photos (object URL from their blob) and synced/pulled
 * photos (Supabase Storage URL from storagePath, blob cleared) both display.
 * Object URLs are revoked on unmount / reload to avoid leaks.
 */
export function PhotoGallery({ assessmentId }: PhotoGalleryProps) {
  const [items, setItems] = useState<{ photo: AssessmentPhoto; url: string }[]>([]);

  useEffect(() => {
    const objectUrls: string[] = [];
    let cancelled = false;

    (async () => {
      const photos = await getLocalPhotos(assessmentId);
      const resolved: { photo: AssessmentPhoto; url: string }[] = [];
      for (const photo of photos) {
        const r = photoDisplayUrl(photo);
        if (!r) continue;
        if (r.isObjectUrl) objectUrls.push(r.url);
        resolved.push({ photo, url: r.url });
      }
      if (cancelled) {
        objectUrls.forEach(URL.revokeObjectURL);
        return;
      }
      setItems(resolved);
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [assessmentId]);

  if (items.length === 0) return null;

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Photos</h2>
      </div>
      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(({ photo, url }) => (
          <div key={photo.id} className="relative">
            <img
              src={url}
              alt={photo.category}
              loading="lazy"
              className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] capitalize">
              {photo.category?.replace('-', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
