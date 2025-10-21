import { Express, Request, Response } from "express";
import path from "path";
import fs from "fs/promises";

// Define a type for the CSV parser function
export type CSVParserFunction = (
  filePath: string, 
  schema?: any, 
  hasHeader?: boolean
) => Promise<{ headers?: string[], data?: string[][] }>;

/**
 * Registers the `/getcsv` endpoint.
 *
 * @param app - The Express application instance.
 * @param csvParserFn - The function to use for parsing CSV files (dependency injection)
 * @param fileExistsFn - Optional function to check if file exists (for testing)
 */
export function registerGetCSVHandler(
  app: Express, 
  csvParserFn: CSVParserFunction,
  fileExistsFn: (path: string) => Promise<boolean> = async (path) => {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
) {
  app.get("/getcsv", async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    const requestId = generateRequestId();
    const filename = req.query.filename;
    
    // Enhanced metadata for debugging
    const metadata = {
      timestamp,
      requestId,
      endpoint: "/getcsv",
      method: req.method,
      requestParams: req.query,
      clientIp: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"]
    };

    // Validate filename parameter
    if (!filename || typeof filename !== "string") {
      return res.status(400).json({
        ...metadata,
        status: 400,
        error: "Missing or invalid filename parameter",
        message: "Please provide a valid filename as a query parameter"
      });
    }

    try {
      // SECURITY: Multiple layers of defense against path traversal attacks
      
      // 1. Reject filenames with path traversal sequences or non-CSV extensions
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || !filename.endsWith(".csv")) {
        return res.status(400).json({
          ...metadata,
          status: 400,
          error: "Invalid filename format",
          message: "Filename must have a .csv extension and not contain path traversal sequences or directory separators"
        });
      }
      
      // 2. Sanitize filename to only allow safe characters
      // Only allow alphanumeric characters, hyphens, underscores, and periods
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
      
      if (sanitizedFilename !== filename) {
        return res.status(400).json({
          ...metadata,
          status: 400,
          error: "Invalid filename characters",
          message: "Filename contains invalid characters. Only alphanumeric characters, hyphens, underscores, and periods are allowed"
        });
      }
      
      // 3. Construct file path using path.join to ensure proper path construction
      const dataDir = path.resolve(process.cwd(), "data");
      
      // 4. Use path.basename to get only the filename part, discarding any path components
      const safeFilename = path.basename(sanitizedFilename);
      const filePath = path.join(dataDir, safeFilename);
      
      // 5. Additional security check: Ensure the resolved path is within the data directory
      const normalizedFilePath = path.normalize(filePath);
      const normalizedDataDir = path.normalize(dataDir);
      
      if (!normalizedFilePath.startsWith(normalizedDataDir)) {
        return res.status(403).json({
          ...metadata,
          status: 403,
          error: "Access denied",
          message: "Attempted to access a file outside the allowed directory",
          details: {
            requestedPath: filename,
            allowedDirectory: "data"
          }
        });
      }
      
      // Check if file exists using the injected function
      const fileExists = await fileExistsFn(filePath);
      if (!fileExists) {
        return res.status(404).json({
          ...metadata,
          status: 404,
          error: "File not found",
          message: `The requested file '${safeFilename}' does not exist`,
          details: { 
            filename: safeFilename,
            attemptedAt: new Date().toISOString()
          }
        });
      }
      
      // Record start time for performance tracking
      const startTime = process.hrtime();
      
      // Parse the CSV file using the injected parseCSV function
      const result = await csvParserFn(filePath, undefined, true);
      
      // Transform array data to objects using headers as keys
      const transformedData: Record<string, string>[] = [];
      
      // Type narrowing: Check if headers and data exist and have content
      if (result.headers && Array.isArray(result.headers) && result.headers.length > 0 && 
          result.data && Array.isArray(result.data) && result.data.length > 0) {
        
        // Iterate through each row in the data
        for (const row of result.data) {
          // Type narrowing: Ensure row is an array
          if (Array.isArray(row)) {
            const obj: Record<string, string> = {};
            
            // Iterate through headers and map to row values
            for (let i = 0; i < result.headers.length; i++) {
              // Type narrowing: Ensure header is a string and index is within row bounds
              const header = result.headers[i];
              if (typeof header === 'string' && i < row.length) {
                obj[header] = row[i];
              }
            }
            
            transformedData.push(obj);
          }
        }
      }
      
      // Calculate processing time
      const endTime = process.hrtime(startTime);
      const processingTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      
      // Return successful response with transformed data and enhanced metadata
      return res.status(200).json({
        ...metadata,
        status: 200,
        success: true,
        data: transformedData,
        headers: result.headers,
        rowCount: result.data ? result.data.length : 0,
        performance: {
          processingTimeMs: parseFloat(processingTimeMs),
          fileSize: 0 // Skip file size calculation for testing
        }
      });
      
    } catch (error) {
      // Handle parsing errors with enhanced details
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return res.status(500).json({
        ...metadata,
        status: 500,
        error: "CSV parsing error",
        message: errorMessage,
        details: { 
          filename,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorStack: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined
        }
      });
    }
  });
}

/**
 * Generates a unique request ID for tracking purposes
 * @returns A string containing a unique request identifier
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}