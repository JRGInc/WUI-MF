import { useState, useCallback } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Measurement {
  id: string;
  start: Point3D;
  end: Point3D;
  distance: number;
  unit: 'feet' | 'meters';
}

export function useARMeasurement() {
  const [isActive, setIsActive] = useState(false);
  const [points, setPoints] = useState<Point3D[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [unit, setUnit] = useState<'feet' | 'meters'>('feet');

  const startMeasurement = useCallback(() => {
    setIsActive(true);
    setPoints([]);
  }, []);

  const addPoint = useCallback(
    (point: Point3D) => {
      if (!isActive) return;

      setPoints((prev) => {
        const newPoints = [...prev, point];

        // If we have two points, calculate the distance
        if (newPoints.length === 2) {
          const [start, end] = newPoints;
          const distanceMeters = calculateDistance(start, end);
          const distance = unit === 'feet' ? distanceMeters * 3.28084 : distanceMeters;

          const measurement: Measurement = {
            id: `${Date.now()}`,
            start,
            end,
            distance,
            unit,
          };

          setMeasurements((prev) => [...prev, measurement]);
          setIsActive(false);
          return [];
        }

        return newPoints;
      });
    },
    [isActive, unit]
  );

  const getMeasurement = useCallback(() => {
    if (measurements.length === 0) return null;
    return measurements[measurements.length - 1];
  }, [measurements]);

  const clearMeasurement = useCallback(() => {
    setPoints([]);
    setMeasurements([]);
    setIsActive(false);
  }, []);

  const deleteMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit((prev) => {
      const newUnit = prev === 'feet' ? 'meters' : 'feet';

      // Convert existing measurements
      setMeasurements((measurements) =>
        measurements.map((m) => ({
          ...m,
          distance:
            newUnit === 'feet'
              ? m.distance * (m.unit === 'meters' ? 3.28084 : 1)
              : m.distance * (m.unit === 'feet' ? 0.3048 : 1),
          unit: newUnit,
        }))
      );

      return newUnit;
    });
  }, []);

  return {
    isActive,
    points,
    measurements,
    unit,
    startMeasurement,
    addPoint,
    getMeasurement,
    clearMeasurement,
    deleteMeasurement,
    toggleUnit,
  };
}

function calculateDistance(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
