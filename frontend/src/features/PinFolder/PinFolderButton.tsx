import React from "react";
import "./PinFolder.css";

interface PinFolderButtonProps {
  onClick: () => void;
  pinCount: number;
}

const PinFolderButton: React.FC<PinFolderButtonProps> = ({ onClick, pinCount }) => {
  return (
    <button
      className="pin-folder-button"
      onClick={onClick}
      aria-label="Open pin folder"
      title={`Open pin folder (${pinCount} pins)`}
    >
      📌
    </button>
  );
};

export default PinFolderButton;