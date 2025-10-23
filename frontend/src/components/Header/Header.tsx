import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Header.css";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../../firebase/firebaseConfig";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  const handlePlannerClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      e.preventDefault();
      toast.info("You must log in to view your previous trips.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out successfully!");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out.");
    }
  };

  return (
    <header className="header">
      <div className="branding">Trip Planner</div>

      <div className="nav">
        <Link
          to="/"
          className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
        >
          Predetermined Trips
        </Link>
        <Link
          to="/planner"
          onClick={handlePlannerClick}
          className={`nav-link ${
            location.pathname === "/planner" ? "active" : ""
          }`}
        >
          Previous Trips
        </Link>
      </div>

      <div className="login-btn">
        {user ? (
          <div className="flex items-center gap-2" onClick={handleSignOut}>
            <span>Sign out</span>
          </div>
        ) : (
          <Link to="/login" className="text-blue-500 hover:underline">
            Log In
          </Link>
        )}
      </div>
    </header>
  );
}
