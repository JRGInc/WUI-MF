import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  HomeIcon,
  CameraIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOffline } from '@/app/providers/OfflineProvider';
import {
  saveAssessmentLocally,
  savePhotoLocally,
  savePropertyLocally,
} from '@/shared/services/offlineStorage';
import { supabase } from '@/shared/services/supabaseClient';
import { showSuccessToast, showErrorToast } from '@/shared/stores/toastStore';
import { PropertyInfoStep } from './components/PropertyInfoStep';
import { PhotoCaptureStep } from './components/PhotoCaptureStep';
import { ChecklistStep } from './components/ChecklistStep';
import { ResultsStep } from './components/ResultsStep';
import type { Assessment, Property, AssessmentPhoto, Finding, CategoryScores } from '@/shared/types';

const steps = [
  {
    id: 'property',
    title: 'Property Info',
    description: 'Enter property details',
    icon: HomeIcon,
  },
  {
    id: 'photos',
    title: 'Photo Capture',
    description: 'Take assessment photos',
    icon: CameraIcon,
  },
  {
    id: 'checklist',
    title: 'Inspection',
    description: 'Complete risk checklist',
    icon: ClipboardDocumentListIcon,
  },
  {
    id: 'results',
    title: 'Results',
    description: 'View assessment results',
    icon: ChartBarIcon,
  },
];

interface WizardData {
  property: Partial<Property>;
  photos: AssessmentPhoto[];
  checklistResponses: Record<string, boolean | string>;
  findings: Finding[];
  categoryScores: CategoryScores;
}

