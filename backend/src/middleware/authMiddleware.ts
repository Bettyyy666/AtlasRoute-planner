/**
 * Authentication Middleware for Firebase ID Token Verification
 *
 * This middleware implements secure authentication by verifying Firebase ID tokens
 * on the backend, preventing spoofing attacks and ensuring only authenticated
 * users can access protected endpoints.
 *
 * Security Features:
 * - Verifies Firebase ID tokens using Firebase Admin SDK
 * - Extracts verified user ID from cryptographically signed token
 * - Rejects requests with missing, invalid, or expired tokens
 * - Prevents trust boundary violations by not trusting client-provided userIds
 *
 * Usage:
 *   app.post("/protected-endpoint", requireAuth, async (req, res) => {
 *     const userId = req.user!.uid; // Verified user ID from token
 *     // ... handle request using verified userId
 *   });
 */

import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";

/**
 * Extended Request interface that includes verified user data
 * After authentication middleware runs, req.user contains the decoded
 * Firebase ID token with verified user information.
 */
export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

/**
 * Authentication middleware that verifies Firebase ID tokens
 *
 * How it works:
 * 1. Extracts the ID token from the Authorization header
 * 2. Verifies the token using Firebase Admin SDK
 * 3. Attaches the verified user data to req.user
 * 4. Calls next() to proceed to the route handler
 *
 * If authentication fails, returns 401 Unauthorized
 *
 * Firebase Admin SDK verification checks:
 * - Token signature matches Firebase's public keys (RS256)
 * - Token hasn't expired (default 1 hour expiration)
 * - Token audience (aud) matches the Firebase project ID
 * - Token issuer (iss) is Firebase Authentication
 * - Token was issued in the past (iat <= now)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Step 1: Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: "Missing authorization header",
        message: "Please sign in to access this resource",
      });
      return;
    }

    // Step 2: Validate header format (must be "Bearer <token>")
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Invalid authorization header format",
        message: "Authorization header must be in format: Bearer <token>",
      });
      return;
    }

    // Step 3: Extract the ID token
    const idToken = authHeader.split("Bearer ")[1];

    if (!idToken || idToken.trim() === "") {
      res.status(401).json({
        error: "Missing ID token",
        message: "Authorization header contains empty token",
      });
      return;
    }

    // Step 4: Verify the ID token using Firebase Admin SDK
    // This is the critical security step - Firebase Admin SDK:
    // - Downloads Firebase's public keys (cached)
    // - Verifies the token signature cryptographically
    // - Checks expiration, audience, issuer, and other claims
    // - Returns the decoded token payload if valid
    //
    // This CANNOT be forged because:
    // - Only Firebase has the private key to sign tokens
    // - We verify using Firebase's public key
    // - Asymmetric encryption (RS256) prevents token creation without private key
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Step 5: Attach verified user data to request
    // Now we have TRUSTED user information from the verified token
    // The userId (uid) cannot be spoofed because it came from the verified token
    req.user = decodedToken;

    // Log successful authentication (optional, useful for debugging/auditing)
    console.log(`Authenticated user: ${decodedToken.uid} (${decodedToken.email || "no email"})`);

    // Step 6: Proceed to the route handler
    next();
  } catch (error: any) {
    // Token verification failed - could be:
    // - Token expired
    // - Invalid signature (forged token)
    // - Malformed token
    // - Token for different Firebase project
    // - Network error downloading Firebase public keys

    console.error("Token verification failed:", error.message);

    // Don't expose internal error details to client (security best practice)
    // Just return a generic authentication error
    res.status(401).json({
      error: "Invalid or expired token",
      message: "Please sign in again to access this resource",
    });
    return;
  }
}

/**
 * Optional middleware for endpoints that work with or without authentication
 * Attempts to verify token if present, but allows request to proceed if not
 *
 * Use case: Public endpoints that show different data for authenticated users
 * Example: A feed that shows personalized content if user is logged in,
 *          but still works for anonymous users with default content
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // No auth header? That's fine, just proceed without user data
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const idToken = authHeader.split("Bearer ")[1];

  if (!idToken || idToken.trim() === "") {
    return next();
  }

  try {
    // Try to verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    console.log(`Authenticated optional request for user: ${decodedToken.uid}`);
  } catch (error) {
    // Token verification failed, but that's okay for optional auth
    // Just log the error and proceed without user data
    console.warn("Optional auth token verification failed:", error);
  }

  next();
}

/**
 * Middleware to check if authenticated user has specific Firebase custom claims
 * Useful for role-based access control (RBAC)
 *
 * Example custom claims:
 * - admin: true
 * - role: "premium"
 * - permissions: ["read", "write", "delete"]
 *
 * Note: This is a proof-of-concept. For production, you'd set custom claims
 * using Firebase Admin SDK:
 *   admin.auth().setCustomUserClaims(uid, { admin: true })
 *
 * @param requiredClaims - Object with required claim key-value pairs
 */
export function requireClaims(requiredClaims: Record<string, any>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "This endpoint requires authentication",
      });
    }

    // Check each required claim
    for (const [claim, value] of Object.entries(requiredClaims)) {
      if (req.user[claim] !== value) {
        console.warn(
          `User ${req.user.uid} missing required claim: ${claim}=${value}`
        );
        return res.status(403).json({
          error: "Insufficient permissions",
          message: `This action requires ${claim}: ${value}`,
        });
      }
    }

    // All claims verified, proceed
    next();
  };
}
