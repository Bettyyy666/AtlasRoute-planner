import { Express, Request, Response } from "express";
import fetch from "node-fetch";

interface GeocoderResponse {
    result: {
        geographies: {
            States: Array<{ STATE: string }>
        }
    }
}

// Define types for dependency injection
export type StateFIPSFetcher = (lat: string, lon: string) => Promise<string | null>;
export type ACSDataFetcher = (url: string) => Promise<any>;

// Default implementation of getStateFIPS
export async function getStateFIPS(lat: string, lon: string): Promise<string | null> {
    const geocoderUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const res = await fetch(geocoderUrl);
    const geoData = (await res.json()) as GeocoderResponse;
    const states = geoData?.result?.geographies?.States;
    if (states && states.length > 0 && states[0].STATE) {
        return states[0].STATE;
    }
    return null;
}

// Default implementation of fetchACSData
export async function fetchACSData(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Census API request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

export function registerACSProxyHandler(
    app: Express, 
    stateFIPSFetcher: StateFIPSFetcher = getStateFIPS,
    acsDataFetcher: ACSDataFetcher = fetchACSData
) {
    app.get("/acs-proxy", async (req: Request, res: Response) => {
        try {
            const { lat, lon, variables, topLevel, bottomLevel } = req.query;

            // Defensive checks
            if (!lat || !lon || !variables || !topLevel || !bottomLevel) {
                return res.status(400).json({ error: "Missing required query parameters." });
            }
            
            // Validate granularity levels
            const granularityLevels = ["all", "us", "state", "county", "place"];
            const topLevelIndex = granularityLevels.indexOf(topLevel as string);
            const bottomLevelIndex = granularityLevels.indexOf(bottomLevel as string);
            
            // Check if granularity levels are valid
            if (topLevelIndex === -1 || bottomLevelIndex === -1) {
                return res.status(400).json({ 
                    error: "Invalid granularity level. Must be one of: all, us, state, county, place." 
                });
            }
            
            // Check if top level is broader than or equal to bottom level
            if (topLevelIndex > bottomLevelIndex) {
                return res.status(400).json({ 
                    error: "Invalid granularity combination. Top-level must be broader than or equal to bottom-level." 
                });
            }
            
            // Check if they're the same (except for 'all')
            if (topLevel === bottomLevel && topLevel !== "all" && topLevel !== "us") {
                return res.status(400).json({ 
                    error: "Top-level and bottom-level granularities cannot be the same (except for 'all' or 'us')." 
                });
            }

            let forParam = "";
            let inParam = "";
            
            // Set bottom-level (for) parameter
            if (bottomLevel === "state") {
                forParam = "for=state:*";
            } else if (bottomLevel === "county") {
                forParam = "for=county:*";
            } else if (bottomLevel === "place") {
                forParam = "for=place:*";
            } else if (bottomLevel === "all") {
                // 'all' is not a valid Census API parameter, default to state
                forParam = "for=state:*";
            }
            
            // Set top-level (in) parameter
            if (topLevel === "state") {
                // Use the injected stateFIPSFetcher
                const stateFIPS = await stateFIPSFetcher(lat as string, lon as string);
                if (!stateFIPS) {
                    return res.status(400).json({ error: "Could not resolve state FIPS code from coordinates." });
                }
                inParam = `in=state:${stateFIPS}`;
            } else if (topLevel === "county") {
                inParam = "in=county:*";
            } else if (topLevel === "place") {
                inParam = "in=place:*";
            } else if (topLevel === "all") {
                inParam = "in=state:*";
            }

            // Combine parameters correctly
            const geoParams = `&${forParam}&${inParam}`;

            const acsUrl = `https://api.census.gov/data/2023/acs/acs5/subject/variables?get=${variables}${geoParams}`;
            
            // Use the injected acsDataFetcher
            const data = await acsDataFetcher(acsUrl);
            
            res.json({
                query: { lat, lon, variables, topLevel, bottomLevel },
                acsUrl,
                data,
            });
        } catch (error) {
            res.status(500).json({ 
                error: "Failed to fetch ACS data", 
                details: error instanceof Error ? error.message : String(error) 
            });
        }
    });
}