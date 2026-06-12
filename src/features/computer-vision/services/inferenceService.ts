import * as tf from '@tensorflow/tfjs';
import type { CVAnalysisResult, DetectedRisk, RoofMaterial } from '@/shared/types';

interface InferenceOptions {
  imageSize?: number;
  normalize?: boolean;
  batchSize?: number;
}

const DEFAULT_OPTIONS: InferenceOptions = {
  imageSize: 224,
  normalize: true,
  batchSize: 1,
};

export class InferenceService {
  private models: Map<string, tf.LayersModel | tf.GraphModel> = new Map();

  async preprocessImage(
    image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
    options: InferenceOptions = DEFAULT_OPTIONS
  ): Promise<tf.Tensor4D> {
    const { imageSize = 224, normalize = true } = options;

    return tf.tidy(() => {
      // Convert image to tensor
      let tensor = tf.browser.fromPixels(image);

      // Resize to expected input size
      tensor = tf.image.resizeBilinear(tensor, [imageSize, imageSize]);

      // Normalize pixel values
      if (normalize) {
        tensor = tensor.div(255.0);
      }

      // Add batch dimension
      return tensor.expandDims(0) as tf.Tensor4D;
    });
  }

  async runVegetationSegmentation(
    model: tf.LayersModel,
    inputTensor: tf.Tensor4D
  ): Promise<{
    mask: ImageData;
    coverage: number;
  }> {
    // Run inference
    const prediction = model.predict(inputTensor) as tf.Tensor;

    // Get segmentation mask
    const mask = prediction.squeeze();

    // Calculate vegetation coverage
    const values = mask.dataSync();
    const vegetationPixels = Array.from(values).filter((v) => v > 0.5).length;
    const coverage = (vegetationPixels / values.length) * 100;

    // Convert mask to ImageData for visualization
    const [height, width] = mask.shape;
    const maskData = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < values.length; i++) {
      const idx = i * 4;
      const intensity = values[i] > 0.5 ? 255 : 0;
      // Green for vegetation
      maskData[idx] = 0;
      maskData[idx + 1] = intensity;
      maskData[idx + 2] = 0;
      maskData[idx + 3] = intensity > 0 ? 128 : 0;
    }

    const imageData = new ImageData(maskData, width, height);

    // Clean up tensors
    prediction.dispose();
    mask.dispose();

    return { mask: imageData, coverage };
  }

  async runRoofClassification(
    model: tf.LayersModel,
    inputTensor: tf.Tensor4D
  ): Promise<{
    material: RoofMaterial;
    confidence: number;
  }> {
    const ROOF_CLASSES: RoofMaterial[] = [
      'asphalt-shingle',
      'metal',
      'tile',
      'wood-shake',
      'slate',
      'unknown',
    ];

    return tf.tidy(() => {
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const probabilities = prediction.dataSync();

      // Find highest probability
      let maxIdx = 0;
      let maxProb = probabilities[0];
      for (let i = 1; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          maxIdx = i;
        }
      }

      return {
        material: ROOF_CLASSES[maxIdx] || 'unknown',
        confidence: maxProb,
      };
    });
  }

  async runDebrisDetection(
    model: tf.GraphModel,
    inputTensor: tf.Tensor4D
  ): Promise<DetectedRisk[]> {
    const detections: DetectedRisk[] = [];

    // Run YOLO-style detection
    const predictions = (await model.executeAsync(inputTensor)) as tf.Tensor[];

    // Process detections (simplified for demo)
    const boxes = predictions[0].dataSync();
    const scores = predictions[1].dataSync();
    const classes = predictions[2].dataSync();

    const threshold = 0.5;
    const classNames = ['debris', 'woodpile', 'fuel-storage', 'overgrown-vegetation'];

    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > threshold) {
        const classIdx = classes[i];
        detections.push({
          type: classNames[classIdx] || 'unknown-debris',
          confidence: scores[i],
          boundingBox: {
            x: boxes[i * 4],
            y: boxes[i * 4 + 1],
            width: boxes[i * 4 + 2] - boxes[i * 4],
            height: boxes[i * 4 + 3] - boxes[i * 4 + 1],
          },
          severity: scores[i] > 0.8 ? 'high' : 'moderate',
          description: `Detected ${classNames[classIdx]} with ${Math.round(scores[i] * 100)}% confidence`,
        });
      }
    }

    // Cleanup tensors
    predictions.forEach((t) => t.dispose());

    return detections;
  }

  async analyzeCompleteImage(
    image: HTMLImageElement | ImageBitmap,
    models: {
      vegetation?: tf.LayersModel;
      roof?: tf.LayersModel;
      debris?: tf.GraphModel;
    }
  ): Promise<CVAnalysisResult> {
    const startTime = performance.now();
    const results: Partial<CVAnalysisResult> = {
      detectedRisks: [],
      confidence: 0,
    };

    // Preprocess image
    const inputTensor = await this.preprocessImage(image);

    try {
      // Run vegetation segmentation
      if (models.vegetation) {
        const vegResult = await this.runVegetationSegmentation(
          models.vegetation,
          inputTensor
        );
        results.vegetationCoverage = vegResult.coverage;
        results.vegetationScore = Math.max(1, Math.round((1 - vegResult.coverage / 100) * 10));

        if (vegResult.coverage > 60) {
          results.detectedRisks!.push({
            type: 'High Vegetation Coverage',
            confidence: 0.9,
            severity: vegResult.coverage > 80 ? 'high' : 'moderate',
            description: `${Math.round(vegResult.coverage)}% vegetation coverage detected`,
          });
        }
      }

      // Run roof classification
      if (models.roof) {
        const roofResult = await this.runRoofClassification(models.roof, inputTensor);
        results.roofMaterial = roofResult.material;

        if (roofResult.material === 'wood-shake' && roofResult.confidence > 0.7) {
          results.detectedRisks!.push({
            type: 'Combustible Roof Material',
            confidence: roofResult.confidence,
            severity: 'high',
            description: 'Wood shake roofing detected - highly vulnerable to ember ignition',
          });
        }
      }

      // Run debris detection
      if (models.debris) {
        const debrisDetections = await this.runDebrisDetection(
          models.debris,
          inputTensor
        );
        results.detectedRisks = [...results.detectedRisks!, ...debrisDetections];

        if (debrisDetections.length > 3) {
          results.debrisLevel = 'heavy';
        } else if (debrisDetections.length > 1) {
          results.debrisLevel = 'moderate';
        } else if (debrisDetections.length > 0) {
          results.debrisLevel = 'light';
        } else {
          results.debrisLevel = 'none';
        }
      }

      // Calculate overall confidence
      results.confidence =
        results.detectedRisks!.length > 0
          ? results.detectedRisks!.reduce((acc, r) => acc + r.confidence, 0) /
            results.detectedRisks!.length
          : 0.5;
    } finally {
      inputTensor.dispose();
    }

    results.processingTime = performance.now() - startTime;

    return results as CVAnalysisResult;
  }

  dispose() {
    this.models.forEach((model) => model.dispose());
    this.models.clear();
  }
}

export const inferenceService = new InferenceService();
