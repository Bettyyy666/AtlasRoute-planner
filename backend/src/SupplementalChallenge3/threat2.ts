// Path validation for CSV files with role-based access control and filename sanitization
import * as path from 'path';
import * as fs from 'fs';

// Define the allowed CSV directories with access levels
const CSV_DIRECTORIES = {
  public: path.resolve(__dirname, '../data/public'),
  restricted: path.resolve(__dirname, '../data/restricted'),
  admin: path.resolve(__dirname, '../data/admin')
};

// Simple user role simulation - in a real app, this would come from authentication
const getUserRole = (req: any): 'public' | 'restricted' | 'admin' => {
  // For demo purposes, we'll use a header or query param
  const authHeader = req.headers['authorization'];
  
  if (authHeader === 'Bearer admin-token') return 'admin';
  if (authHeader === 'Bearer restricted-token') return 'restricted';
  return 'public';
};

// Sanitize filename to prevent path traversal
const sanitizeFilename = (filename: string): string => {
  // Remove any directory traversal sequences
  let sanitized = filename.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  
  // Remove any absolute path indicators
  sanitized = sanitized.replace(/^\/+/g, '');
  
  // Only allow alphanumeric, underscore, hyphen, and .csv extension
  if (!/^[a-zA-Z0-9_-]+\.csv$/.test(sanitized)) {
    return '';
  }
  
  return sanitized;
};

export const registerGetCSVHandler = (app: any) => {
  app.get('/getcsv', (req: any, res: any) => {
    const filename = req.query.filename;
    const userRole = getUserRole(req);
    
    // Basic validation
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Sanitize the filename
    const sanitizedFilename = sanitizeFilename(filename);
    if (!sanitizedFilename) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }
    
    // Determine which directories the user can access based on role
    const accessibleDirs = [];
    if (userRole === 'public') accessibleDirs.push(CSV_DIRECTORIES.public);
    if (userRole === 'restricted') accessibleDirs.push(CSV_DIRECTORIES.public, CSV_DIRECTORIES.restricted);
    if (userRole === 'admin') accessibleDirs.push(CSV_DIRECTORIES.public, CSV_DIRECTORIES.restricted, CSV_DIRECTORIES.admin);
    
    // Try to find the file in accessible directories
    let filePath = null;
    for (const dir of accessibleDirs) {
      const testPath = path.join(dir, sanitizedFilename);
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    // If file not found in accessible directories
    if (!filePath) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }
    
    // Safe to proceed with file access
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      res.type('text/csv').send(data);
    } catch (error) {
      res.status(500).json({ error: 'Error reading file' });
    }
  });
};