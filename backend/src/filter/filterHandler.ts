import { Express, Request, Response } from "express";
import { z } from "zod";
import {
  activityCache,
  redliningCache,
  tileCache,
} from "../globalVariables.js";
import { assignRedliningToActivities } from "../red-linning/redLinningUtils.js";
import { voronoiRows } from "../voronoi-diagram-generator/voronoiGenerator.js";
import { WeatherRow } from "../weather-parser/weatherParserType.js";
import { FilterConfigSchema } from "./filterConfigSchema.js";
import {
  assignWeatherToActivities,
  filterRows,
  filterRowsWithBackup,
} from "./filterRows.js";

/**
 * Schema for validating filter requests.
 *
 * Structure:
 * - `filters`: A configuration object defined by `FilterConfigSchema`.
 */
export const FilterRequestSchema = z.object({
  filters: FilterConfigSchema,
});

/**
 * Registers the `/filter` endpoint.
 *
 * Responsibilities:
 * - Validates the incoming request body against `FilterRequestSchema`.
 * - Enhances activities with redlining area assignments if available.
 * - Enhances activities with weather data using Voronoi-generated polygons.
 * - Applies filtering logic to visible activities using configured filters.
 * - Returns the filtered activity list and count.
 *
 * Error Handling:
 * - Responds with `400` for invalid request format.
 * - Responds with `500` for server or processing errors.
 *
 * @param app - The Express application instance.
 */
export function registerFilterHandler(app: Express) {
  app.post("/filter", async (req: Request, res: Response) => {
    try {
      const parsed = FilterRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(500).json({ error: "Server error" });
      }

      const { filters } = parsed.data;

      if (redliningCache.areas) {
        tileCache.visibleActivityMap = assignRedliningToActivities(
          tileCache.visibleActivityMap,
          redliningCache.areas
        );
      }

      const validVoronoiRows = voronoiRows.filter(
        (row): row is WeatherRow & { polygon: { x: number; y: number }[] } =>
          !!row.polygon
      );

      console.log(tileCache.visibleActivityMap);
      assignWeatherToActivities(tileCache.visibleActivityMap, validVoronoiRows);

      const filtered = filterRowsWithBackup(
        tileCache.visibleActivityMap,
        filters,
        Object.values(activityCache.activityMap)
      );

      return res.status(200).json({
        count: filtered.length,
        data: filtered,
      });
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
