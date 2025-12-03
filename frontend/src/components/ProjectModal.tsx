import React, { useEffect, useState } from 'react';
import { createProject, updateProject, Project } from '../services/api';
import './Modal.css';
import './SupportModal.css';
import './ProjectModal.css';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProject?: Project | null;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSuccess, editProject }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = !!editProject;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (editProject) {
        setName(editProject.name);
        setDescription(editProject.description || '');
      } else {
        setName('');
        setDescription('');
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, editProject]);

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
      setName('');
      setDescription('');
      setError('');
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      handleClose();
    }
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && editProject) {
        await updateProject(editProject.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createProject(name.trim(), description.trim() || undefined);
      }
      onSuccess();
      handleClose();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} project. Please try again.`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-container project-modal-container modal-enter">
        <button
          className="modal-close"
          onClick={handleClose}
          disabled={loading}
          aria-label="Close"
        >
          ✕
        </button>
        
        <div className="modal-content">
          <h2 className="project-modal-title">
            {isEditMode ? 'Edit Project' : 'New Project'}
          </h2>
          <p className="project-modal-subtitle">
            {isEditMode 
              ? 'Update your project details.'
              : 'Create a project to organize your conversations. Conversations in the same project share context.'
            }
          </p>

          <form onSubmit={handleSubmit} className="project-form">
            <div className="form-group">
              <label htmlFor="project-name" className="form-label">
                Project Name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Research, Code Review..."
                disabled={loading}
                className="form-input"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="project-description" className="form-label">
                Description <span className="form-optional">(optional)</span>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                disabled={loading}
                className="form-textarea"
                rows={3}
                maxLength={500}
              />
              <div className="form-hint">
                {description.length}/500 characters
              </div>
            </div>

            {error && (
              <div className="project-error">
                {error}
              </div>
            )}

            <div className="project-modal-actions">
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
                disabled={loading || !name.trim()}
                className="btn btn-primary"
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    {isEditMode ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Save Changes' : 'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal;

