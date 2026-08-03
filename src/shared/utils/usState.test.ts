import { describe, expect, it } from 'vitest';
import { resolveUsState, stateFromAddress, stateFromCoordinates } from './usState';

describe('stateFromCoordinates', () => {
  it('resolves points well inside states', async () => {
    // Sacramento, CA
    expect(await stateFromCoordinates({ latitude: 38.5816, longitude: -121.4944 })).toBe('CA');
    // Atlanta, GA
    expect(await stateFromCoordinates({ latitude: 33.749, longitude: -84.388 })).toBe('GA');
    // Boise, ID
    expect(await stateFromCoordinates({ latitude: 43.615, longitude: -116.2023 })).toBe('ID');
  });

  it('resolves points near a state line to the correct side', async () => {
    // South Lake Tahoe, CA — ~1.5 km from the NV line
    expect(await stateFromCoordinates({ latitude: 38.9399, longitude: -119.9772 })).toBe('CA');
    // Reno, NV
    expect(await stateFromCoordinates({ latitude: 39.5296, longitude: -119.8138 })).toBe('NV');
  });

  it('returns null offshore / outside the US', async () => {
    // Pacific Ocean
    expect(await stateFromCoordinates({ latitude: 35.0, longitude: -130.0 })).toBeNull();
    // Vancouver, Canada
    expect(await stateFromCoordinates({ latitude: 49.2827, longitude: -123.1207 })).toBeNull();
  });
});

describe('stateFromAddress', () => {
  it('parses trailing USPS codes with and without ZIP', () => {
    expect(stateFromAddress('123 Main St, Sacramento, CA 95814')).toBe('CA');
    expect(stateFromAddress('123 Main St, Sacramento, CA')).toBe('CA');
    expect(stateFromAddress('45 Peachtree Rd, Atlanta, GA 30303-1234')).toBe('GA');
  });

  it('parses full state names', () => {
    expect(stateFromAddress('123 Main St, Sacramento, California')).toBe('CA');
    expect(stateFromAddress('9 Elm Way, Charleston, West Virginia 25301')).toBe('WV');
  });

  it('does not mistake street words or missing states', () => {
    expect(stateFromAddress('12 Oak Ln')).toBeNull();
    expect(stateFromAddress('')).toBeNull();
    expect(stateFromAddress(undefined)).toBeNull();
  });
});

describe('resolveUsState', () => {
  it('prefers GPS over the typed address', async () => {
    expect(
      await resolveUsState({
        address: 'somewhere, GA 30303',
        coordinates: { latitude: 38.5816, longitude: -121.4944 },
      })
    ).toBe('CA');
  });

  it('falls back to the address when GPS is missing or unresolvable', async () => {
    expect(await resolveUsState({ address: '45 Peachtree Rd, Atlanta, GA 30303' })).toBe('GA');
    expect(
      await resolveUsState({
        address: '45 Peachtree Rd, Atlanta, GA 30303',
        coordinates: { latitude: 35.0, longitude: -130.0 },
      })
    ).toBe('GA');
  });
});
