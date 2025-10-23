// Mock path data used for tests and frontend demos.
// Each path is an array of node IDs (strings) matching the shape
// expected by the routing code (node id -> lookup in GraphTile.nodes).

export const mockShortPath: string[] = [
  "n_1000",
  "n_1001",
  "n_1002",
  "n_1003",
  "n_1004",
];

export const mockMediumPath: string[] = [
  "n_2000",
  "n_2001",
  "n_2002",
  "n_2003",
  "n_2004",
  "n_2005",
  "n_2006",
  "n_2007",
];

export const mockLongPath: string[] = [
  "n_3000",
  "n_3001",
  "n_3002",
  "n_3003",
  "n_3004",
  "n_3005",
  "n_3006",
  "n_3007",
  "n_3008",
  "n_3009",
  "n_3010",
];

// Example of a multi-stop route (visiting 3 stops in order) represented as
// concatenated node id arrays. Consumers can split or use as-is.
export const mockMultiStop: string[][] = [
  ["n_4000", "n_4001", "n_4002"],
  ["n_4100", "n_4101", "n_4102", "n_4103"],
  ["n_4200", "n_4201"],
];

// Convenience default export containing several named mocks.
export default {
  mockShortPath,
  mockMediumPath,
  mockLongPath,
  mockMultiStop,
};
