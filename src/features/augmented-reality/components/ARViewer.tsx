import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CameraIcon,
  CubeIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ScissorsIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';
import { useWebXR } from '../hooks/useWebXR';
import { WebXRScene } from './WebXRScene';
import { CameraFallback } from './CameraFallback';
import { RiskAnnotation } from './RiskAnnotation';
import { GeoMarkerOverlay } from './GeoMarkerOverlay';
import { useAnnotations } from '@/features/maps/hooks/useAnnotations';
import { useLiveFrameAnalysis } from '@/features/computer-vision/hooks/useLiveFrameAnalysis';
import { addFindingToAssessment } from '@/shared/services/offlineStorage';
import { track } from '@/shared/services/analytics';
import { showSuccessToast, showErrorToast } from '@/shared/stores/toastStore';
import type {
  AnnotationType,
  DetectedRisk,
  Finding,
  GeoCoordinates,
  RiskCategory,
  RiskLevel,
} from '@/shared/types';

type ARMode = 'camera-overlay' | '3d-model' | 'measurement';

const SCAN_INTERVAL_MS = 2500;

// Best-effort map from a CV detection's free-form `type` to a risk category for
// the persisted Finding. Defaults to vegetation (the dominant detector class).
function detectedRiskToCategory(type: string): RiskCategory {
  const t = type.toLowerCase();
  if (t.includes('roof') || t.includes('gutter') || t.includes('shake')) return 'roof-structure';
  if (t.includes('ember')) return 'ember-intrusion';
  if (t.includes('access') || t.includes('road') || t.includes('evac')) return 'access-evacuation';
  if (t.includes('water')) return 'water-supply';
  if (t.includes('clearance') || t.includes('defensible') || t.includes('structure')) return 'defensible-space';
  return 'vegetation';
}

