import { useState, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { getCachedModel } from '@/shared/services/offlineStorage';

interface ModelInfo {
  name: string;
  url: string;
  version: string;
  inputShape: number[];
  outputType: 'segmentation' | 'classification' | 'detection';
}

interface LoadedModel {
  model: tf.LayersModel | tf.GraphModel;
  info: ModelInfo;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  {
    name: 'vegetation-segmentation',
    url: '/models/vegetation-segmentation/model.json',
    version: '1.0.0',
    inputShape: [224, 224, 3],
    outputType: 'segmentation',
  },
  {
    name: 'roof-classifier',
    url: '/models/roof-classifier/model.json',
    version: '1.0.0',
    inputShape: [224, 224, 3],
    outputType: 'classification',
  },
  {
    name: 'debris-detector',
    url: '/models/debris-detector/model.json',
    version: '1.0.0',
    inputShape: [416, 416, 3],
    outputType: 'detection',
  },
];

export function useModelLoader() {
  const [models, setModels] = useState<Map<string, LoadedModel>>(new Map());
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());
  const [modelErrors, setModelErrors] = useState<Map<string, string>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize TensorFlow.js
    initializeTF();
  }, []);

  const initializeTF = async () => {
    try {
      await tf.ready();

      // Backend order: WebGPU (Chrome 121+ Android, modern desktops) beats WebGL
      // 3-10x on transformer-class models. Falls back if unavailable.
      const backends = ['webgpu', 'webgl', 'wasm', 'cpu'];
      for (const backend of backends) {
        try {
          await tf.setBackend(backend);
          console.log(`TensorFlow.js using ${backend} backend`);
          break;
        } catch (e) {
          console.log(`${backend} backend not available, trying next...`);
        }
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
    }
  };

  const loadModel = useCallback(
    async (modelName: string): Promise<LoadedModel | null> => {
      // Check if already loaded
      if (models.has(modelName)) {
        return models.get(modelName)!;
      }

      // Check if currently loading
      if (loadingModels.has(modelName)) {
        return null;
      }

      const modelInfo = AVAILABLE_MODELS.find((m) => m.name === modelName);
      if (!modelInfo) {
        setModelErrors((prev) => new Map(prev).set(modelName, 'Model not found'));
        return null;
      }

      setLoadingModels((prev) => new Set(prev).add(modelName));

      try {
        // Check cache first
        const cached = await getCachedModel(modelName);

        let model: tf.LayersModel | tf.GraphModel;

        if (cached && cached.version === modelInfo.version) {
          // Load from IndexedDB cache
          model = await tf.loadLayersModel(`indexeddb://${modelName}`);
        } else {
          // Load from URL
          try {
            model = await tf.loadLayersModel(modelInfo.url);
            // Save to IndexedDB for offline use
            await (model as tf.LayersModel).save(`indexeddb://${modelName}`);
          } catch (urlError) {
            // Model file doesn't exist yet - create a placeholder
            console.log(`Model ${modelName} not available, using placeholder`);
            setLoadingModels((prev) => {
              const next = new Set(prev);
              next.delete(modelName);
              return next;
            });
            return null;
          }
        }

        const loadedModel: LoadedModel = { model, info: modelInfo };

        setModels((prev) => new Map(prev).set(modelName, loadedModel));
        setModelErrors((prev) => {
          const next = new Map(prev);
          next.delete(modelName);
          return next;
        });

        return loadedModel;
      } catch (error) {
        console.error(`Error loading model ${modelName}:`, error);
        setModelErrors((prev) =>
          new Map(prev).set(modelName, error instanceof Error ? error.message : 'Unknown error')
        );
        return null;
      } finally {
        setLoadingModels((prev) => {
          const next = new Set(prev);
          next.delete(modelName);
          return next;
        });
      }
    },
    [models, loadingModels]
  );

  const unloadModel = useCallback(
    (modelName: string) => {
      const loadedModel = models.get(modelName);
      if (loadedModel) {
        loadedModel.model.dispose();
        setModels((prev) => {
          const next = new Map(prev);
          next.delete(modelName);
          return next;
        });
      }
    },
    [models]
  );

  const getModel = useCallback(
    (modelName: string): LoadedModel | undefined => {
      return models.get(modelName);
    },
    [models]
  );

  const isModelLoaded = useCallback(
    (modelName: string): boolean => {
      return models.has(modelName);
    },
    [models]
  );

  const isModelLoading = useCallback(
    (modelName: string): boolean => {
      return loadingModels.has(modelName);
    },
    [loadingModels]
  );

  const getModelError = useCallback(
    (modelName: string): string | undefined => {
      return modelErrors.get(modelName);
    },
    [modelErrors]
  );

  const preloadModels = useCallback(
    async (modelNames: string[]) => {
      await Promise.all(modelNames.map((name) => loadModel(name)));
    },
    [loadModel]
  );

  return {
    loadModel,
    unloadModel,
    getModel,
    isModelLoaded,
    isModelLoading,
    getModelError,
    preloadModels,
    isInitialized,
    availableModels: AVAILABLE_MODELS,
  };
}
