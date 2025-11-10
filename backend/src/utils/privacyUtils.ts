import crypto from "crypto";

// Privacy configuration constants
export const PRIVACY_CONFIG = {
  // Coordinate noise in meters (standard deviation)
  COORD_NOISE_STD_METERS: 50,

  // Time jitter in seconds (standard deviation)
  TIME_JITTER_STD_SECONDS: 120,

  // Grid size for spatial aggregation in meters (~100m cells)
  SPATIAL_GRID_SIZE_METERS: 100,

  // Time bin size for temporal aggregation in seconds (1 hour)
  TEMPORAL_BIN_SIZE_SECONDS: 3600,
};

// Get HMAC secret key from environment
const HMAC_SECRET_KEY = process.env.PRIVACY_HMAC_KEY || "default-insecure-key";

/**
 * Convert any timestamp format to "YYYY-MM" string for privacy
 * Handles Firestore Timestamp objects and ISO strings
 */
export function toYearMonth(ts: any): string {
  try {
    // Handle Firestore Timestamp object with _seconds and _nanoseconds
    if (ts && typeof ts === "object" && "_seconds" in ts) {
      const ms = ts._seconds * 1000 + (ts._nanoseconds || 0) / 1e6;
      const date = new Date(ms);
      return date.toISOString().slice(0, 7); // "YYYY-MM"
    }

    // Handle ISO string or other date-like strings
    if (typeof ts === "string") {
      const date = new Date(ts);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 7); // "YYYY-MM"
      }
    }

    // Handle Date objects
    if (ts instanceof Date) {
      return ts.toISOString().slice(0, 7); // "YYYY-MM"
    }

    // Return original if cannot parse
    return ts;
  } catch (e) {
    console.error("Error converting timestamp to year-month:", e);
    return ts; // Return original on error
  }
}

/**
 * Hash user ID using HMAC-SHA256
 * Returns deterministic but irreversible hash (first 24 hex chars)
 */
export function hashUserId(userId: string): string {
  const hmac = crypto.createHmac("sha256", HMAC_SECRET_KEY);
  hmac.update(userId);
  const hash = hmac.digest("hex");
  return hash.substring(0, 24);
}

/**
 * Add Gaussian noise to latitude/longitude coordinates
 * Converts noise from meters to approximate degrees
 */
export function addNoiseToCoords(
  lat: number,
  lng: number,
  stdMeters: number = PRIVACY_CONFIG.COORD_NOISE_STD_METERS
): { lat: number; lng: number } {
  // Approximate conversion: 1 degree ≈ 111,000 meters
  const METERS_PER_DEGREE = 111000;
  const stdDegrees = stdMeters / METERS_PER_DEGREE;

  const noisyLat = lat + gaussianRandom() * stdDegrees;
  const noisyLng = lng + gaussianRandom() * stdDegrees;

  return {
    lat: parseFloat(noisyLat.toFixed(6)),
    lng: parseFloat(noisyLng.toFixed(6)),
  };
}

/**
 * Add random jitter to ISO timestamp string
 */
export function jitterTimestamp(
  isoString: string,
  stdSeconds: number = PRIVACY_CONFIG.TIME_JITTER_STD_SECONDS
): string {
  try {
    const date = new Date(isoString);
    const jitterMs = gaussianRandom() * stdSeconds * 1000;
    const jitteredDate = new Date(date.getTime() + jitterMs);
    return jitteredDate.toISOString();
  } catch (e) {
    // Return original if parsing fails
    return isoString;
  }
}

/**
 * Snap coordinates to a grid (for spatial aggregation)
 */
export function snapToGrid(
  lat: number,
  lng: number,
  gridSizeMeters: number = PRIVACY_CONFIG.SPATIAL_GRID_SIZE_METERS
): { lat: number; lng: number; gridCell: string } {
  const METERS_PER_DEGREE = 111000;
  const gridSizeDegrees = gridSizeMeters / METERS_PER_DEGREE;

  const snappedLat = Math.floor(lat / gridSizeDegrees) * gridSizeDegrees;
  const snappedLng = Math.floor(lng / gridSizeDegrees) * gridSizeDegrees;

  const gridCell = `${snappedLat.toFixed(4)},${snappedLng.toFixed(4)}`;

  return {
    lat: parseFloat(snappedLat.toFixed(6)),
    lng: parseFloat(snappedLng.toFixed(6)),
    gridCell,
  };
}

/**
 * Bin timestamp into hourly buckets (for temporal aggregation)
 */
export function binTimestamp(
  isoString: string,
  binSizeSeconds: number = PRIVACY_CONFIG.TEMPORAL_BIN_SIZE_SECONDS
): { timestamp: string; timeBin: number } {
  try {
    const date = new Date(isoString);
    const ms = date.getTime();
    const binSize = binSizeSeconds * 1000;
    const bin = Math.floor(ms / binSize) * binSize;
    const binDate = new Date(bin);
    return {
      timestamp: binDate.toISOString(),
      timeBin: Math.floor(ms / binSize),
    };
  } catch (e) {
    return {
      timestamp: isoString,
      timeBin: 0,
    };
  }
}

/**
 * Generate a random number from a standard normal distribution
 * Uses Box-Muller transform
 */
