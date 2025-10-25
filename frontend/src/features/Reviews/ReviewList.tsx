import React, { useState, useEffect } from "react";
import { Review } from "../../types/reviewTypes";
import { reviewService } from "./ReviewService";
import { ReviewForm } from "./ReviewForm";
import "./Reviews.css";

interface ReviewListProps {
  pinId: string;
  userId: string;
}

export const ReviewList: React.FC<ReviewListProps> = ({ pinId, userId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  // Fetch reviews when component mounts or pinId changes
  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const fetchedReviews = await reviewService.getReviewsByPin(pinId);
        setReviews(fetchedReviews);
        setError("");
      } catch (err) {
        setError("Failed to load reviews");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [pinId]);

  const handleAddSuccess = () => {
    setShowAddForm(false);
    // Refresh reviews
    reviewService.getReviewsByPin(pinId).then(setReviews);
  };

  const handleEditSuccess = () => {
    setEditingReviewId(null);
    // Refresh reviews
    reviewService.getReviewsByPin(pinId).then(setReviews);
  };

  const handleDelete = async (reviewId: string) => {
    if (window.confirm("Are you sure you want to delete this review?")) {
      try {
        const response = await reviewService.deleteReview(reviewId, userId);
        if (response.success) {
          // Remove the deleted review from the list
          setReviews(reviews.filter(review => review.id !== reviewId));
        } else {
          alert(response.message);
        }
      } catch (err) {
        alert("Failed to delete review");
        console.error(err);
      }
    }
  };

  // Check if user already has a review for this pin
  const userHasReview = reviews.some(review => review.userId === userId);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div>Loading reviews...</div>;
  }

  if (error) {
    return <div className="review-error">{error}</div>;
  }

  return (
    <div className="reviews-container">
      <div className="reviews-header">
        <h3 className="reviews-title">Reviews ({reviews.length})</h3>
        {!userHasReview && !showAddForm && (
          <button 
            className="add-review-btn"
            onClick={() => setShowAddForm(true)}
          >
            Add Review
          </button>
        )}
      </div>

      {showAddForm && (
        <ReviewForm
          pinId={pinId}
          userId={userId}
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {reviews.length === 0 && !showAddForm ? (
        <p>No reviews yet. Be the first to add a review!</p>
      ) : (
        reviews.map(review => (
          <div key={review.id} className="review-item">
            {editingReviewId === review.id ? (
              <ReviewForm
                pinId={pinId}
                userId={userId}
                reviewId={review.id}
                initialContent={review.content}
                onSuccess={handleEditSuccess}
                onCancel={() => setEditingReviewId(null)}
              />
            ) : (
              <>
                <div className="review-header">
                  <span className="review-user">User {review.userId.substring(0, 6)}...</span>
                  <span className="review-date">{formatDate(review.updatedAt)}</span>
                </div>
                <div className="review-content">{review.content}</div>
                {review.userId === userId && (
                  <div className="review-actions">
                    <button 
                      className="review-edit-btn"
                      onClick={() => setEditingReviewId(review.id)}
                    >
                      Edit
                    </button>
                    <button 
                      className="review-delete-btn"
                      onClick={() => handleDelete(review.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};