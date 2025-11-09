import { useState } from "react";
import AdConsentDialog from "./AdConsentDialog";
import "../styles/AdPreferencesFloatingButton.css";

export default function AdPreferencesFloatingButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        className="ad-preferences-floating-btn"
        onClick={() => setIsDialogOpen(true)}
        title="Ad Preferences"
      >
        🔒
      </button>
      <AdConsentDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}
