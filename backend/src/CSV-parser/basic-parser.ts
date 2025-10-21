import * as fs from "fs";
import * as readline from "readline";
import z from 'zod'

/**
 * This is a JSDoc comment. Similar to JavaDoc, it documents a public-facing
 * function for others to use. Most modern editors will show the comment when 
 * mousing over this function name. Try it in run-parser.ts!
 * 
 * File I/O in TypeScript is "asynchronous", meaning that we can't just
 * read the file and return its contents. You'll learn more about this 
 * in class. For now, just leave the "async" and "await" where they are. 
 * You shouldn't need to alter them.
 * 
 * @param path The path to the file being loaded.
 * @param schema Optional Zod schema to validate and transform CSV rows.
 * @param hasHeader Optional boolean indicating if the CSV has a header row (default: false)
 * @returns a "promise" to produce an object containing header information and parsed data
 */

// Regex4 pattern for proper CSV parsing
const CSV_REGEX = /(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g;

/**
 * Parses a CSV line using regex4 pattern to handle quoted fields, escaped quotes, and commas
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let match;
  
  while ((match = CSV_REGEX.exec(line)) !== null) {
    // Handle quoted content (capture group 1) or unquoted content (capture group 2)
    const quotedContent = match[1];
    const unquotedContent = match[2];
    
    let fieldValue: string;
    if (quotedContent !== undefined) {
      // Handle escaped quotes within quoted fields (replace "" with ")
      fieldValue = quotedContent.replace(/""/g, '"');
    } else if (unquotedContent !== undefined) {
      // Trim unquoted fields (standard CSV behavior)
      fieldValue = unquotedContent.trim();
    } else {
      // Empty field
      fieldValue = "";
    }
    
    fields.push(fieldValue);
  }
  
  return fields;
}

/**
 * Interface for the parsed CSV result with header information
 */
export interface CSVParsedResult<T = string[]> {
  headers?: string[];
  data: T[];
  errors?: CSVParseError[];
}

/**
 * Interface for generator result with headers and row-by-row data
 */
export interface CSVGeneratorResult<T = string[]> {
  headers?: string[];
  generator: AsyncGenerator<T | CSVParseError>;
}

/**
 * Structured error information for CSV parsing failures
 */
export class CSVParseError extends Error {
  constructor(
    message: string,
    public readonly rowNumber: number,
    public readonly rawData: string[],
    public readonly zodError?: z.ZodError
  ) {
    super(message);
    this.name = 'CSVParseError';
  }

  /**
   * Returns a structured object with error details for programmatic handling
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      rowNumber: this.rowNumber,
      rawData: this.rawData,
      zodError: this.zodError ? {
        issues: this.zodError.issues.map(issue => ({
          code: issue.code,
          message: issue.message,
          path: issue.path,
        }))
      } : undefined
    };
  }
}

/**
 * Generator function that parses a CSV file row by row
 * @param path The path to the CSV file
 * @param schema Optional Zod schema for validating and transforming rows
 * @param hasHeader Whether the CSV file has a header row (default: false)
 * @param continueOnError Whether to continue parsing after encountering errors (default: false)
 * @returns Async generator that yields parsed rows or CSVParseError objects
 */
export async function* parseCSVGenerator<T = string[]>(
  path: string, 
  schema?: z.ZodType<T>,
  hasHeader: boolean = true,
  continueOnError: boolean = false
): AsyncGenerator<T | CSVParseError> {
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // handle different line endings
  });
  
  let lineNumber = 0;
  let headers: string[] | undefined;
  
  for await (const line of rl) {
    lineNumber++;
    const values = parseCSVLine(line);

    // Handle header row
    if (hasHeader && lineNumber === 1) {
      headers = values;
      continue; // Skip processing header row as data
    }

    if (schema) {
      let parsed;
      
      // Handle object schemas by creating a record from headers and values
      if (headers && schema.safeParse({}).success) {
        const rowRecord: Record<string, string> = {};
        headers.forEach((header, i) => {
          rowRecord[header] = values[i] || "";
        });
        parsed = schema.safeParse(rowRecord);
      } else {
        // Handle array schemas (original behavior)
        parsed = schema.safeParse(values);
      }
      
      if (parsed.success) {
        yield parsed.data;
      } else {
        const error = new CSVParseError(
          `CSV row validation failed: ${parsed.error.message}`,
          lineNumber,
          values,
          parsed.error
        );
        
        if (continueOnError) {
          yield error;
        } else {
          throw error;
        }
      }
    } else {
      // If no schema provided, yield the raw string array
      yield values as unknown as T;
    }
  }
}

