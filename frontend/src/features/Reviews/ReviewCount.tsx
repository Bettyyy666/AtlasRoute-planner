import React, { useState, useEffect } from "react";
import { reviewService } from "./ReviewService";
import "./Reviews.css";

interface ReviewCountProps {
  pinId: string;
}

export const ReviewCount: React.FC<ReviewCountProps> = ({ pinId }) => {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviewCount = async () => {
      try {
        const reviews = await reviewService.getReviewsByPin(pinId);
        setCount(reviews.length);
      } catch (err) {
        console.error("Error fetching review count:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewCount();
  }, [pinId]);

  if (loading || count === null) {
    return null;
  }

  if (count === 0) {
    return null;
  }

  return (
    <div className="review-count" title={`${count} review${count !== 1 ? 's' : ''}`}>
      {count}
    </div>
  );
};