export default function AssessmentWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, syncNow } = useOffline();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    property: {},
    photos: [],
    checklistResponses: {},
    findings: [],
    categoryScores: {
      defensibleSpace: 0,
      roofAndStructure: 0,
      vegetationManagement: 0,
      accessAndEvacuation: 0,
      waterSupply: 0,
      emberIntrusion: 0,
    },
  });

  const updateWizardData = useCallback((updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: // Property Info
        return wizardData.property.address && wizardData.property.address.length > 0;
      case 1: // Photos
        return wizardData.photos.length > 0;
      case 2: // Checklist
        return Object.keys(wizardData.checklistResponses).length > 0;
      case 3: // Results
        return true;
      default:
        return true;
    }
  }, [currentStep, wizardData]);

  const nextStep = () => {
    if (currentStep < steps.length - 1 && canProceed()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const calculateOverallScore = (scores: CategoryScores): number => {
    const values = Object.values(scores);
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      const propertyId = uuidv4();
      const assessmentId = id || uuidv4();

      // Create property
      const property: Property = {
        id: propertyId,
        userId: user.id,
        address: wizardData.property.address || '',
        coordinates: wizardData.property.coordinates,
        parcelId: wizardData.property.parcelId,
        createdAt: new Date().toISOString(),
      };

      // Create assessment
      const assessment: Assessment = {
        id: assessmentId,
        propertyId,
        status: 'completed',
        overallScore: calculateOverallScore(wizardData.categoryScores),
        categoryScores: wizardData.categoryScores,
        findings: wizardData.findings,
        recommendations: generateRecommendations(wizardData.findings, wizardData.categoryScores),
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      if (isOnline) {
        // Save directly to Supabase
        const { error: propError } = await supabase.from('properties').insert({
          id: property.id,
          user_id: property.userId,
          address: property.address,
          parcel_id: property.parcelId,
        });

        if (propError) throw propError;

        const { error: assError } = await supabase.from('assessments').insert({
          id: assessment.id,
          property_id: assessment.propertyId,
          status: assessment.status,
          overall_score: assessment.overallScore,
          category_scores: assessment.categoryScores,
          findings: assessment.findings,
          recommendations: assessment.recommendations,
          completed_at: assessment.completedAt,
        });

        if (assError) throw assError;
      } else {
        // Save locally for later sync
        await savePropertyLocally(property);
        await saveAssessmentLocally(assessment);
      }

      // Persist photos to Dexie; each save queues a sync op that uploads the
      // blob to Supabase Storage and inserts the assessment_photos row
      // (including training consent + hazard tags) when a connection exists.
      for (const photo of wizardData.photos) {
        if (!photo.localBlob) continue;
        await savePhotoLocally({ ...photo, assessmentId }, photo.localBlob);
      }
      if (isOnline && wizardData.photos.length > 0) {
        // Fire-and-forget: photo upload shouldn't block assessment completion.
        syncNow().catch((err) => console.error('Photo sync failed:', err));
      }

      showSuccessToast('Assessment completed', 'Your assessment has been saved successfully.');
      navigate(`/assessment/${assessmentId}`);
    } catch (error) {
      console.error('Error saving assessment:', error);
      showErrorToast('Error saving assessment', 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  function generateRecommendations(_findings: Finding[], scores: CategoryScores) {
    const recommendations = [];

    if (scores.defensibleSpace < 7) {
      recommendations.push({
        id: uuidv4(),
        category: 'defensible-space' as const,
        priority: 'immediate' as const,
        title: 'Harden the 0-5 ft Ember-Resistant Zone',
        description:
          'Clear the 0-5 ft Zone 0 to bare soil or noncombustible hardscape — remove all plants, combustible mulch, and stored items. Add a 5-ft noncombustible section where any fence meets the house, and reduce fuel in Zones 1-2.',
        estimatedCost: '$500-2000',
      });
    }

    if (scores.roofAndStructure < 7) {
      recommendations.push({
        id: uuidv4(),
        category: 'roof-structure' as const,
        priority: 'short-term' as const,
        title: 'Upgrade Roof Materials',
        description:
          'Consider replacing wood shake roofing with Class A fire-rated materials.',
        estimatedCost: '$5000-15000',
      });
    }

    if (scores.vegetationManagement < 7) {
      recommendations.push({
        id: uuidv4(),
        category: 'vegetation' as const,
        priority: 'immediate' as const,
        title: 'Vegetation Management',
        description:
          'Trim tree branches to maintain 10-foot clearance from structures and remove ladder fuels.',
        estimatedCost: '$200-1000',
      });
    }

    if (scores.emberIntrusion < 7) {
      recommendations.push({
        id: uuidv4(),
        category: 'ember-intrusion' as const,
        priority: 'short-term' as const,
        title: 'Install WUI-Rated Ember-Resistant Vents',
        description:
          'Replace standard or mesh-only vents with WUI-rated ember- and flame-resistant vents tested to ASTM E2886 (State Fire Marshal listed). Plain 1/8-inch mesh does not stop wind-driven embers.',
        estimatedCost: '$300-800',
      });
    }

    return recommendations;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PropertyInfoStep
            data={wizardData.property}
            onUpdate={(property) => updateWizardData({ property })}
          />
        );
      case 1:
        return (
          <PhotoCaptureStep
            photos={wizardData.photos}
            onUpdate={(photos) => updateWizardData({ photos })}
            onAnalysisComplete={(findings, scores) =>
              updateWizardData({
                findings: [...wizardData.findings, ...findings],
                categoryScores: { ...wizardData.categoryScores, ...scores },
              })
            }
          />
        );
      case 2:
        return (
          <ChecklistStep
            responses={wizardData.checklistResponses}
            onUpdate={(checklistResponses, scores) =>
              updateWizardData({
                checklistResponses,
                categoryScores: { ...wizardData.categoryScores, ...scores },
              })
            }
          />
        );
      case 3:
        return (
          <ResultsStep
            categoryScores={wizardData.categoryScores}
            findings={wizardData.findings}
            overallScore={calculateOverallScore(wizardData.categoryScores)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center justify-between">
          {steps.map((step, index) => (
            <li key={step.id} className="relative flex-1">
              {index !== steps.length - 1 && (
                <div
                  className={`absolute top-4 left-1/2 w-full h-0.5 ${
                    index < currentStep
                      ? 'bg-fire-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  aria-hidden="true"
                />
              )}
              <button
                onClick={() => index < currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={`relative flex flex-col items-center group ${
                  index > currentStep ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-full border-2 transition-colors ${
                    index < currentStep
                      ? 'border-fire-600 bg-fire-600 text-white'
                      : index === currentStep
                      ? 'border-fire-600 bg-white dark:bg-gray-900 text-fire-600'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-500'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </span>
                <span
                  className={`mt-2 text-xs font-medium ${
                    index <= currentStep
                      ? 'text-fire-600'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="card p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Previous
        </button>

        {currentStep < steps.length - 1 ? (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Complete Assessment
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
