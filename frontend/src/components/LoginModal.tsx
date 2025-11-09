import React, { useEffect } from 'react';
import Login from '../pages/Login';
import './Modal.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: (page: 'register' | 'recover') => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSwitch }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-container modal-enter">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="modal-content">
          <Login onSwitch={onSwitch} />
        </div>
      </div>
    </div>
  );
};

export default LoginModal;