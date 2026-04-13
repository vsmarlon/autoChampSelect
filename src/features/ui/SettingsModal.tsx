import React from "react";
import { SettingsContent } from "./SettingsContent";

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  return (
    <div className="select-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="select-modal-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="select-modal-header">
          <div>
            <h2 className="select-modal-title">Auto Champion Select</h2>
            <p className="select-modal-subtitle">Shared control surface for the lobby panel and champ select action button.</p>
          </div>
          <button type="button" className="select-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="select-modal-body">
          <SettingsContent variant="modal" />
        </div>
      </div>
    </div>
  );
};
