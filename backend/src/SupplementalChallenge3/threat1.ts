// Rate limiting middleware

const requestCounts = new Map<string, {count: number, timestamp: number}>();
const RATE_LIMIT = 20; // Max requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute window

export const rateLimiter = (req: any, res: any, next: any) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Get or initialize request data for this IP
  const data = requestCounts.get(ip) || { count: 0, timestamp: now };
  
  // Reset counter if outside the time window
  if (now - data.timestamp > WINDOW_MS) {
    data.count = 0;
    data.timestamp = now;
  }
  
  // Increment request count
  data.count++;
  requestCounts.set(ip, data);
  
  // Check if rate limit exceeded
  if (data.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }
  
  next();
};
