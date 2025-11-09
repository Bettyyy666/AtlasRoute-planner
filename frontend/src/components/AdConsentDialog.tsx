import { useState, useEffect } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "../styles/AdConsentDialog.css";

interface AdPreferences {
  locationBased: boolean;
  keywordBased: boolean;
  sensitiveCategoryAds: boolean;
  lastUpdated: number;
}

const DEFAULT_PREFERENCES: AdPreferences = {
  locationBased: false,
  keywordBased: false,
  sensitiveCategoryAds: false,
  lastUpdated: 0,
};

interface AdConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdConsentDialog({
  isOpen,
  onClose,
}: AdConsentDialogProps) {
  const [preferences, setPreferences] =
    useState<AdPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const user = auth.currentUser;

  // Load preferences from Firebase on mount and when user changes
  useEffect(() => {
    if (!isOpen || !user) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const preferencesRef = doc(
          db,
          "users",
          user.uid,
          "privacy",
          "adPreferences"
        );
        const docSnap = await getDoc(preferencesRef);

        if (docSnap.exists()) {
          setPreferences(docSnap.data() as AdPreferences);
        } else {
          // First time: use defaults (all OFF)
          setPreferences(DEFAULT_PREFERENCES);
        }
      } catch (error) {
        console.error("Error loading ad preferences:", error);
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [isOpen, user]);

  const handleToggle = (key: keyof AdPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const preferencesRef = doc(
        db,
        "users",
        user.uid,
        "privacy",
        "adPreferences"
      );
      await setDoc(preferencesRef, {
        ...preferences,
        lastUpdated: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Error saving ad preferences:", error);
      alert("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Skipping without saving means all consents remain OFF
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="ad-consent-overlay">
      <div className="ad-consent-modal">
        <div className="ad-consent-header">
          <h2>Ad Preferences</h2>
          <button className="ad-consent-close" onClick={handleSkip}>
            ✕
          </button>
        </div>

        <div className="ad-consent-body">
          <p className="ad-consent-intro">
            We use data about your travels and interests to provide personalized
            ads. You can control what types of ads you see below. By default,
            all ad personalization is disabled.
          </p>

          {loading ? (
            <div className="ad-consent-loading">
              Loading your preferences...
            </div>
          ) : (
            <div className="ad-consent-preferences">
              {/* Location-based ads */}
              <div className="ad-consent-item">
                <div className="ad-consent-toggle-container">
                  <input
                    type="checkbox"
                    id="location-based"
                    checked={preferences.locationBased}
                    onChange={() => handleToggle("locationBased")}
                    className="ad-consent-checkbox"
                  />
                  <label htmlFor="location-based" className="ad-consent-label">
                    <strong>Location-Based Ads</strong>
                    <p className="ad-consent-description">
                      Use cities and countries from your saved trips to show
                      relevant travel and local business ads.
                    </p>
                  </label>
                </div>
              </div>

              {/* Keyword-based ads */}
              <div className="ad-consent-item">
                <div className="ad-consent-toggle-container">
                  <input
                    type="checkbox"
                    id="keyword-based"
                    checked={preferences.keywordBased}
                    onChange={() => handleToggle("keywordBased")}
                    className="ad-consent-checkbox"
                  />
                  <label htmlFor="keyword-based" className="ad-consent-label">
                    <strong>Keyword & Category-Based Ads</strong>
                    <p className="ad-consent-description">
                      Use keywords from saved places (restaurants, museums,
                      etc.) to personalize ads for activities and services you
                      might like.
                    </p>
                  </label>
                </div>
              </div>

              {/* Sensitive category ads */}
              <div className="ad-consent-item">
                <div className="ad-consent-toggle-container">
                  <input
                    type="checkbox"
                    id="sensitive-category"
                    checked={preferences.sensitiveCategoryAds}
                    onChange={() => handleToggle("sensitiveCategoryAds")}
                    className="ad-consent-checkbox"
                  />
                  <label
                    htmlFor="sensitive-category"
                    className="ad-consent-label"
                  >
                    <strong>Sensitive Category Ads</strong>
                    <p className="ad-consent-description">
                      Allow ads for sensitive categories like financial
                      services, healthcare products, and wellness services.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ad-consent-footer">
          <button
            className="ad-consent-btn ad-consent-btn-secondary"
            onClick={handleSkip}
            disabled={saving}
          >
            Skip for Now
          </button>
          <button
            className="ad-consent-btn ad-consent-btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
