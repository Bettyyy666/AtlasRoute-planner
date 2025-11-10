import { useState, useEffect } from "react";
import { auth } from "../firebase/firebaseConfig";
import "../styles/AdCarousel.css";

interface Ad {
  id: number;
  title: string;
  description: string;
  keywords: string[];
  url: string;
  city: string;
  state: string;
  country: string;
  category: string[];
}

export default function AdCarousel() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const user = auth.currentUser;

  // Load ads on component mount
  useEffect(() => {
    const loadAds = async () => {
      try {
        setLoading(true);

        // If user is logged in, get personalized ads
        if (user?.uid) {
          console.log(
            `🎯 AdCarousel: Fetching personalized ads for user: ${user.uid}`
          );
          const response = await fetch(`/api/ads?userId=${user.uid}&limit=5`);
          const data = await response.json();
          console.log(`📨 AdCarousel: Personalized ads response:`, data);

          if (data.success && data.data.length > 0) {
            console.log(
              `✓ AdCarousel: Got ${data.data.length} personalized ads`
            );
            data.data.forEach((ad: Ad, idx: number) => {
              console.log(`  ${idx + 1}. "${ad.title}" from ${ad.city}`);
            });
            setAds(data.data);
            return;
          } else {
            console.log(
              `⚠️ AdCarousel: No personalized ads returned, falling back to random`
            );
          }
        }

        // Otherwise, get random ads
        console.log(`🎯 AdCarousel: Fetching random ads`);
        const response = await fetch("/api/ads/random?limit=5");
        const data = await response.json();
        console.log(`📨 AdCarousel: Random ads response:`, data);

        if (data.success) {
          console.log(`✓ AdCarousel: Got ${data.data.length} random ads`);
          setAds(data.data);
        }
      } catch (error) {
        console.error("❌ AdCarousel: Error loading ads:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAds();
  }, [user?.uid]);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? ads.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === ads.length - 1 ? 0 : prevIndex + 1
    );
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (loading || ads.length === 0 || !isVisible) {
    return null;
  }

  const currentAd = ads[currentIndex];

  return (
    <div className="ad-carousel-container">
      <button
        className="ad-close-btn"
        onClick={() => setIsVisible(false)}
        title="Close ads"
      >
        ✕
      </button>

      <div className="ad-carousel-content">
        <div className="ad-card">
          <div className="ad-header">
            <h3 className="ad-title">{currentAd.title}</h3>
            <span className="ad-location">
              {currentAd.city}, {currentAd.country}
            </span>
          </div>

          <p className="ad-description">{currentAd.description}</p>

          <div className="ad-categories">
            {currentAd.category.slice(0, 2).map((cat, idx) => (
              <span key={idx} className="ad-category-tag">
                {cat}
              </span>
            ))}
          </div>

          <a
            href={currentAd.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ad-button"
          >
            Learn More
          </a>
        </div>

        {/* Navigation Controls */}
        <div className="ad-carousel-nav">
          <button
            className="ad-nav-btn ad-nav-prev"
            onClick={goToPrevious}
            aria-label="Previous ad"
          >
            ❮
          </button>

          <div className="ad-dots">
            {ads.map((_, index) => (
              <button
                key={index}
                className={`ad-dot ${index === currentIndex ? "active" : ""}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to ad ${index + 1}`}
              />
            ))}
          </div>

          <button
            className="ad-nav-btn ad-nav-next"
            onClick={goToNext}
            aria-label="Next ad"
          >
            ❯
          </button>
        </div>

        {/* Counter */}
        <div className="ad-counter">
          {currentIndex + 1} / {ads.length}
        </div>
      </div>
    </div>
  );
}
