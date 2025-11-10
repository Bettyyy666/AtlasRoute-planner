import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/firebaseConfig";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Header from "./components/Header/Header";
import { ClerkProvider } from "@clerk/clerk-react";
import { ToastContainer } from "react-toastify";
import Login from "./pages/Login";
import FBIDataTest from "./features/DataQuery/FBIDataTest";
import { SimpleModeProvider } from "./contexts/SimpleModeContext";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import AdConsentDialog from "./components/AdConsentDialog";
import AdPreferencesFloatingButton from "./components/AdPreferencesFloatingButton";
import AdCarousel from "./components/AdCarousel";

const clerkFrontendApi = import.meta.env.VITE_CLERK_FRONTEND_API;

function App() {
  const [showAdConsent, setShowAdConsent] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [lastAuthTime, setLastAuthTime] = useState<number>(0);

  // Monitor auth state changes and show consent dialog on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const wasLoggedIn = isUserLoggedIn;
      const isNowLoggedIn = !!user;

      if (isNowLoggedIn && !wasLoggedIn) {
        // User just logged in - show consent dialog
        setShowAdConsent(true);
        setLastAuthTime(Date.now());
      }

      setIsUserLoggedIn(isNowLoggedIn);
    });

    return () => unsubscribe();
  }, [isUserLoggedIn]);

  return (
    //TODO: only uncomment these after Sprint ...
    // <ClerkProvider publishableKey={clerkFrontendApi}>
    <DarkModeProvider>
      <SimpleModeProvider>
        <Router>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/fbi-test" element={<FBIDataTest />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastContainer position="top-center" autoClose={3000} />

          {/* Ad Consent Dialog - shown on every login */}
          <AdConsentDialog
            isOpen={showAdConsent}
            onClose={() => setShowAdConsent(false)}
          />

          {/* Floating button for anytime access to preferences */}
          {isUserLoggedIn && <AdPreferencesFloatingButton />}

          {/* Ad Carousel - displays personalized or random ads */}
          <AdCarousel />
        </Router>
      </SimpleModeProvider>
    </DarkModeProvider>
    // </ClerkProvider>
  );
}

export default App;
