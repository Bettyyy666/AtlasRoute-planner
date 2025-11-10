import { Express, Request, Response } from "express";
import {
  getUserRecommendedAds,
  getRandomAds,
  getAdsByLocation,
  getAdsByCategory,
  getRandomAd,
} from "../utils/adRecommendationEngine.js";

/**
 * Register ad recommendation endpoints
 *
 * GET /api/ads - Get personalized ads for authenticated user
 * GET /api/ads/random - Get random ads (no personalization)
 * GET /api/ads/stats - Get dataset statistics
 */
export function registerAdRecommendationHandler(app: Express) {
  /**
   * GET /api/ads
   *
   * Returns personalized ads based on user's ad preferences and interests.
   *
   * Query parameters:
   *   - userId (optional): Firebase user ID. If not provided, returns random ads.
   *   - limit (optional): Number of ads to return (default: 10)
   *   - location (optional): Filter by location (e.g., "San Francisco,USA")
   *   - category (optional): Filter by category
   *
   * Example:
   *   GET /api/ads?userId=abc123&limit=5
   *   GET /api/ads/random?limit=10
   *
   * Response:
   *   {
   *     success: boolean,
   *     data: Array<Ad>,
   *     count: number,
   *     message?: string
   *   }
   */
  app.get("/api/ads", async (req: Request, res: Response) => {
    try {
      const { userId, limit, location, category } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 10, 100); // Cap at 100

      console.log(`\n📥 /api/ads endpoint called with:`, {
        userId,
        limit,
        limitNum,
        location,
        category,
      });

      let ads: any[] = [];

      // Case 1: Get personalized ads for user
      if (userId && typeof userId === "string") {
        console.log(`🔄 Case 1: Getting personalized ads for user: ${userId}`);
        ads = await getUserRecommendedAds(userId, limitNum);
        console.log(`✓ Got ${ads.length} personalized ads`);

        if (location && typeof location === "string") {
          const [city, country] = location.split(",").map((s) => s.trim());
          ads = ads.filter(
            (ad) =>
              ad.city.toLowerCase() === city.toLowerCase() ||
              ad.country.toLowerCase() === country.toLowerCase()
          );
        }

        if (category && typeof category === "string") {
          ads = ads.filter((ad) => ad.category.includes(category));
        }

        // Limit results
        ads = ads.slice(0, limitNum);

        console.log(`📤 Returning ${ads.length} personalized ads`);
        return res.json({
          success: true,
          data: ads,
          count: ads.length,
          message: `Found ${ads.length} personalized ads for user ${userId}`,
        });
      }

      // Case 2: Get random ads (no personalization)
      console.log(`🔄 Case 2: Getting random ads (no userId provided)`);
      if (location && typeof location === "string") {
        const [city, country] = location.split(",").map((s) => s.trim());
        ads = await getAdsByLocation(city, country, limitNum);
      } else if (category && typeof category === "string") {
        ads = await getAdsByCategory(category, limitNum);
      } else {
        ads = await getRandomAds(limitNum);
      }

      console.log(`📤 Returning ${ads.length} random ads`);
      return res.json({
        success: true,
        data: ads,
        count: ads.length,
        message: `Returned ${ads.length} ads`,
      });
    } catch (error) {
      console.error("❌ Error in /api/ads endpoint:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch ads",
      });
    }
  });

  /**
   * GET /api/ads/random
   *
   * Returns random ads without personalization
   *
   * Query parameters:
   *   - limit (optional): Number of ads to return (default: 10, max: 100)
   *
   * Response:
   *   {
   *     success: boolean,
   *     data: Array<Ad>,
   *     count: number
   *   }
   */
  app.get("/api/ads/random", async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 10, 100);

      const ads = await getRandomAds(limitNum);

      return res.json({
        success: true,
        data: ads,
        count: ads.length,
      });
    } catch (error) {
      console.error("Error in /api/ads/random endpoint:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch random ads",
      });
    }
  });

  console.log("✓ Ad recommendation handlers registered");
}
