// User & Auth Types
export interface User {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

// Property Types
export interface Property {
  id: string;
  userId: string;
  address: string;
  coordinates?: GeoCoordinates;
  parcelId?: string;
  createdAt: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

// Assessment Types
export type AssessmentStatus = 'in_progress' | 'completed' | 'archived';

export interface Assessment {
  id: string;
  propertyId: string;
  status: AssessmentStatus;
  overallScore?: number;
  categoryScores: CategoryScores;
  findings: Finding[];
  recommendations: Recommendation[];
  createdAt: string;
  completedAt?: string;
}

export interface CategoryScores {
  defensibleSpace: number;
  roofAndStructure: number;
  vegetationManagement: number;
  accessAndEvacuation: number;
  waterSupply: number;
  emberIntrusion: number;
}

export interface Finding {
  id: string;
  category: RiskCategory;
  severity: RiskLevel;
  title: string;
  description: string;
  location?: string;
  photoIds?: string[];
  coordinates?: GeoCoordinates;
}

export interface Recommendation {
  id: string;
  category: RiskCategory;
  priority: 'immediate' | 'short-term' | 'long-term';
  title: string;
  description: string;
  estimatedCost?: string;
  resources?: ResourceLink[];
}

export interface ResourceLink {
  title: string;
  url: string;
  type: 'article' | 'video' | 'guide' | 'product';
}

// Risk Types
export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

export type RiskCategory =
  | 'defensible-space'
  | 'roof-structure'
  | 'vegetation'
  | 'access-evacuation'
  | 'water-supply'
  | 'ember-intrusion';

export interface RiskZone {
  zone: 0 | 1 | 2;
  name: string;
  distanceRange: string;
  requirements: string[];
  score: number;
}

// Photo Types
export interface AssessmentPhoto {
  id: string;
  assessmentId: string;
  storagePath: string;
  category: RiskCategory;
  analysisResults?: CVAnalysisResult;
  coordinates?: GeoCoordinates;
  capturedAt: string;
  localBlob?: Blob;
  syncStatus: SyncStatus;
  // ML-training opt-in: when true, this photo (plus hazardTags) may be used
  // to train the app's on-device hazard-detection models.
  trainingConsent?: boolean;
  hazardTags?: HazardTag[];
}

// Hazard-class taxonomy for training-data collection. Mirrors the planned
// fine-tuning classes for the on-device detector; 'no-hazards-visible' marks
// valuable negative examples.
export const HAZARD_TAGS = [
  'dry-dead-vegetation',
  'ground-fuels',
  'overhanging-vegetation',
  'vegetation-near-structure',
  'woodpile-lumber',
  'propane-tank',
  'wood-shake-roof',
  'roof-debris',
  'gutter-debris',
  // Appended after the original 9 so existing class indices (0-8) stay stable
  // for any already-labeled data. Both are research-flagged Zone 0 / structure-
  // to-structure ignition gaps (IBHS WFPH, NIST TN 2228, CA AB 3074).
  'combustible-fence',
  'combustible-mulch',
  'no-hazards-visible',
] as const;

export type HazardTag = (typeof HAZARD_TAGS)[number];

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

// Computer Vision Types
export interface CVAnalysisResult {
  vegetationScore: number;
  vegetationCoverage: number;
  detectedRisks: DetectedRisk[];
  roofMaterial?: RoofMaterial;
  debrisLevel?: 'none' | 'light' | 'moderate' | 'heavy';
  confidence: number;
  processingTime: number;
}

export interface DetectedRisk {
  type: string;
  confidence: number;
  boundingBox?: BoundingBox;
  severity: RiskLevel;
  description: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RoofMaterial =
  | 'asphalt-shingle'
  | 'metal'
  | 'tile'
  | 'wood-shake'
  | 'slate'
  | 'unknown';

// Map Types
export interface MapAnnotation {
  id: string;
  assessmentId: string;
  coordinates: GeoCoordinates;
  annotationType: AnnotationType;
  content: AnnotationContent;
  createdAt: string;
}

export type AnnotationType =
  | 'risk-marker'
  | 'measurement'
  | 'photo-location'
  | 'recommendation'
  | 'note';

export interface AnnotationContent {
  title: string;
  description?: string;
  riskLevel?: RiskLevel;
  photoId?: string;
  measurementValue?: number;
  measurementUnit?: string;
  // Which view placed this annotation. Both map and AR write the same
  // MapAnnotation; this records the origin so each view can label/round-trip it.
  source?: 'map' | 'ar';
}

export interface MapLayer {
  id: string;
  name: string;
  type: 'risk-zone' | 'fire-history' | 'vegetation' | 'terrain' | 'custom';
  visible: boolean;
  opacity: number;
}

// Training Types
export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  lessons: TrainingLesson[];
  estimatedMinutes: number;
  badge?: Badge;
}

export interface TrainingLesson {
  id: string;
  courseId: string;
  title: string;
  content: LessonContent[];
  quiz?: Quiz;
  orderIndex: number;
}

export interface LessonContent {
  type: 'text' | 'image' | 'video' | 'interactive';
  content: string;
  caption?: string;
}

export interface Quiz {
  id: string;
  questions: QuizQuestion[];
  passingScore: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface TrainingProgress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  quizScore?: number;
  completedAt?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

// Sharing Types
export interface SharedReport {
  id: string;
  assessmentId: string;
  shareType: ShareType;
  recipientEmail?: string;
  accessToken: string;
  expiresAt: string;
  createdAt: string;
}

export type ShareType = 'link' | 'agency' | 'insurance';

// Analytics Types — first-party, privacy-preserving usage events. `properties`
// must stay PII-free (enums/ids/counts only — no addresses, coords, or names).
export interface AnalyticsEvent {
  id: string;
  userId: string | null;
  event: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

// Offline/Sync Types
export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  recordId: string;
  data: unknown;
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

// UI State Types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Assessment Wizard Types
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: string;
  isOptional?: boolean;
  isCompleted?: boolean;
}

export interface WizardState {
  currentStep: number;
  steps: WizardStep[];
  data: Partial<Assessment>;
  photos: AssessmentPhoto[];
  isDirty: boolean;
}
