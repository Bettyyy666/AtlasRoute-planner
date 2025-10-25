import React, { useState, useEffect } from "react";
import { reviewService } from "./ReviewService";
import { auth } from "../../firebase/firebaseConfig";
import { ReviewForm } from "./ReviewForm";
import "./Reviews.css";

interface MapReviewPopupProps {
  pinId: string;
}

export const MapReviewPopup: React.FC<MapReviewPopupProps> = ({ pinId }) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    // Get current user
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid || null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const fetchedReviews = await reviewService.getReviewsByPin(pinId);
        setReviews(fetchedReviews);
      } catch (err) {
        console.error("Error fetching reviews:", err);
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

  const handleEditReview = (review: any) => {
    setEditingReviewId(review.id);
    setEditContent(review.content);
  };

  const handleSaveEdit = async () => {
    if (!editingReviewId || !userId) return;
    
    try {
      await reviewService.updateReview(editingReviewId, {
        userId,
        reviewId: editingReviewId,
        content: editContent
      });
      
      // Refresh reviews
      const updatedReviews = await reviewService.getReviewsByPin(pinId);
      setReviews(updatedReviews);
      setEditingReviewId(null);
    } catch (err) {
      console.error("Error updating review:", err);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this review?") || !userId) return;
    
    try {
      await reviewService.deleteReview(reviewId, userId);
      
      // Refresh reviews
      const updatedReviews = await reviewService.getReviewsByPin(pinId);
      setReviews(updatedReviews);
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  // Check if user already has a review for this pin
  const userHasReview = userId ? reviews.some(review => review.userId === userId) : false;

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div>Loading reviews...</div>;
  }

  return (
    <div className="map-popup-reviews">
      <div className="reviews-header">
        <h4 className="reviews-title">Reviews ({reviews.length})</h4>
        {userId && !userHasReview && !showAddForm && (
          <button 
            className="add-review-btn"
            onClick={() => setShowAddForm(true)}
          >
            Add Review
          </button>
        )}
      </div>

      {showAddForm && userId && (
        <ReviewForm
          pinId={pinId}
          userId={userId}
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {reviews.length === 0 && !showAddForm ? (
        <p className="no-reviews">No reviews yet</p>
      ) : (
        <div className="map-reviews-list">
          {reviews.slice(0, 2).map(review => (
            <div key={review.id} className="map-review-item">
              <div className="review-header">
                <span className="review-user">User {review.userId.substring(0, 6)}...</span>
                <span className="review-date">{formatDate(review.updatedAt)}</span>
                {userId === review.userId && (
                  <div className="review-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => handleEditReview(review)}
                    >
                      Edit
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteReview(review.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              
              {editingReviewId === review.id ? (
                <div className="edit-review-form">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="edit-review-textarea"
                  />
                  <div className="edit-actions">
                    <button onClick={handleSaveEdit} className="save-btn">Save</button>
                    <button onClick={() => setEditingReviewId(null)} className="cancel-btn">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="review-content">{review.content}</div>
              )}
            </div>
          ))}
          {reviews.length > 2 && (
            <div className="more-reviews">
              +{reviews.length - 2} more reviews
            </div>
          )}
        </div>
      )}
    </div>
  );
};