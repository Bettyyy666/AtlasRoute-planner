import React, { createContext, useContext, useState, useEffect } from "react";

interface SimpleModeContextType {
  isSimpleMode: boolean;
  toggleSimpleMode: () => void;
}

const SimpleModeContext = createContext<SimpleModeContextType | undefined>(
  undefined
);

export const SimpleModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSimpleMode, setIsSimpleMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("simpleMode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("simpleMode", String(isSimpleMode));

    if (isSimpleMode) {
      document.body.classList.add("simple-mode");
    } else {
      document.body.classList.remove("simple-mode");
    }
  }, [isSimpleMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setIsSimpleMode((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSimpleMode = () => {
    setIsSimpleMode((prev) => !prev);
  };

  return (
    <SimpleModeContext.Provider value={{ isSimpleMode, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
};

export const useSimpleMode = () => {
  const context = useContext(SimpleModeContext);
  if (context === undefined) {
    throw new Error("useSimpleMode must be used within SimpleModeProvider");
  }
  return context;
};
