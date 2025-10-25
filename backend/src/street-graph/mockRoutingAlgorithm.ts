import { mockShortPath } from "./mockPaths.js";

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

  // Return mock path from mockPaths.ts
  // For demo purposes, we're using a pre-defined path
  const path = mockShortPath.map(nodeId => {
    // Convert node IDs to lat/lng coordinates for demo
    // In a real implementation, we would look up actual coordinates
    return {
      lat: 37.7 + Math.random() * 0.1,
      lng: -122.4 + Math.random() * 0.1
    };
  });
  return {
    path: path,
    distance: distance * 111000,
    time: 30 * 60, // 30 minutes
  };
};
