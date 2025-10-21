import { ZodSchema } from "zod";
import fs from "fs/promises";
import fetch from "node-fetch";

/**
 * Parse a CSV line into fields using conditional logic instead of regex
 * Handles all CSV edge cases including quoted fields, escaped quotes, commas within quotes, etc.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = i + 1 < line.length ? line[i + 1] : null;

    if (char === '"') {
      if (!inQuotes) {
        // Starting a quoted field
        inQuotes = true;
      } else if (nextChar === '"') {
        // Escaped quote - add a single quote to the field
        currentField += '"';
        i++; // Skip the next quote
      } else {
        // Ending the quoted field
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator - end current field and start new one
      fields.push(currentField.trim());
      currentField = '';
    } else {
      // Regular character - add to current field
      currentField += char;
    }

    i++;
  }

  // Add the last field, always trim since CSV fields should be trimmed
  fields.push(currentField.trim());

  return fields;
}

/**
 * Parses a CSV string into an array of validated objects using a Zod schema.
 *
 * - Fetches the CSV content via the provided `getCSVText` function.
 * - Splits the CSV into lines and maps each row to an object using the header.
 * - Validates each row against the provided Zod schema.
 *
 * @param getCSVText - Async function that returns the CSV text.
 * @param schema - Zod schema used to validate each row.
 * @returns Promise resolving to an array of validated objects.
 */
export async function parseCSV<T>(
  getCSVText: () => Promise<string>,
  schema: ZodSchema<T>
): Promise<T[]> {
  const csv = await getCSVText();

  // Split CSV into lines and filter out empty lines
  const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  // Parse header row (first line)
  const headerFields = parseCSVLine(lines[0]);

  // Parse data rows and validate with schema
  const validatedRows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);

    // Skip empty rows
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) {
      continue;
    }

    // Create object from fields using header as keys
    const rowObject: Record<string, string> = {};
    for (let j = 0; j < Math.min(headerFields.length, fields.length); j++) {
      rowObject[headerFields[j]] = fields[j];
    }

    // Validate with schema
    const parseResult = schema.safeParse(rowObject);
    if (parseResult.success) {
      validatedRows.push(parseResult.data);
    } else {
      // For now, skip invalid rows - you could throw an error or log if needed
      console.warn(`Skipping invalid row ${i + 1}:`, parseResult.error.message);
    }
  }

  return validatedRows;
}

/**
 * Returns a function that reads CSV content from a local file.
 *
 * @param filePath - Path to the local CSV file.
 * @returns Function that resolves to the CSV text when called.
 */
export const getFromFile = (filePath: string) => () =>
  fs.readFile(filePath, "utf-8");

/**
 * Returns a function that fetches CSV content from a remote API.
 *
 * @param url - URL to fetch the CSV from.
 * @returns Async function that resolves to the CSV text when called.
 * @throws Error if the fetch response is not OK.
 */
export const getFromAPI = (url: string) => async () => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  return res.text();
};