function gaussianRandom(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z;
}

/**
 * Anonymize activity dates by replacing actual dates with relative day labels
 * Example: { "11/07": [...], "11/08": [...] } → { "day1": [...], "day2": [...] }
 */
export function anonymizeActivities(activities: any): any {
  if (!activities || typeof activities !== "object") {
    return activities;
  }

  // Get all date keys and sort them chronologically
  const dateKeys = Object.keys(activities).sort();

  // Map date keys to day labels
  const dateToDay: { [key: string]: string } = {};
  dateKeys.forEach((date, index) => {
    dateToDay[date] = `day${index + 1}`;
  });

  // Transform the activities object
  const anonymizedActivities: any = {};
  for (const [date, activityList] of Object.entries(activities)) {
    const dayLabel = dateToDay[date];
    if (Array.isArray(activityList)) {
      // Replace date field in each activity with day label
      anonymizedActivities[dayLabel] = activityList.map((activity: any) => ({
        ...activity,
        date: dayLabel, // Replace actual date with day label
      }));
    }
  }

  return anonymizedActivities;
}

/**
 * Apply privacy transformations to a single trip
 */
export function applyTripPrivacy(
  trip: any,
  shouldAggregate: boolean = false
): any {
  const transformed = {
    ...trip,
    userHash: trip.userId ? hashUserId(trip.userId) : undefined,
    userId: undefined, // Remove original userId
  };

  // Apply noise to destination coordinates
  if (trip.destination?.lat && trip.destination?.lng) {
    if (shouldAggregate) {
      const gridSnap = snapToGrid(trip.destination.lat, trip.destination.lng);
      transformed.destination = {
        ...trip.destination,
        lat: gridSnap.lat,
        lng: gridSnap.lng,
        gridCell: gridSnap.gridCell,
      };
    } else {
      const noisy = addNoiseToCoords(
        trip.destination.lat,
        trip.destination.lng
      );
      transformed.destination = {
        ...trip.destination,
        lat: noisy.lat,
        lng: noisy.lng,
      };
    }
  }

  // Apply time jitter/binning to dates, then truncate to year-month
  if (trip.startDate) {
    const processedDate = shouldAggregate
      ? binTimestamp(trip.startDate).timestamp
      : jitterTimestamp(trip.startDate);
    transformed.startDate = toYearMonth(processedDate);
  }

  if (trip.endDate) {
    const processedDate = shouldAggregate
      ? binTimestamp(trip.endDate).timestamp
      : jitterTimestamp(trip.endDate);
    transformed.endDate = toYearMonth(processedDate);
  }

  if (trip.createdAt) {
    const processedDate = shouldAggregate
      ? binTimestamp(trip.createdAt).timestamp
      : jitterTimestamp(trip.createdAt);
    transformed.createdAt = toYearMonth(processedDate);
  }

  if (trip.updatedAt) {
    const processedDate = shouldAggregate
      ? binTimestamp(trip.updatedAt).timestamp
      : jitterTimestamp(trip.updatedAt);
    transformed.updatedAt = toYearMonth(processedDate);
  }

  // Apply privacy to activities if present
  if (trip.activities && typeof trip.activities === "object") {
    const transformedActivities: any = {};
    for (const [date, activities] of Object.entries(trip.activities)) {
      if (Array.isArray(activities)) {
        transformedActivities[date] = activities.map((activity: any) => ({
          ...activity,
          lat: activity.lat
            ? shouldAggregate
              ? snapToGrid(activity.lat, activity.lng || 0).lat
              : addNoiseToCoords(activity.lat, activity.lng || 0).lat
            : activity.lat,
          lng: activity.lng
            ? shouldAggregate
              ? snapToGrid(activity.lat || 0, activity.lng).lng
              : addNoiseToCoords(activity.lat || 0, activity.lng).lng
            : activity.lng,
        }));
      }
    }
    // Anonymize activity dates (replace with day1, day2, etc.)
    transformed.activities = anonymizeActivities(transformedActivities);
  }

  return transformed;
}

/**
 * Apply privacy transformations to a single review
 */
export function applyReviewPrivacy(review: any): any {
  const transformed = {
    ...review,
    userHash: review.userId ? hashUserId(review.userId) : undefined,
    userId: undefined, // Remove original userId
  };

  // Apply time jitter to timestamps, then truncate to year-month
  if (review.createdAt) {
    const processedDate = jitterTimestamp(review.createdAt);
    transformed.createdAt = toYearMonth(processedDate);
  }

  if (review.updatedAt) {
    const processedDate = jitterTimestamp(review.updatedAt);
    transformed.updatedAt = toYearMonth(processedDate);
  }

  return transformed;
}

/**
 * Apply privacy transformations to a batch of trips
 */
export function applyBatchTripPrivacy(
  trips: any[],
  shouldAggregate: boolean = false
): any[] {
  return trips.map((trip) => applyTripPrivacy(trip, shouldAggregate));
}

/**
 * Apply privacy transformations to a batch of reviews
 */
export function applyBatchReviewPrivacy(reviews: any[]): any[] {
  return reviews.map((review) => applyReviewPrivacy(review));
}
