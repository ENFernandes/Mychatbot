import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import './Modal.css';
import './SupportModal.css';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Billing');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [requestId, setRequestId] = useState('');

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading]);

  const handleClose = () => {
    if (!loading) {
      setSubject('');
      setCategory('Billing');
      setMessage('');
      setError('');
      setSuccess(false);
      setRequestId('');
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      handleClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!message.trim()) {
      setError('Message is required');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/support', {
        subject: subject.trim(),
        category,
        message: message.trim(),
      });

      setSuccess(true);
      setRequestId(data.requestId || '');
      
      // Reset form after 3 seconds and close
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Failed to submit support request. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-container support-modal-container modal-enter">
        <button
          className="modal-close"
          onClick={handleClose}
          disabled={loading}
          aria-label="Close"
        >
          ✕
        </button>
        
        <div className="modal-content">
          {success ? (
            <div className="support-success">
              <div className="support-success-icon">✓</div>
              <h3 className="support-success-title">Request Submitted!</h3>
              <p className="support-success-message">
                Your support request has been received. We'll get back to you soon.
              </p>
              {requestId && (
                <p className="support-success-id">
                  Request ID: <strong>{requestId.substring(0, 8)}</strong>
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 className="support-modal-title">Get Help</h2>
              <p className="support-modal-subtitle">
                Send us a message and we'll respond as soon as possible.
              </p>

              <form onSubmit={handleSubmit} className="support-form">
                <div className="form-group">
                  <label htmlFor="support-category" className="form-label">
                    Category
                  </label>
                  <select
                    id="support-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading}
                    className="form-select"
                  >
                    <option value="Billing">Billing</option>
                    <option value="API Keys">API Keys</option>
                    <option value="Bug">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="support-subject" className="form-label">
                    Subject
                  </label>
                  <input
                    id="support-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    disabled={loading}
                    className="form-input"
                    maxLength={200}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="support-message" className="form-label">
                    Message
                  </label>
                  <textarea
                    id="support-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    disabled={loading}
                    className="form-textarea"
                    rows={6}
                    maxLength={2000}
                  />
                  <div className="form-hint">
                    {message.length}/2000 characters
                  </div>
                </div>

                {error && (
                  <div className="support-error">
                    {error}
                  </div>
                )}

                <div className="support-actions">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !subject.trim() || !message.trim()}
                    className="btn btn-primary"
                  >
                    {loading ? (
                      <>
                        <span className="spinner"></span>
                        Sending...
                      </>
                    ) : (
                      'Send Request'
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportModal;