export default function ARViewer() {
  const { assessmentId } = useParams();
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [mode, setMode] = useState<ARMode>('camera-overlay');
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveScanEnabled, setLiveScanEnabled] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [xrRisks, setXrRisks] = useState<DetectedRisk[]>([]);
  const [xrScanState, setXrScanState] = useState<{
    isAnalyzing: boolean;
    cameraAccessAvailable: boolean;
  }>({ isAnalyzing: false, cameraAccessAvailable: false });

  const { isSupported: isXRSupported } = useWebXR();
  const useXR = isXRSupported && mode === 'measurement';

  // Map-placed annotations for this assessment, shown as geo-anchored 3D markers
  // over the camera (Phase 3). addAnnotation closes the loop for Phase 4 (AR → map).
  const { annotations: geoAnnotations, addAnnotation } = useAnnotations(assessmentId);
  const [pendingArCoords, setPendingArCoords] = useState<GeoCoordinates | null>(null);
  const [arDraftTitle, setArDraftTitle] = useState('');
  const [arDraftType, setArDraftType] = useState<AnnotationType>('risk-marker');
  const [arDraftRisk, setArDraftRisk] = useState<RiskLevel>('high');

  const handleSaveArAnnotation = useCallback(async () => {
    if (!pendingArCoords) return;
    const title = arDraftTitle.trim() || 'AR marker';
    await addAnnotation({
      coordinates: pendingArCoords,
      annotationType: arDraftType,
      content: {
        title,
        riskLevel: arDraftType === 'risk-marker' ? arDraftRisk : undefined,
        source: 'ar',
      },
    });
    void track('ar_marker_placed', { type: arDraftType, hasAssessment: !!assessmentId });
    showSuccessToast('Marker saved', `${title} added — it will show on the map.`);
    setPendingArCoords(null);
    setArDraftTitle('');
  }, [pendingArCoords, arDraftTitle, arDraftType, arDraftRisk, addAnnotation, assessmentId]);

  // Live scan in the camera-overlay (non-XR) path.
  const fallbackScanActive =
    liveScanEnabled && mode === 'camera-overlay' && !useXR && isStreaming;
  const fallbackScan = useLiveFrameAnalysis(videoRef, {
    enabled: fallbackScanActive,
    intervalMs: SCAN_INTERVAL_MS,
  });

  // Whichever path is active, drives the visible risks.
  const sourceRisks: DetectedRisk[] = useXR ? xrRisks : fallbackScan.risks;
  const isAnalyzing = useXR ? xrScanState.isAnalyzing : fallbackScan.isAnalyzing;
  const scanError = useXR ? null : fallbackScan.error;
  const lastAnalyzedAt = useXR ? null : fallbackScan.lastAnalyzedAt;

  const annotations: DetectedRisk[] = useMemo(
    () => sourceRisks.filter((r) => !dismissed.has(riskKey(r))),
    [sourceRisks, dismissed]
  );

  const handleRemoveAnnotation = useCallback(
    (index: number) => {
      const target = annotations[index];
      if (!target) return;
      setDismissed((prev) => new Set(prev).add(riskKey(target)));
    },
    [annotations]
  );

  // Persist an AR-detected hazard as a durable Finding (when launched from an
  // assessment) and record a usage event either way. Then dismiss it so the
  // same detection isn't captured twice.
  const handleCaptureAnnotation = useCallback(
    async (index: number) => {
      const target = annotations[index];
      if (!target) return;

      const category = detectedRiskToCategory(target.type);
      void track('ar_mitigation_identified', {
        type: target.type,
        category,
        severity: target.severity,
        confidence: target.confidence,
        hasAssessment: !!assessmentId,
      });

      if (assessmentId) {
        const finding: Finding = {
          id: uuidv4(),
          category,
          severity: target.severity,
          title: target.type,
          description: target.description,
        };
        try {
          await addFindingToAssessment(assessmentId, finding);
          showSuccessToast('Saved to assessment', `${target.type} added as a finding.`);
        } catch (error) {
          console.error('Failed to save AR finding:', error);
          showErrorToast('Could not save finding', 'It was recorded but not attached to the assessment.');
        }
      } else {
        showSuccessToast('Hazard recorded', 'Open AR from an assessment to save it as a finding.');
      }

      setDismissed((prev) => new Set(prev).add(riskKey(target)));
    },
    [annotations, assessmentId]
  );

  const handleClearAll = useCallback(() => {
    setDismissed(new Set(sourceRisks.map(riskKey)));
  }, [sourceRisks]);

  const handleSessionEnd = useCallback(() => {
    setMode('camera-overlay');
    setXrRisks([]);
  }, []);

  useEffect(() => {
    if (liveScanEnabled) setDismissed(new Set());
  }, [liveScanEnabled, mode]);

  return (
    <div
      ref={overlayRef}
      className="relative h-[calc(100vh-12rem)] min-h-[500px] bg-black rounded-lg overflow-hidden"
    >
      {useXR ? (
        <WebXRScene
          domOverlayRoot={overlayRef.current}
          onSessionEnd={handleSessionEnd}
          enableLiveScan={liveScanEnabled}
          scanIntervalMs={SCAN_INTERVAL_MS}
          onRisks={setXrRisks}
          onScanState={setXrScanState}
        />
      ) : (
        <CameraFallback
          mode={mode}
          showViewfinder
          videoRef={videoRef}
          onStreamingChange={setIsStreaming}
        />
      )}

      {/* Geo-anchored map markers over the camera (non-XR path) */}
      {!useXR && mode === 'camera-overlay' && (
        <GeoMarkerOverlay
          annotations={geoAnnotations}
          active={isStreaming}
          onPlace={assessmentId ? setPendingArCoords : undefined}
        />
      )}

      {/* Capture form for an AR-dropped marker (Phase 4) */}
      {pendingArCoords && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">New AR marker</h3>
            <div>
              <label className="label">Title</label>
              <input
                autoFocus
                value={arDraftTitle}
                onChange={(e) => setArDraftTitle(e.target.value)}
                className="input"
                placeholder="e.g. Propane tank"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={arDraftType}
                onChange={(e) => setArDraftType(e.target.value as AnnotationType)}
                className="input"
              >
                <option value="risk-marker">Risk marker</option>
                <option value="recommendation">Recommendation</option>
                <option value="photo-location">Photo location</option>
                <option value="measurement">Measurement</option>
                <option value="note">Note</option>
              </select>
            </div>
            {arDraftType === 'risk-marker' && (
              <div>
                <label className="label">Risk level</label>
                <select
                  value={arDraftRisk}
                  onChange={(e) => setArDraftRisk(e.target.value as RiskLevel)}
                  className="input"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pendingArCoords.latitude.toFixed(5)}, {pendingArCoords.longitude.toFixed(5)}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingArCoords(null)} className="btn-outline">
                Cancel
              </button>
              <button onClick={handleSaveArAnnotation} className="btn-primary">
                Save marker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Annotation overlay — lives above either backend so XR + fallback share it. */}
      <div className="absolute inset-0 pointer-events-none z-[5]">
        {annotations.map((annotation, index) => (
          <RiskAnnotation
            key={`${riskKey(annotation)}-${index}`}
            annotation={annotation}
            onCapture={() => handleCaptureAnnotation(index)}
            onRemove={() => handleRemoveAnnotation(index)}
          />
        ))}
      </div>

      {/* Mode selector */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-black/50 backdrop-blur rounded-lg p-1 flex gap-1">
          <button
            onClick={() => setMode('camera-overlay')}
            className={`p-2 rounded ${
              mode === 'camera-overlay'
                ? 'bg-fire-600 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Camera Overlay"
          >
            <CameraIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMode('3d-model')}
            className={`p-2 rounded ${
              mode === '3d-model'
                ? 'bg-fire-600 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="3D Model View"
          >
            <CubeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMode('measurement')}
            className={`p-2 rounded ${
              mode === 'measurement'
                ? 'bg-fire-600 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title={isXRSupported ? 'Measurement (AR)' : 'Measurement (2D fallback)'}
          >
            <ScissorsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      {(mode === 'camera-overlay' || useXR) && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-black/50 backdrop-blur rounded-lg p-1 flex gap-1">
            <button
              onClick={() => setLiveScanEnabled((v) => !v)}
              className={`p-2 rounded ${
                liveScanEnabled
                  ? 'bg-fire-600 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title={liveScanEnabled ? 'Pause live scanning' : 'Resume live scanning'}
            >
              {liveScanEnabled ? (
                <EyeIcon className="w-5 h-5" />
              ) : (
                <EyeSlashIcon className="w-5 h-5" />
              )}
            </button>
            {annotations.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 rounded text-white/70 hover:text-white hover:bg-white/10"
                title="Dismiss all current detections"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scanning indicator */}
      {liveScanEnabled && isAnalyzing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur text-white/90 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-fire-500 animate-pulse" />
          Scanning…
        </div>
      )}

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-black/50 backdrop-blur rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-white font-medium">
                {mode === 'camera-overlay' &&
                  (liveScanEnabled ? 'Live Scan' : 'Camera Overlay (paused)')}
                {mode === '3d-model' && '3D Model View'}
                {mode === 'measurement' &&
                  (useXR ? 'AR Measurement + Scan' : 'Measurement (2D fallback)')}
              </h3>
              <p className="text-white/70 text-sm mt-1 truncate">
                {mode === 'camera-overlay' && liveScanEnabled && lastAnalyzedAt &&
                  `Last scan ${secondsAgo(lastAnalyzedAt)}s ago — ${annotations.length} risk(s) visible`}
                {mode === 'camera-overlay' && liveScanEnabled && !lastAnalyzedAt &&
                  'Waiting for first scan…'}
                {mode === 'camera-overlay' && !liveScanEnabled &&
                  'Scanning is paused. Tap the eye to resume.'}
                {mode === '3d-model' &&
                  'View 3D defensible space zones around your property'}
                {mode === 'measurement' && useXR &&
                  (xrScanState.cameraAccessAvailable
                    ? 'Aim to place points. Live risks overlay when scanning.'
                    : 'Camera-access not granted — measurement only, no live risks.')}
                {mode === 'measurement' && !useXR &&
                  'Tap two screen points to measure (no spatial tracking on this device)'}
              </p>
              {scanError && (
                <p className="text-yellow-300 text-xs mt-1">Scan error: {scanError}</p>
              )}
            </div>
            {annotations.length > 0 && (
              <div className="flex items-center gap-2 text-white shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
                <span className="text-sm">{annotations.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function riskKey(r: DetectedRisk): string {
  const b = r.boundingBox;
  const round = (n: number) => Math.round(n * 10) / 10;
  return b
    ? `${r.type}:${round(b.x)},${round(b.y)},${round(b.width)},${round(b.height)}`
    : r.type;
}

function secondsAgo(timestamp: number): number {
  return Math.max(0, Math.round((Date.now() - timestamp) / 1000));
}
