import { useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import type { Property, GeoCoordinates } from '@/shared/types';

interface PropertyInfoStepProps {
  data: Partial<Property>;
  onUpdate: (data: Partial<Property>) => void;
}

export function PropertyInfoStep({ data, onUpdate }: PropertyInfoStepProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...data, address: e.target.value });
  };

  const handleParcelIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...data, parcelId: e.target.value });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: GeoCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        onUpdate({ ...data, coordinates });
        setIsLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === 1
            ? 'Location access denied. Please enable location services.'
            : 'Unable to get your location. Please try again.'
        );
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Property Information
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter the address and details of the property you want to assess.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Property Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="address"
            value={data.address || ''}
            onChange={handleAddressChange}
            placeholder="123 Main St, City, State ZIP"
            className="input mt-1"
            required
          />
        </div>

        <div>
          <label
            htmlFor="parcelId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Parcel ID / APN (optional)
          </label>
          <input
            type="text"
            id="parcelId"
            value={data.parcelId || ''}
            onChange={handleParcelIdChange}
            placeholder="e.g., 123-456-789"
            className="input mt-1"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Found on your property tax statement or county assessor website
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            GPS Coordinates
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={isLocating}
              className="btn-outline flex items-center gap-2"
            >
              <MapPinIcon className="w-4 h-4" />
              {isLocating ? 'Getting location...' : 'Use Current Location'}
            </button>
            {data.coordinates && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {data.coordinates.latitude.toFixed(6)}, {data.coordinates.longitude.toFixed(6)}
              </span>
            )}
          </div>
          {locationError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{locationError}</p>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Why we need this information
        </h3>
        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
          Your property address and location help us provide accurate fire risk data from public
          databases, including fire history, terrain analysis, and local fire hazard zones.
        </p>
      </div>
    </div>
  );
}
