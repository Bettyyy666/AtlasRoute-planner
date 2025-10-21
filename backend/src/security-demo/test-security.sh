#!/bin/bash

# Security Testing Script
# This script demonstrates the vulnerability and the fix

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Security Test: API Spoofing Vulnerability            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

API_URL="http://localhost:3001"

echo "Prerequisites:"
echo "  1. Backend server must be running (npm run dev)"
echo "  2. For authenticated tests, you need a Firebase ID token"
echo ""
echo "How to get a Firebase token:"
echo "  1. Open frontend (http://localhost:5173)"
echo "  2. Sign in with Google"
echo "  3. Open browser console (F12)"
echo "  4. Run: await firebase.auth().currentUser.getIdToken()"
echo "  5. Copy the token and set FIREBASE_TOKEN environment variable"
echo ""

# Test 1: Unauthenticated Request (Should fail with 401 if secured)
echo "═══════════════════════════════════════════════════════"
echo "Test 1: Unauthenticated Spoofing Attack"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Attempting to create a trip WITHOUT authentication..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/savePins" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "fake-user-id-12345",
    "title": "Spoofed Trip",
    "destination": {
      "name": "Fake Destination",
      "lat": 37.7749,
      "lng": -122.4194
    },
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-01-02T00:00:00.000Z",
    "activities": {}
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v HTTP_STATUS)

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_STATUS" -eq 401 ]; then
  echo "✅ SECURE: Request blocked (401 Unauthorized)"
  echo "   Authentication middleware is working!"
elif [ "$HTTP_STATUS" -eq 200 ]; then
  echo "❌ VULNERABLE: Request succeeded without authentication!"
  echo "   This is a critical security flaw."
  echo "   An attacker can create trips for any user."
else
  echo "⚠️  Unexpected status: $HTTP_STATUS"
fi