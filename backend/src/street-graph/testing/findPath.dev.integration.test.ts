/**
 * Dev Server Integration Tests for POST /find-path (Real Data)
 *
 * These tests assume the backend dev server is already running
 * via `npm run dev` and available at http://localhost:3001.
 *
 * They use real San Francisco POIs provided by the user to validate
 * end-to-end routing across tiles, exercising lazy tile loading and
 * the strategy pattern for distance metrics.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = 'http://localhost:3001';
let serverUp = false;

// San Francisco POIs (lat, lng)
const SF = {
  cableCarts: { lat: 37.7849, lng: -122.4070 },
  nintendoStore: { lat: 37.7852, lng: -122.4070 },
  ghirardelli: { lat: 37.8058, lng: -122.4228 },
  goldenGateVista: { lat: 37.8199, lng: -122.4783 },
  fishermansWharf: { lat: 37.8086, lng: -122.4098 },
  palaceOfFineArts: { lat: 37.8021, lng: -122.4488 },
  kevinPho: { lat: 37.7819, lng: -122.4307 },
  tadaima: { lat: 37.7841, lng: -122.4304 },
  komeyaBento: { lat: 37.7850, lng: -122.4301 }, // Japan Center Malls
  cityLights: { lat: 37.7975, lng: -122.4064 },
  lombardStreet: { lat: 37.8021, lng: -122.4187 },
  twinPeaks: { lat: 37.7544, lng: -122.4477 },
  fillmoreJazz: { lat: 37.7831, lng: -122.4326 },
  chinatownGate: { lat: 37.7941, lng: -122.4078 },
  adobeSF: { lat: 37.7897, lng: -122.3909 }
};

beforeAll(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${BASE_URL}/`, { signal: controller.signal });
    serverUp = res.status === 200;
  } catch {
    serverUp = false;
  } finally {
    clearTimeout(timer);
  }

  if (!serverUp) {
    throw new Error(
      'Dev server not running at http://localhost:3001. Start it with `npm run dev` in /backend.'
    );
  }
});

describe('POST /find-path (Dev Server, Real SF Data)', () => {

  it('routes Cable Carts → Japan Center within central SF (haversine)', async () => {
    // Warm nearby tiles to reduce Overpass latency
    await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [SF.cableCarts, SF.nintendoStore], distanceMetric: 'haversine' })
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);
    const body = {
      points: [SF.cableCarts, SF.komeyaBento],
      distanceMetric: 'haversine'
    };
    const res = await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.path)).toBe(true);
    expect(data.path.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it('routes Fisherman’s Wharf → Palace of Fine Arts → Golden Gate Vista (euclidean)', async () => {
    const body = {
      points: [SF.fishermansWharf, SF.palaceOfFineArts, SF.goldenGateVista],
      distanceMetric: 'euclidean'
    };
    const res = await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.path)).toBe(true);
    expect(data.path.length).toBeGreaterThanOrEqual(3);
  }, 15000);

  it('routes City Lights → Chinatown Gate → Ghirardelli Square (haversine)', async () => {
    const body = {
      points: [SF.cityLights, SF.chinatownGate, SF.ghirardelli],
      distanceMetric: 'haversine'
    };
    const res = await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.path)).toBe(true);
    expect(data.path.length).toBeGreaterThanOrEqual(3);
  }, 15000);

  it('routes Twin Peaks → Fillmore Jazz District (euclidean)', async () => {
    // Warm western SF tiles (Twin Peaks area) and central tiles
    await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [SF.palaceOfFineArts, SF.goldenGateVista], distanceMetric: 'euclidean' })
    });
    await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [SF.fillmoreJazz, SF.komeyaBento], distanceMetric: 'euclidean' })
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);
    const body = {
      points: [SF.twinPeaks, SF.fillmoreJazz],
      distanceMetric: 'euclidean'
    };
    const res = await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.path)).toBe(true);
    expect(data.path.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it('handles unknown metric by falling back to default', async () => {
    const body = {
      points: [SF.cableCarts, SF.komeyaBento],
      distanceMetric: 'metric_that_does_not_exist'
    };
    const res = await fetch(`${BASE_URL}/find-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.path)).toBe(true);
    expect(data.path.length).toBeGreaterThanOrEqual(2);
  }, 10000);
});