/**
 * Creates a CSV generator with header information
 * @param path The path to the CSV file
 * @param schema Optional Zod schema for validating and transforming rows
 * @param hasHeader Whether the CSV file has a header row (default: false)
 * @param continueOnError Whether to continue parsing after encountering errors (default: false)
 * @returns Object containing headers and an async generator for rows
 */
export async function createCSVGenerator<T = string[]>(
  path: string, 
  schema?: z.ZodType<T>,
  hasHeader: boolean = true,
  continueOnError: boolean = false
): Promise<CSVGeneratorResult<T>> {
  let headers: string[] | undefined;
  
  // If we need headers, we need to read the first line separately
  if (hasHeader) {
    const fileStream = fs.createReadStream(path);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    const firstLine = await new Promise<string>((resolve, reject) => {
      rl.once('line', resolve);
      rl.once('error', reject);
      rl.once('close', () => reject(new Error('File is empty')));
    });
    
    headers = parseCSVLine(firstLine);
    rl.close();
  }
  
  const generator = parseCSVGenerator(path, schema, hasHeader, continueOnError);
  return { headers, generator };
}

/**
 * Parses a CSV file with optional header row support (original implementation for backward compatibility)
 * @param path The path to the CSV file
 * @param schema Optional Zod schema for validating and transforming rows
 * @param hasHeader Whether the CSV file has a header row (default: false)
 * @param continueOnError Whether to continue parsing after encountering errors (default: false)
 * @returns Promise containing headers (if present), parsed data, and any errors
 */
