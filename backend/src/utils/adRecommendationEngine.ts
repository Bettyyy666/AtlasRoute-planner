import { pinCategoryMap } from "./pinCategoryMap.js";
import { firestore } from "../firebase/firebasesetup.js";

// Ad Server API configuration
const AD_SERVER_BASE_URL = "http://cs0320-ci.cs.brown.edu:3233/getad";

/**
 * Interface for user ad preferences stored in Firebase
 */
interface AdPreferences {
  locationBased: boolean;
  keywordBased: boolean;
  sensitiveCategoryAds: boolean;
  lastUpdated?: number;
}

/**
 * Interface for ad objects from Ad Server API
 */
interface Ad {
  id: number;
  title: string;
  description: string;
  keywords: string[];
  url: string;
  city: string;
  state: string;
  country: string;
  category: string[];
}

/**
 * Default ad preferences (all OFF for GDPR compliance)
 */
const DEFAULT_PREFERENCES: AdPreferences = {
  locationBased: false,
  keywordBased: false,
  sensitiveCategoryAds: false,
};

/**
 * Load user's ad preferences from Firebase
 * Path: /users/{uid}/privacy/adPreferences
 */
async function loadAdPreferences(userId: string): Promise<AdPreferences> {
  try {
    if (!firestore) {
      console.warn("Firestore not initialized, using default preferences");
      return DEFAULT_PREFERENCES;
    }

    const preferencesDoc = await firestore
      .collection("users")
      .doc(userId)
      .collection("privacy")
      .doc("adPreferences")
      .get();

    if (preferencesDoc.exists) {
      const data = preferencesDoc.data() as AdPreferences;
      console.log(`📖 Backend loaded preferences for user ${userId}:`, data);
      return data;
    } else {
      // User has no preferences set yet - use defaults (all OFF)
      console.log(`📖 No preferences found for user ${userId}, using defaults`);
      return DEFAULT_PREFERENCES;
    }
  } catch (error) {
    console.error("Error loading ad preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Load user's trips from Firebase at path: /trips collection, filtered by userId
 * Note: Trips are stored in a global collection with userId field for filtering
 */
async function loadUserTrips(userId: string): Promise<any[]> {
  try {
    if (!firestore) {
      console.warn("Firestore not initialized, returning empty trips");
      return [];
    }

    // Query the global trips collection filtered by userId
    const tripsSnapshot = await firestore
      .collection("trips")
      .where("userId", "==", userId)
      .get();

    const trips: any[] = [];
    tripsSnapshot.forEach((doc: any) => {
      trips.push(doc.data());
    });

    console.log(
      `  📂 Queried trips collection for userId=${userId}, found ${trips.length} trips`
    );

    return trips;
  } catch (error) {
    console.error("Error loading user trips:", error);
    return [];
  }
}

/**
 * Load user's pins/saved places from Firebase at path: /users/{uid}/pins
 * Note: The pins are stored in a document containing an array of pins
 */
async function loadUserPins(userId: string): Promise<any[]> {
  try {
    if (!firestore) {
      console.warn("Firestore not initialized, returning empty pins");
      return [];
    }

    const pinsDoc = await firestore
      .collection("users")
      .doc(userId)
      .collection("pins")
      .doc("savedPlaces")
      .get();

    if (pinsDoc.exists) {
      const data = pinsDoc.data();
      return data?.pins || [];
    }
    return [];
  } catch (error) {
    console.error("Error loading user pins:", error);
    return [];
  }
}

/**
 * Extract cities and countries from user's trips
 */
function extractLocationsFromTrips(trips: any[]): {
  cities: string[];
  states: string[];
  countries: string[];
} {
  const cities: string[] = [];
  const states: string[] = [];
  const countries: string[] = [];

  console.log(`  🗺️  Processing ${trips.length} trips for locations...`);
  trips.forEach((trip, idx) => {
    console.log(`    Trip ${idx + 1}:`, {
      title: trip.title,
      destination: trip.destination,
      destinationName: trip.destination?.name,
      destinationState: trip.destination?.state,
      destinationCountry: trip.destination?.country,
    });

    if (trip.destination) {
      if (trip.destination.name) {
        cities.push(trip.destination.name);
        console.log(`      ✓ Added city: "${trip.destination.name}"`);
      }
      if (trip.destination.state) {
        states.push(trip.destination.state);
        console.log(`      ✓ Added state: "${trip.destination.state}"`);
      }
      if (trip.destination.country) {
        countries.push(trip.destination.country);
        console.log(`      ✓ Added country: "${trip.destination.country}"`);
      }
    }
  });

  const result = {
    cities: [...new Set(cities)],
    states: [...new Set(states)],
    countries: [...new Set(countries)],
  };

  console.log(`  📍 Extracted locations:`, result);
  return result;
}

/**
 * Extract interest categories from user's saved pins
 * Maps pin names to categories using pinCategoryMap
 */
function extractCategoriesFromPins(pins: any[]): string[] {
  const categories = new Set<string>();

  pins.forEach((pin) => {
    const pinName = pin.name;
    if (pinName && pinCategoryMap[pinName]) {
      const pinCategories = pinCategoryMap[pinName];
      pinCategories.forEach((cat) => categories.add(cat));
    }
  });

  return Array.from(categories);
}

/**
 * Extract interest categories from trip activities
 * Looks at all activities in all trips and maps them to categories using pinCategoryMap
 */
function extractCategoriesFromTrips(trips: any[]): string[] {
  const categories = new Set<string>();

  trips.forEach((trip) => {
    // Check if trip has activities
    if (trip.activities && typeof trip.activities === "object") {
      // Activities are organized by date: { "11/01": [...activities] }
      Object.values(trip.activities).forEach((dayActivities: any) => {
        if (Array.isArray(dayActivities)) {
          dayActivities.forEach((activity) => {
            const activityName = activity.name;
            if (activityName && pinCategoryMap[activityName]) {
              const activityCategories = pinCategoryMap[activityName];
              activityCategories.forEach((cat) => categories.add(cat));
              console.log(
                `    ✓ Activity "${activityName}" → ${activityCategories.join(", ")}`
              );
            }
          });
        }
      });
    }
  });

  return Array.from(categories);
}

/**
 * Build query parameters for the Ad Server API based on user preferences
 */
function buildAdServerQuery(
  preferences: AdPreferences,
  locations: { cities: string[]; states: string[]; countries: string[] },
  categories: string[]
): string {
  const params = new URLSearchParams();

  console.log(`\n  🔨 Building Ad Server query...`);
  console.log(`    Preferences:`, preferences);
  console.log(`    Locations:`, locations);
  console.log(`    Categories:`, categories);

  // Known city to state/country mapping with state abbreviations for Ad Server API
  const cityStateMap: {
    [key: string]: {
      state: string;
      stateAbbr: string;
      country: string;
      countryAbbr: string;
    };
  } = {
    "New York": {
      state: "New York",
      stateAbbr: "NY",
      country: "USA",
      countryAbbr: "USA",
    },
    "San Francisco": {
      state: "California",
      stateAbbr: "CA",
      country: "USA",
      countryAbbr: "USA",
    },
    "Los Angeles": {
      state: "California",
      stateAbbr: "CA",
      country: "USA",
      countryAbbr: "USA",
    },
    Chicago: {
      state: "Illinois",
      stateAbbr: "IL",
      country: "USA",
      countryAbbr: "USA",
    },
    Seattle: {
      state: "Washington",
      stateAbbr: "WA",
      country: "USA",
      countryAbbr: "USA",
    },
    Denver: {
      state: "Colorado",
      stateAbbr: "CO",
      country: "USA",
      countryAbbr: "USA",
    },
    Boston: {
      state: "Massachusetts",
      stateAbbr: "MA",
      country: "USA",
      countryAbbr: "USA",
    },
    Austin: {
      state: "Texas",
      stateAbbr: "TX",
      country: "USA",
      countryAbbr: "USA",
    },
    Miami: {
      state: "Florida",
      stateAbbr: "FL",
      country: "USA",
      countryAbbr: "USA",
    },
    Phoenix: {
      state: "Arizona",
      stateAbbr: "AZ",
      country: "USA",
      countryAbbr: "USA",
    },
    London: {
      state: "England",
      stateAbbr: "EN",
      country: "UK",
      countryAbbr: "UK",
    },
    Tokyo: {
      state: "Tokyo",
      stateAbbr: "TY",
      country: "Japan",
      countryAbbr: "JP",
    },
  };

  // Add location-based keywords if enabled
  // Format: "City,StateCode,Country" (e.g., "New York,NY,USA")
  if (preferences.locationBased && locations.cities.length > 0) {
    const city = locations.cities[0];
    const mapping = cityStateMap[city];

    if (mapping) {
      const keyword = `${city},${mapping.stateAbbr},${mapping.countryAbbr}`;
      params.append("keywords", keyword);
      console.log(`    ✓ Added location keyword: "${keyword}"`);
    } else {
      // Fallback to just city name if not in our mapping
      params.append("keywords", city);
      console.log(`    ✓ Added location keyword (fallback): "${city}"`);
    }
  }

  // Also add city, state, country as direct parameters for better matching
  if (preferences.locationBased && locations.cities.length > 0) {
    const city = locations.cities[0];
    params.append("city", city);
    console.log(`    ✓ Added city parameter: "${city}"`);

    // If state/country not in trip data, try to fill from our mapping
    if (!locations.states.length && cityStateMap[city]) {
      const state = cityStateMap[city].state;
      params.append("state", state);
      console.log(`    ✓ Added inferred state parameter: "${state}"`);
    }

    if (!locations.countries.length && cityStateMap[city]) {
      const country = cityStateMap[city].country;
      params.append("country", country);
      console.log(`    ✓ Added inferred country parameter: "${country}"`);
    }
  }

  if (preferences.locationBased && locations.states.length > 0) {
    const state = locations.states[0];
    params.append("state", state);
    console.log(`    ✓ Added state parameter: "${state}"`);
  }

  if (preferences.locationBased && locations.countries.length > 0) {
    const country = locations.countries[0];
    params.append("country", country);
    console.log(`    ✓ Added country parameter: "${country}"`);
  }

  // Add keyword/category-based filters if enabled
  if (preferences.keywordBased && categories.length > 0) {
    const catString = categories.slice(0, 3).join(",");
    params.append("categories", catString);
    console.log(`    ✓ Added categories parameter: "${catString}"`);
  }

  // Exclude sensitive categories if not consented
  if (!preferences.sensitiveCategoryAds) {
    const sensitiveCategories = [
      "Sexual and Reproductive Health",
      "Drugs & Supplements",
      "Get Rich Quick",
      "Astrology & Esoteric",
      "Reference to Sex",
      "Sensationalism",
      "Consumer Loans",
      "Cosmetic Procedures",
      "Dating",
      "Politics",
    ];
    params.append("excludeCategories", sensitiveCategories.join(","));
    console.log(`    ✓ Added excludeCategories to filter sensitive content`);
  }

  const queryString = params.toString();
  console.log(`  📤 Final query string: "${queryString}"`);
  return queryString;
}

/**
 * Fetch a single ad from the Ad Server API
 */
async function fetchAdFromServer(queryString: string): Promise<Ad | null> {
  try {
    const url = queryString
      ? `${AD_SERVER_BASE_URL}?${queryString}`
      : AD_SERVER_BASE_URL;

    console.log(`    📡 Calling Ad Server: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`    ❌ Ad Server API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Ad Server returns the ad object directly (or wrapped in {success, ad})
    // Check both formats for compatibility
    if (data.ad && data.success) {
      // Wrapped format: {success: true, ad: {...}}
      console.log(
        `    ✓ Got ad (wrapped): "${data.ad.title}" from ${data.ad.city}`
      );
      return data.ad as Ad;
    } else if (data.id && data.title && data.city) {
      // Direct format: {...ad object...}
      console.log(`    ✓ Got ad (direct): "${data.title}" from ${data.city}`);
      return data as Ad;
    }

    console.error("    ❌ Unexpected Ad Server response format:", data);
    return null;
  } catch (error) {
    console.error("    ❌ Error fetching ad from server:", error);
    return null;
  }
}

/**
 * Fetch multiple ads from the Ad Server API
 */
async function fetchAdsFromServer(
  queryString: string,
  count: number
): Promise<Ad[]> {
  const ads: Ad[] = [];
  const seenIds = new Set<number>();

  for (let i = 0; i < count * 2; i++) {
    // Try up to 2x requested count to avoid duplicates
    const ad = await fetchAdFromServer(queryString);

    if (!ad || seenIds.has(ad.id)) {
      continue;
    }

    ads.push(ad);
    seenIds.add(ad.id);

    if (ads.length >= count) {
      break;
    }
  }

  return ads;
}

/**
 * Filter ads by location based on city/state/country
 * The Ad Server doesn't actually respect location parameters, so we do client-side filtering
 */
function filterAdsByLocation(
  ads: Ad[],
  targetCities: string[],
  targetStates: string[],
  targetCountries: string[]
): Ad[] {
  if (!targetCities.length && !targetStates.length && !targetCountries.length) {
    // No location filter specified, return all ads
    return ads;
  }

  const filtered = ads.filter((ad) => {
    // Check if ad city matches target cities
    if (targetCities.length > 0) {
      const cityMatch = targetCities.some(
        (city) => ad.city.toLowerCase() === city.toLowerCase()
      );
      if (cityMatch) {
        console.log(`    ✓ Ad matches city: "${ad.title}" from ${ad.city}`);
        return true;
      }
    }

    // Check if ad state matches target states
    if (targetStates.length > 0) {
      const stateMatch = targetStates.some(
        (state) => ad.state.toLowerCase() === state.toLowerCase()
      );
      if (stateMatch) {
        console.log(`    ✓ Ad matches state: "${ad.title}" from ${ad.state}`);
        return true;
      }
    }

    // Check if ad country matches target countries
    if (targetCountries.length > 0) {
      const countryMatch = targetCountries.some(
        (country) => ad.country.toLowerCase() === country.toLowerCase()
      );
      if (countryMatch) {
        console.log(
          `    ✓ Ad matches country: "${ad.title}" from ${ad.country}`
        );
        return true;
      }
    }

    // If we get here, the ad doesn't match any location criteria
    console.log(
      `    ✗ Ad filtered out: "${ad.title}" from ${ad.city}, ${ad.state}`
    );
    return false;
  });

  console.log(
    `  🔍 Location filtering: ${ads.length} ads → ${filtered.length} ads matched`
  );
  return filtered;
}

/**
 * Filter ads by keywords and categories based on user's interests
 * Matches user's pin categories with ad keywords and categories
 */
function filterAdsByKeywords(
  ads: Ad[],
  userCategories: string[],
  sensitiveAllowed: boolean
): Ad[] {
  if (!userCategories.length) {
    // No categories specified, return all ads
    return ads;
  }

  // List of sensitive categories to exclude if not allowed
  const sensitiveCategories = [
    "Sexual and Reproductive Health",
    "Drugs & Supplements",
    "Get Rich Quick",
    "Astrology & Esoteric",
    "Reference to Sex",
    "Sensationalism",
    "Consumer Loans",
    "Cosmetic Procedures",
    "Dating",
    "Politics",
  ];

  const filtered = ads.filter((ad) => {
    // Skip sensitive ads if not allowed
    if (!sensitiveAllowed) {
      const hasSensitiveCategory = ad.category.some((cat) =>
        sensitiveCategories.includes(cat)
      );
      if (hasSensitiveCategory) {
        console.log(
          `    ✗ Ad filtered (sensitive): "${ad.title}" - ${ad.category.join(", ")}`
        );
        return false;
      }
    }

    // Check if any user category matches ad keywords or categories
    const matchesUserCategory = userCategories.some((userCat) => {
      // Check category match
      const categoryMatch = ad.category.some(
        (adCat) => adCat.toLowerCase() === userCat.toLowerCase()
      );
      if (categoryMatch) {
        return true;
      }

      // Check keyword match (case-insensitive)
      const keywordMatch = ad.keywords.some(
        (keyword) =>
          keyword.toLowerCase().includes(userCat.toLowerCase()) ||
          userCat.toLowerCase().includes(keyword.toLowerCase())
      );
      if (keywordMatch) {
        return true;
      }

      return false;
    });

    if (matchesUserCategory) {
      console.log(
        `    ✓ Ad matches keywords: "${ad.title}" - Categories: ${ad.category.join(", ")}`
      );
      return true;
    } else {
      console.log(
        `    ✗ Ad filtered (no match): "${ad.title}" - ${ad.category.join(", ")}`
      );
      return false;
    }
  });

  console.log(
    `  🔍 Keyword filtering: ${ads.length} ads → ${filtered.length} ads matched`
  );
  return filtered;
}

/**
 * Main function: Get recommended ads for a user based on their preferences
 *
 * @param userId - Firebase user ID
 * @param limit - Maximum number of ads to return (default: 10)
 * @returns Array of recommended ads from the Ad Server
 */
export async function getUserRecommendedAds(
  userId: string,
  limit: number = 10
): Promise<Ad[]> {
  try {
    console.log(`\n🎯 getUserRecommendedAds called for user: ${userId}`);

    // Step 1: Load user preferences from Firebase
    const preferences = await loadAdPreferences(userId);
    console.log(`✓ Preferences loaded:`, preferences);

    // If user hasn't opted into any personalization, return empty array (privacy-first)
    if (!preferences.locationBased && !preferences.keywordBased) {
      console.log(
        `⚠️  User has not enabled any personalization (locationBased: ${preferences.locationBased}, keywordBased: ${preferences.keywordBased})`
      );
      return [];
    }

    console.log(`✓ User has enabled personalization - fetching data...`);

    // Step 2: Load user data (trips and pins)
    const [trips, pins] = await Promise.all([
      loadUserTrips(userId),
      loadUserPins(userId),
    ]);

    console.log(`✓ Loaded ${trips.length} trips and ${pins.length} pins`);

    // Step 3: Extract filter criteria
    const locations = extractLocationsFromTrips(trips);
    const pinCategories = extractCategoriesFromPins(pins);
    const tripCategories = extractCategoriesFromTrips(trips);
    const categories = [...new Set([...pinCategories, ...tripCategories])];

    console.log(`✓ Extracted locations:`, locations);
    console.log(`✓ Extracted categories (pins + trips):`, categories);

    // Step 4: Build Ad Server query string
    const queryString = buildAdServerQuery(preferences, locations, categories);
    console.log(`✓ Built query string:`, queryString);

    // Step 5: Fetch ads from Ad Server
    // Since the Ad Server doesn't respect parameters, we need to fetch many and filter
    let recommendedAds: Ad[] = [];

    // Determine if we need location-based, keyword-based, or both
    const needsLocationFiltering =
      preferences.locationBased && locations.cities.length > 0;
    const needsKeywordFiltering =
      preferences.keywordBased && categories.length > 0;

    if (needsLocationFiltering || needsKeywordFiltering) {
      console.log(
        `\n  🎯 Fetching ads for filtering (location: ${needsLocationFiltering}, keyword: ${needsKeywordFiltering})...`
      );
      const matchedAds: Ad[] = [];
      let totalFetched = 0;
      const maxAttempts = 50; // Prevent infinite loops

      // Keep fetching and filtering until we have enough matching ads
      while (matchedAds.length < limit && totalFetched < maxAttempts * limit) {
        const batchSize = Math.min(20, limit); // Fetch 20 ads per batch
        const batch = await fetchAdsFromServer(queryString, batchSize);
        totalFetched += batch.length;

        if (batch.length === 0) {
          console.log(`  ⚠️  Ad Server returned no more ads`);
          break;
        }

        // Filter by location if needed
        let filtered = batch;
        if (needsLocationFiltering) {
          filtered = filterAdsByLocation(
            filtered,
            locations.cities,
            locations.states,
            locations.countries
          );
        }

        // Filter by keywords if needed
        if (needsKeywordFiltering) {
          filtered = filterAdsByKeywords(
            filtered,
            categories,
            preferences.sensitiveCategoryAds || false
          );
        }

        // Add filtered ads that we haven't seen before
        for (const ad of filtered) {
          if (
            !matchedAds.some((existing) => existing.id === ad.id) &&
            matchedAds.length < limit
          ) {
            matchedAds.push(ad);
          }
        }
      }

      recommendedAds = matchedAds;
      console.log(
        `✓ Fetched ${recommendedAds.length} matched ads (searched ${totalFetched} total ads)`
      );
    } else {
      // No filters specified: Just fetch the requested number of random ads
      recommendedAds = await fetchAdsFromServer(queryString, limit);
      console.log(`✓ Fetched ${recommendedAds.length} ads from Ad Server`);
    }

    console.log(`✓ Got ${recommendedAds.length} personalized ads`);
    return recommendedAds;
  } catch (error) {
    console.error("❌ Error in getUserRecommendedAds:", error);
    return [];
  }
}

/**
 * Get random ads from the Ad Server (no personalization)
 * @param limit - Number of ads to return
 * @returns Array of random ads
 */
export async function getRandomAds(limit: number = 10): Promise<Ad[]> {
  return await fetchAdsFromServer("", limit);
}

/**
 * Get ads by location from the Ad Server
 * @param city - City name
 * @param country - Country name
 * @param limit - Number of ads to return
 * @returns Ads matching the location
 */
export async function getAdsByLocation(
  city: string,
  country: string,
  limit: number = 10
): Promise<Ad[]> {
  const params = new URLSearchParams();
  if (city) params.append("city", city);
  if (country) params.append("country", country);
  return await fetchAdsFromServer(params.toString(), limit);
}

/**
 * Get ads by category from the Ad Server
 * @param category - Category name
 * @param limit - Number of ads to return
 * @returns Ads in the specified category
 */
export async function getAdsByCategory(
  category: string,
  limit: number = 10
): Promise<Ad[]> {
  const params = new URLSearchParams();
  params.append("categories", category);
  return await fetchAdsFromServer(params.toString(), limit);
}

/**
 * Get a single random ad from the Ad Server
 * @returns A random ad
 */
export async function getRandomAd(): Promise<Ad | null> {
  return await fetchAdFromServer("");
}
