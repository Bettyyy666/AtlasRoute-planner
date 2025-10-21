import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Header from "./components/Header/Header";
import { ClerkProvider } from "@clerk/clerk-react";
import { ToastContainer } from "react-toastify";
import Login from "./pages/Login";
import FBIDataTest from "./features/DataQuery/FBIDataTest";
import { SimpleModeProvider } from "./contexts/SimpleModeContext";
import { DarkModeProvider } from "./contexts/DarkModeContext";

const clerkFrontendApi = import.meta.env.VITE_CLERK_FRONTEND_API;

function App() {
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
        </Router>
      </SimpleModeProvider>
    </DarkModeProvider>
    // </ClerkProvider>

  );
}

export default App;
