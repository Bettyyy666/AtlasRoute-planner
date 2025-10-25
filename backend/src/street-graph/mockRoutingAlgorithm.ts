import {
  DutchWindmillsToOceanBeach,
  CableCartsToKevinChrisPhoPlace,
} from "./mockPaths";

/**
 * Mock implementation of the routing algorithm that returns pre-defined paths
 * based on the distance between points.
 */
export const mockRoutingAlgorithm = async (
  points: { lat: number; lng: number }[]
) => {
  if (!points || points.length < 2) {
    throw new Error("At least 2 points are required");
  }

  const start = points[0];
  const end = points[points.length - 1];

  // Calculate rough distance between points
  const distance = Math.sqrt(
    Math.pow(end.lat - start.lat, 2) + Math.pow(end.lng - start.lng, 2)
  );

  // Return appropriate mock path based on distance
  // For demo purposes, we're using pre-defined paths from mockPaths.ts
  const path =
    Math.random() > 0.5
      ? DutchWindmillsToOceanBeach
      : CableCartsToKevinChrisPhoPlace;
  return {
    path: path,
    distance: distance * 111000,
    time: 30 * 60, // 30 minutes
  };
};
