import express, { Express } from "express";
import cors from "cors";
import { registerCSVHandler } from "./activity-parser/activityParserHandler.js";
import { registerWeatherCSVHandler } from "./weather-parser/weatherParserHandler.js";
import { fetchWeatherInBoundingBox } from "./weather-parser/fetchWeatherServices.js";
import { fetchActivityDataFromGoogleSheet } from "./activity-parser/activityDataFetcher.js";
import { registerInitLocationHandler } from "./initial-loc-parser/InitialLocParserHandler.js";
import { registerTileManagerHandler } from "./tile-manager/tileManagerHandler.js";
import { registerHighlightRedliningHandler } from "./red-linning/redLinningHandler.js";
import { registerFilterHandler } from "./filter/filterHandler.js";
import { registerFindPathHandler } from "./street-graph/bestRouteHandler.js";
import { routeThroughStops } from "./street-graph/multiStopAStar.js";
// import { registerSaveTripHandler } from "./firebase/registerSaveTripHandler.js"; 
import { registerSaveTripHandler } from "./firebase/registerSaveTripHandler-SECURE.js";
import { registerPinFolderHandlers } from "./firebase/registerPinFolderHandlers.js";
import { registerGetCSVHandler, CSVParserFunction } from "./CSV-parser/csvParserHandler.js";
import { registerACSProxyHandler, StateFIPSFetcher, ACSDataFetcher, getStateFIPS, fetchACSData } from "./acs/acsProxyHandler.js";
import { registerFBIQueryHandler, registerFBIStaffQueryHandler, fetchFBIData, loadAPIKey, getStateFIPS as getFBIStateFIPS, getCountyFIPS, getPlaceFIPS, mockAPIKeyLoader, mockFBIDataFetcher} from "./fbi-query/fbiQueryHandler.js";
import { registerTransitQueryHandler, mockTransitDataFetcher, mockTransitAPIKeyLoader } from "./SupplementalChallenge4/transitQueryHandler.js";
import { geographicBoundariesHandler } from "./geographic-boundaries/geographicBoundariesHandler.js";
import { parseCSV } from "./CSV-parser/basic-parser.js";
import { fileURLToPath } from 'url';
import fs from "fs/promises";

/**
 * Class representing the backend server application.
 */
export class ServerApp {
  public app: Express;
  private port: number;
  private csvParser: CSVParserFunction;
  private fileExistsFn: (path: string) => Promise<boolean>;
  private stateFIPSFetcher: StateFIPSFetcher;
  private acsDataFetcher: ACSDataFetcher;

  /**
   * Creates a new ServerApp instance.
   *
   * @param port - The port number the server listens on (default: 3001).
   * @param csvParser - Function to parse CSV files (default: parseCSV)
   * @param fileExistsFn - Function to check if a file exists (for testing)
   * @param stateFIPSFetcher - Function to fetch state FIPS codes (default: getStateFIPS)
   * @param acsDataFetcher - Function to fetch ACS data (default: fetchACSData)
   */
  constructor(
    port: number = 3001,
    csvParser: CSVParserFunction = parseCSV,
    fileExistsFn: (path: string) => Promise<boolean> = async (path) => {
      try {
        await fs.access(path);
        return true;
      } catch {
        return false;
      }
    },
    stateFIPSFetcher: StateFIPSFetcher = getStateFIPS,
    acsDataFetcher: ACSDataFetcher = fetchACSData
  ) {
    this.app = express();
    this.port = port;
    this.csvParser = csvParser;
    this.fileExistsFn = fileExistsFn;
    this.stateFIPSFetcher = stateFIPSFetcher;
    this.acsDataFetcher = acsDataFetcher;
    this.configureMiddleware();
    this.registerHandlers();
  }

  /**
   * Configures global middleware for the Express app.
   */
  private configureMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: "5mb" }));
  }

  /**
   * Registers all route handlers for the server.
   */
  private registerHandlers() {
    // Add a simple root route handler
    this.app.get("/", (req, res) => {
      res.send("API Server is running. Available endpoints: /getcsv, /activityLocations, etc.");
    });
    
    registerCSVHandler(this.app, fetchActivityDataFromGoogleSheet);
    registerWeatherCSVHandler(this.app, fetchWeatherInBoundingBox);
    registerInitLocationHandler(this.app);
    registerTileManagerHandler(this.app);
    registerHighlightRedliningHandler(this.app);
    registerFilterHandler(this.app);
    registerFindPathHandler(this.app, routeThroughStops);
    registerSaveTripHandler(this.app);
    registerPinFolderHandlers(this.app);
    registerACSProxyHandler(this.app, this.stateFIPSFetcher, this.acsDataFetcher); // Using injected dependencies
    registerGetCSVHandler(this.app, this.csvParser, this.fileExistsFn); // Using injected dependencies
    registerFBIQueryHandler(this.app, this.stateFIPSFetcher, getCountyFIPS, getPlaceFIPS, fetchFBIData, loadAPIKey); // Register FBI query handler
    registerFBIStaffQueryHandler(this.app, this.stateFIPSFetcher, getCountyFIPS, getPlaceFIPS, fetchFBIData, loadAPIKey); // Register FBI staff query handler
    registerTransitQueryHandler(this.app, mockTransitDataFetcher, mockTransitAPIKeyLoader);
    
    // Register geographic boundaries endpoint
    this.app.get("/geographic-boundaries", geographicBoundariesHandler);
  }

  /**
   * Starts the Express server on the configured port.
   */
  public start() {
    this.app.listen(this.port, () => {
      console.log(`Backend running at http://localhost:${this.port}`);
    });
  }

  /**
   * Returns the underlying Express app instance.
   *
   * @returns The Express application.
   */
  public getApp(): Express {
    return this.app;
  }
}

/**
 * Starts the server if this module is run directly.
 */
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const server = new ServerApp();
  server.start();
}
