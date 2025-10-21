# Security Proof of Concept: API Spoofing Attack Mitigation

## Overview

This directory contains a proof-of-concept demonstration of the authentication vulnerability in the trip management API and how to fix it using Firebase ID token verification.

## Files

### 1. `test-security.sh`
Bash script with manual curl commands to test the security fix.

**Usage without token** (tests vulnerability):
```bash
./src/security-demo/test-security.sh
```
## How to Test the Security Fix

### Step 1: Run the Backend (Current Vulnerable Version)

```bash
cd backend
npm run dev
```

The backend should start on `http://localhost:3001`

### Step 2: Test the Vulnerability

Run the test script:

```bash
./src/security-demo/test-security.sh
```

**Expected Result (BEFORE fix)**:
```
Test 1: Unauthenticated Spoofing Attack
Response Status: 200
❌ VULNERABLE: Request succeeded without authentication!
```

This proves the vulnerability - attackers can create trips without any authentication.

### Step 3: Apply the Security Fix

See `registerSaveTripHandler-SECURE.ts` for the complete implementation. Key changes:

1. Import the authentication middleware:
```typescript
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
```

2. Add middleware to protected endpoints:
```typescript
app.post("/savePins", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.uid; // Use verified userId from token
  // ...
});
```

3. Add authorization checks:
```typescript
if (tripData.userId !== authenticatedUserId) {
  return res.status(403).json({ error: "Forbidden: UserId mismatch" });
}
```

### Step 4: Test the Fix

Run the test script again:

```bash
./src/security-demo/test-security.sh
```

**Expected Result (AFTER fix)**:
```
Test 1: Unauthenticated Spoofing Attack
Response Status: 401
✅ SECURE: Request blocked (401 Unauthorized)
```