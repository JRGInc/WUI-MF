import { useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { MeasurementTool } from './MeasurementTool';

interface CameraFallbackProps {
  mode: 'camera-overlay' | '3d-model' | 'measurement';
  showViewfinder: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onStreamingChange?: (isStreaming: boolean) => void;
}

export function CameraFallback({
  mode,
  showViewfinder,
  videoRef,
  onStreamingChange,
}: CameraFallbackProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        onStreamingChange?.(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
      onStreamingChange?.(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {mode === 'measurement' && (
        <MeasurementTool
          onMeasure={(distance) => {
            console.log('Measured distance (fallback, pixel-scaled):', distance);
          }}
        />
      )}

      {showViewfinder && mode === 'camera-overlay' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-white/50" />
          <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-white/50" />
          <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-white/50" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-white/50" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-8 h-0.5 bg-white/50" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-white/50" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center px-4">
            <ExclamationTriangleIcon className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <p className="text-white mb-4">{error}</p>
            <button onClick={startCamera} className="btn-primary">
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      )}

      {!isStreaming && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white/70">Initializing camera...</p>
          </div>
        </div>
      )}
    </>
  );
}
