import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getLocalAnnotations,
  saveAnnotationLocally,
  updateAnnotationLocally,
  deleteAnnotationLocally,
} from '@/shared/services/offlineStorage';
import type {
  AnnotationContent,
  AnnotationType,
  GeoCoordinates,
  MapAnnotation,
} from '@/shared/types';

interface NewAnnotation {
  coordinates: GeoCoordinates;
  annotationType: AnnotationType;
  content: AnnotationContent;
}

/**
 * Read/write the MapAnnotations attached to an assessment. Backed by Dexie via
 * the offlineStorage helpers, so a marker placed here is the same record the AR
 * viewer reads (and vice versa). No-ops with an empty list when there is no
 * assessment in context (annotations are always assessment-scoped).
 */
export function useAnnotations(assessmentId?: string) {
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!assessmentId) {
      setAnnotations([]);
      return;
    }
    setIsLoading(true);
    try {
      setAnnotations(await getLocalAnnotations(assessmentId));
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addAnnotation = useCallback(
    async (input: NewAnnotation): Promise<MapAnnotation | null> => {
      if (!assessmentId) return null;
      const annotation: MapAnnotation = {
        id: uuidv4(),
        assessmentId,
        coordinates: input.coordinates,
        annotationType: input.annotationType,
        content: input.content,
        createdAt: new Date().toISOString(),
      };
      await saveAnnotationLocally(annotation);
      setAnnotations((prev) => [...prev, annotation]);
      return annotation;
    },
    [assessmentId]
  );

  const updateAnnotation = useCallback(
    async (id: string, updates: Partial<MapAnnotation>) => {
      await updateAnnotationLocally(id, updates);
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    },
    []
  );

  const removeAnnotation = useCallback(async (id: string) => {
    await deleteAnnotationLocally(id);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    annotations,
    isLoading,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    refresh,
  };
}
