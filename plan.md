# Pin Review Feature Implementation Plan

## Overview
This plan outlines the implementation of a feature allowing users to attach written reviews to pin locations, view them as pop-ups on the map, and edit them as needed. Reviews will be persistent in the cloud, and users will only be able to edit their own reviews.

## Database Schema

### Review Collection
```typescript
interface Review {
  id: string;           // Unique identifier for the review
  pinId: string;        // ID of the pin this review is attached to
  userId: string;       // ID of the user who created the review
  content: string;      // The review text content
  createdAt: number;    // Timestamp when the review was created
  updatedAt: number;    // Timestamp when the review was last updated
}
```

## Backend Implementation

### 1. Firebase Schema Updates
- Add a new `reviews` collection in Firestore
- Update security rules to ensure users can only edit their own reviews

### 2. Backend API Endpoints
Create the following handlers in `/backend/src/firebase/handlers/`:

#### `registerReviewHandlers.ts`
```typescript
// Create a new review
app.post('/api/reviews', async (req, res) => {
  // Validate user authentication
  // Create review document
  // Return success/failure
});

// Get reviews for a specific pin
app.get('/api/reviews/:pinId', async (req, res) => {
  // Fetch all reviews for the given pinId
  // Return reviews array
});

// Update a review
app.put('/api/reviews/:reviewId', async (req, res) => {
  // Validate user authentication and ownership
  // Update review content
  // Return success/failure
});

// Delete a review
app.delete('/api/reviews/:reviewId', async (req, res) => {
  // Validate user authentication and ownership
  // Delete review
  // Return success/failure
});
```

### 3. Register Handlers
Update `/backend/src/firebase/index.ts` to register the new review handlers.

## Frontend Implementation

### 1. Types and Services

#### Create `/frontend/src/features/Reviews/types/reviewTypes.ts`
```typescript
export interface Review {
  id: string;
  pinId: string;
  userId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
```

#### Create `/frontend/src/features/Reviews/services/ReviewService.ts`
```typescript
// Service for handling review CRUD operations
export class ReviewService {
  // Create a new review
  static async createReview(pinId: string, content: string): Promise<Review> {...}
  
  // Get reviews for a pin
  static async getReviewsForPin(pinId: string): Promise<Review[]> {...}
  
  // Update a review
  static async updateReview(reviewId: string, content: string): Promise<Review> {...}
  
  // Delete a review
  static async deleteReview(reviewId: string): Promise<boolean> {...}
  
  // Check if user owns a review
  static isReviewOwner(review: Review, userId: string): boolean {...}
}
```

### 2. UI Components

#### Create `/frontend/src/features/Reviews/components/ReviewForm.tsx`
- Form component for adding/editing reviews
- Include text area for review content
- Submit and cancel buttons
- Validation for empty reviews

#### Create `/frontend/src/features/Reviews/components/ReviewList.tsx`
- Component to display a list of reviews for a pin
- Show author information and timestamps
- Show edit/delete buttons for reviews owned by the current user

#### Create `/frontend/src/features/Reviews/components/ReviewItem.tsx`
- Component to display a single review
- Include edit/delete functionality for owner

### 3. Integration with Map and Pin Components

#### Update `/frontend/src/features/Map/MapView.tsx`
- Enhance pin popup to include reviews section
- Add button to add/edit review in popup
- Display existing reviews in popup

#### Update `/frontend/src/features/PinFolder/PinCard.tsx`
- Add review indicator to pin cards

## Authentication and Authorization

### 1. User Authentication Check
- Use existing Firebase authentication to identify users
- Store user ID with each review
- Implement client and server-side checks to ensure users can only edit their own reviews

### 2. Security Rules
Update Firebase security rules to enforce review ownership:
```
match /reviews/{reviewId} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
}
```

## Implementation Steps

### Phase 1: Backend Setup
1. Create the review schema in Firebase
2. Implement backend API endpoints for CRUD operations
3. Update security rules
4. Test API endpoints

### Phase 2: Frontend Services
1. Create review types and services
2. Implement service methods for API communication
3. Test service integration with backend

### Phase 3: UI Components
1. Create review form component
2. Create review list and item components
3. Test components in isolation

### Phase 4: Integration
1. Update MapView to display reviews in pin popups
2. Update PinCard to show review indicators
3. Integrate review form for adding/editing
4. Test end-to-end functionality

### Phase 5: Testing and Refinement
1. Test user authentication and authorization
2. Verify persistence of reviews
3. Test editing restrictions
4. Optimize performance
5. Refine UI/UX

## Testing Strategy
1. Unit tests for review services
2. Integration tests for API endpoints
3. Component tests for UI elements
4. End-to-end tests for complete user flows
5. Authentication tests to verify editing restrictions

## Conclusion
This implementation plan provides a comprehensive approach to adding the pin review feature. By following the outlined steps, we will create a system that allows users to attach, view, and edit reviews for pin locations, with reviews being persistent in the cloud and editable only by their creators.