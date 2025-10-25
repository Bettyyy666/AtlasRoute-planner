import React, { useState } from "react";
import { reviewService } from "./ReviewService";
import "./Reviews.css";

interface ReviewFormProps {
  pinId: string;
  userId: string;
  reviewId?: string;
  initialContent?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
  pinId,
  userId,
  reviewId,
  initialContent = "",
  onSuccess,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      let response;

      if (reviewId) {
        // Update existing review
        response = await reviewService.updateReview(reviewId, {
          userId,
          reviewId,
          content,
        });
      } else {
        // Add new review
        response = await reviewService.addReview({
          userId,
          pinId,
          content,
        });
      }

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError("An error occurred while saving the review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <textarea
        className="review-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your review here..."
        required
        disabled={isSubmitting}
      />
      
      {error && <div className="review-error">{error}</div>}
      
      <div className="review-form-actions">
        <button 
          type="button" 
          className="review-cancel-btn"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="review-submit-btn"
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting ? "Saving..." : reviewId ? "Update Review" : "Add Review"}
        </button>
      </div>
    </form>
  );
};