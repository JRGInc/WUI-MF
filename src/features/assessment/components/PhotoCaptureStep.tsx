import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  CameraIcon,
  PhotoIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useImageAnalysis } from '@/features/computer-vision/hooks/useImageAnalysis';
import { HAZARD_TAGS } from '@/shared/types';
import type {
  AssessmentPhoto,
  Finding,
  CategoryScores,
  RiskCategory,
  HazardTag,
} from '@/shared/types';

interface PhotoCaptureStepProps {
  photos: AssessmentPhoto[];
  onUpdate: (photos: AssessmentPhoto[]) => void;
  onAnalysisComplete: (findings: Finding[], scores: Partial<CategoryScores>) => void;
}

const HAZARD_TAG_LABELS: Record<HazardTag, string> = {
  'dry-dead-vegetation': 'Dry / dead vegetation',
  'ground-fuels': 'Ground fuels',
  'overhanging-vegetation': 'Overhanging branches',
  'vegetation-near-structure': 'Vegetation near structure',
  'woodpile-lumber': 'Woodpile / lumber',
  'propane-tank': 'Propane tank',
  'wood-shake-roof': 'Wood shake roof',
  'roof-debris': 'Roof debris',
  'gutter-debris': 'Gutter debris',
  'combustible-fence': 'Combustible fence (to house)',
  'combustible-mulch': 'Combustible mulch (within 5 ft)',
  'no-hazards-visible': 'No hazards visible',
};

const photoCategories: { id: RiskCategory; name: string; description: string }[] = [
  {
    id: 'defensible-space',
    name: 'Defensible Space',
    description: 'Photos of the area 0-100 feet around your home',
  },
  {
    id: 'roof-structure',
    name: 'Roof & Structure',
    description: 'Photos of your roof, siding, and exterior materials',
  },
  {
    id: 'vegetation',
    name: 'Vegetation',
    description: 'Photos of trees, shrubs, and landscaping',
  },
  {
    id: 'ember-intrusion',
    name: 'Vents & Openings',
    description: 'Photos of vents, eaves, and potential ember entry points',
  },
];