export async function parseCSV<T = string[]>(
  path: string, 
  schema?: z.ZodType<T>,
  hasHeader: boolean = true,
  continueOnError: boolean = false
): Promise<CSVParsedResult<T>> {
  const { headers, generator } = await createCSVGenerator(path, schema, hasHeader, continueOnError);
  const data: T[] = [];
  const errors: CSVParseError[] = [];
  
  for await (const result of generator) {
    if (result instanceof CSVParseError) {
      errors.push(result);
    } else {
      data.push(result);
    }
  }
  
  return { 
    headers, 
    data,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * State machine for parsing CSV with multi-line quoted fields
 */
enum ParserState {
  START_FIELD,
  UNQUOTED_FIELD,
  QUOTED_FIELD,
  AFTER_QUOTE
}

/**
 * Advanced CSV parser that handles multi-line quoted fields
 * Uses a state machine approach to properly handle quoted fields spanning multiple lines
 */
function parseCSVWithMultiLineSupport(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let state: ParserState = ParserState.START_FIELD;
  let position = 0;

  while (position < content.length) {
    const char = content[position];

    switch (state) {
      case ParserState.START_FIELD:
        if (char === '"') {
          state = ParserState.QUOTED_FIELD;
          position++;
        } else if (char === ',') {
          currentRow.push('');
          position++;
        } else if (char === '\n' || char === '\r') {
          if (currentRow.length > 0 || currentField.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
          }
          position++;
          // Handle CRLF
          if (char === '\r' && position < content.length && content[position] === '\n') {
            position++;
          }
        } else if (char.trim() === '') {
          // Skip whitespace at start of field
          position++;
        } else {
          state = ParserState.UNQUOTED_FIELD;
          currentField += char;
          position++;
        }
        break;

      case ParserState.UNQUOTED_FIELD:
        if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
          state = ParserState.START_FIELD;
          position++;
        } else if (char === '\n' || char === '\r') {
          currentRow.push(currentField.trim());
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          state = ParserState.START_FIELD;
          position++;
          // Handle CRLF
          if (char === '\r' && position < content.length && content[position] === '\n') {
            position++;
          }
        } else {
          currentField += char;
          position++;
        }
        break;

      case ParserState.QUOTED_FIELD:
        if (char === '"') {
          if (position + 1 < content.length && content[position + 1] === '"') {
            // Escaped quote
            currentField += '"';
            position += 2;
          } else {
            state = ParserState.AFTER_QUOTE;
            position++;
          }
        } else {
          currentField += char;
          position++;
        }
        break;

      case ParserState.AFTER_QUOTE:
        if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
          state = ParserState.START_FIELD;
          position++;
        } else if (char === '\n' || char === '\r') {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          state = ParserState.START_FIELD;
          position++;
          // Handle CRLF
          if (char === '\r' && position < content.length && content[position] === '\n') {
            position++;
          }
        } else if (char.trim() === '') {
          // Allow whitespace after closing quote
          position++;
        } else {
          // Invalid character after closing quote
          throw new Error(`Unexpected character '${char}' after closing quote at position ${position}`);
        }
        break;
    }
  }

  // Handle end of content
  if (state === ParserState.QUOTED_FIELD) {
    throw new Error('Unclosed quoted field at end of file');
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    if (state === ParserState.UNQUOTED_FIELD) {
      currentRow.push(currentField.trim());
    } else {
      currentRow.push(currentField);
    }
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Advanced CSV generator that handles multi-line quoted fields
 * @param path The path to the CSV file
 * @param schema Optional Zod schema for validating and transforming rows
 * @param hasHeader Whether the CSV file has a header row (default: false)
 * @param continueOnError Whether to continue parsing after encountering errors (default: false)
 * @returns Async generator that yields parsed rows or CSVParseError objects
 */
export async function* parseCSVAdvancedGenerator<T = string[]>(
  path: string, 
  schema?: z.ZodType<T>,
  hasHeader: boolean = true,
  continueOnError: boolean = false
): AsyncGenerator<T | CSVParseError> {
  try {
    const content = await fs.promises.readFile(path, 'utf-8');
    const rows = parseCSVWithMultiLineSupport(content);
    
    let headers: string[] | undefined;
    let rowNumber = 0;

    for (let i = 0; i < rows.length; i++) {
      rowNumber++;
      const values = rows[i];

      // Handle header row
      if (hasHeader && rowNumber === 1) {
        headers = values;
        continue; // Skip processing header row as data
      }

      if (schema) {
        const parsed = schema.safeParse(values);
        if (parsed.success) {
          yield parsed.data;
        } else {
          const error = new CSVParseError(
            `CSV row validation failed: ${parsed.error.message}`,
            rowNumber,
            values,
            parsed.error
          );
          
          if (continueOnError) {
            yield error;
          } else {
            throw error;
          }
        }
      } else {
        // If no schema provided, yield the raw string array
        yield values as unknown as T;
      }
    }
  } catch (error) {
    if (error instanceof CSVParseError) {
      throw error;
    }
    throw new CSVParseError(
      `Failed to parse CSV file: ${error instanceof Error ? error.message : String(error)}`,
      0,
      [],
      undefined
    );
  }
}

/**
 * Creates an advanced CSV generator with header information that handles multi-line quoted fields
 * @param path The path to the CSV file
 * @param schema Optional Zod schema for validating and transforming rows
 * @param hasHeader Whether the CSV file has a header row (default: false)
 * @param continueOnError Whether to continue parsing after encountering errors (default: false)
 * @returns Object containing headers and an async generator for rows
 */
export async function createAdvancedCSVGenerator<T = string[]>(
  path: string, 
  schema?: z.ZodType<T>,
  hasHeader: boolean = true,
  continueOnError: boolean = false
): Promise<CSVGeneratorResult<T>> {
  let headers: string[] | undefined;
  
  // If we need headers, we need to read the first row separately
  if (hasHeader) {
    const content = await fs.promises.readFile(path, 'utf-8');
    const rows = parseCSVWithMultiLineSupport(content);
    if (rows.length > 0) {
      headers = rows[0];
    }
  }
  
  const generator = parseCSVAdvancedGenerator(path, schema, hasHeader, continueOnError);
  return { headers, generator };
}

/**
 * Advanced CSV parser that handles multi-line quoted fields
 * @param path The path to the CSV file
 * @param schema Optional Zod schema for validating and transforming rows
 * @param hasHeader Whether the CSV file has a header row (default: false)
 * @param continueOnError Whether to continue parsing after encountering errors (default: false)
 * @returns Promise containing headers (if present), parsed data, and any errors
 */
export async function parseCSVAdvanced<T = string[]>(
  path: string, 
  schema?: z.ZodType<T>,
  hasHeader: boolean = true,
  continueOnError: boolean = false
): Promise<CSVParsedResult<T>> {
  const { headers, generator } = await createAdvancedCSVGenerator(path, schema, hasHeader, continueOnError);
  const data: T[] = [];
  const errors: CSVParseError[] = [];
  
  for await (const result of generator) {
    if (result instanceof CSVParseError) {
      errors.push(result);
    } else {
      data.push(result);
    }
  }
  
  return { 
    headers, 
    data,
    errors: errors.length > 0 ? errors : undefined
  };
}