export function PhotoCaptureStep({
  photos,
  onUpdate,
  onAnalysisComplete,
}: PhotoCaptureStepProps) {
  const [selectedCategory, setSelectedCategory] = useState<RiskCategory>('defensible-space');
  const [isCapturing, setIsCapturing] = useState(false);
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [taggingPhotoId, setTaggingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { analyzeImage, isAnalyzing } = useImageAnalysis();

  const handleCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Consent applies assessment-wide: flipping it updates existing photos too.
  const handleConsentChange = (consent: boolean) => {
    setTrainingConsent(consent);
    onUpdate(photos.map((p) => ({ ...p, trainingConsent: consent })));
  };

  const toggleHazardTag = (photoId: string, tag: HazardTag) => {
    onUpdate(
      photos.map((p) => {
        if (p.id !== photoId) return p;
        const tags = p.hazardTags ?? [];
        return {
          ...p,
          hazardTags: tags.includes(tag)
            ? tags.filter((t) => t !== tag)
            : [...tags, tag],
        };
      })
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCapturing(true);

    // Accumulate locally — `photos` is a stale closure inside this async loop.
    let current = [...photos];

    for (const file of Array.from(files)) {
      const photo: AssessmentPhoto = {
        id: uuidv4(),
        assessmentId: '', // Will be set when assessment is created
        storagePath: '',
        category: selectedCategory,
        capturedAt: new Date().toISOString(),
        localBlob: file,
        syncStatus: 'pending',
        trainingConsent,
        hazardTags: [],
      };

      // Add photo to list
      current = [...current, photo];
      onUpdate(current);

      // Analyze the image
      try {
        const result = await analyzeImage(file);
        if (result) {
          // Update photo with analysis results
          photo.analysisResults = result;
          current = current.map((p) => (p.id === photo.id ? photo : p));
          onUpdate(current);

          // Convert detected risks to findings
          const findings: Finding[] = result.detectedRisks.map((risk) => ({
            id: uuidv4(),
            category: selectedCategory,
            severity: risk.severity,
            title: risk.type,
            description: risk.description,
            photoIds: [photo.id],
          }));

          // Calculate scores based on analysis
          const scores: Partial<CategoryScores> = {};
          if (selectedCategory === 'vegetation' || selectedCategory === 'defensible-space') {
            scores.vegetationManagement = Math.round(
              (1 - result.vegetationCoverage / 100) * 10
            );
            scores.defensibleSpace = result.vegetationScore;
          }

          onAnalysisComplete(findings, scores);
        }
      } catch (error) {
        console.error('Error analyzing image:', error);
      }
    }

    setIsCapturing(false);
    e.target.value = ''; // Reset input
  };

  const removePhoto = (photoId: string) => {
    onUpdate(photos.filter((p) => p.id !== photoId));
    if (taggingPhotoId === photoId) setTaggingPhotoId(null);
  };

  const categoryPhotos = photos.filter((p) => p.category === selectedCategory);
  const taggingPhoto = photos.find((p) => p.id === taggingPhotoId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Photo Capture
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Take photos of your property for AI-powered risk analysis.
        </p>
      </div>

      {/* Training-data consent */}
      <label className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-fire-300 transition-colors">
        <input
          type="checkbox"
          checked={trainingConsent}
          onChange={(e) => handleConsentChange(e.target.checked)}
          className="mt-0.5 rounded border-gray-300 text-fire-600 focus:ring-fire-500"
        />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-white">
            Contribute photos to improve hazard detection
          </span>
          <span className="block mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            If enabled, photos from this assessment (with the hazard tags you add)
            may be used to train the app's on-device detection models. Photos are
            not shared publicly, and you can tag visible hazards after capturing.
          </span>
        </span>
      </label>

      {/* Category Selection */}
      <div className="grid grid-cols-2 gap-3">
        {photoCategories.map((category) => {
          const count = photos.filter((p) => p.category === category.id).length;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                selectedCategory === category.id
                  ? 'border-fire-500 bg-fire-50 dark:bg-fire-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-fire-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {category.name}
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center rounded-full bg-fire-100 dark:bg-fire-900/30 px-2 py-0.5 text-xs font-medium text-fire-800 dark:text-fire-200">
                    {count}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {category.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Capture Button */}
      <div className="flex justify-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={handleCapture}
          disabled={isCapturing || isAnalyzing}
          className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-dashed border-gray-300 dark:border-gray-600 hover:border-fire-500 transition-colors"
        >
          {isCapturing || isAnalyzing ? (
            <ArrowPathIcon className="w-8 h-8 text-fire-500 animate-spin" />
          ) : (
            <CameraIcon className="w-8 h-8 text-gray-400" />
          )}
          <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {isAnalyzing ? 'Analyzing...' : 'Take Photo'}
          </span>
        </button>
      </div>

      {/* Photo Grid */}
      {categoryPhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {categoryPhotos.map((photo) => (
            <div
              key={photo.id}
              onClick={() =>
                trainingConsent &&
                setTaggingPhotoId((id) => (id === photo.id ? null : photo.id))
              }
              className={`relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 ${
                trainingConsent ? 'cursor-pointer' : ''
              } ${taggingPhotoId === photo.id ? 'ring-2 ring-fire-500' : ''}`}
            >
              {photo.localBlob && (
                <img
                  src={URL.createObjectURL(photo.localBlob)}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Hazard tag count */}
              {trainingConsent && (photo.hazardTags?.length ?? 0) > 0 && (
                <div className="absolute bottom-2 left-2">
                  <span className="inline-flex items-center rounded-full bg-fire-100 px-2 py-0.5 text-xs font-medium text-fire-800">
                    {photo.hazardTags!.length} tag{photo.hazardTags!.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Analysis Status */}
              <div className="absolute top-2 left-2">
                {photo.analysisResults ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                    Analyzed
                  </span>
                ) : isAnalyzing ? (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                    Analyzing
                  </span>
                ) : null}
              </div>

              {/* Risk Indicator */}
              {photo.analysisResults && photo.analysisResults.detectedRisks.length > 0 && (
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                    {photo.analysisResults.detectedRisks.length}
                  </span>
                </div>
              )}

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(photo.id);
                }}
                className="absolute bottom-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hazard tagging for the selected photo */}
      {trainingConsent && categoryPhotos.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {taggingPhoto
              ? 'Tag hazards visible in the selected photo'
              : 'Tap a photo to tag the hazards visible in it'}
          </h3>
          {taggingPhoto && (
            <div className="mt-3 flex flex-wrap gap-2">
              {HAZARD_TAGS.map((tag) => {
                const active = taggingPhoto.hazardTags?.includes(tag) ?? false;
                return (
                  <button
                    key={tag}
                    onClick={() => toggleHazardTag(taggingPhoto.id, tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-fire-600 border-fire-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-fire-400'
                    }`}
                  >
                    {HAZARD_TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <div className="text-center py-8">
          <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No photos yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Take photos of each area for AI analysis of fire risks.
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4">
        <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Photo Tips
        </h3>
        <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
          <li>• Take photos in good lighting for best analysis results</li>
          <li>• Include the full area you want to assess in each photo</li>
          <li>• Take multiple photos from different angles</li>
          <li>• Photos are analyzed on your device for privacy</li>
        </ul>
      </div>
    </div>
  );
}
