import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import './Landing.css';

interface LandingProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

const Landing: React.FC<LandingProps> = ({ onOpenLogin, onOpenRegister }) => {
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const features = [
    {
      icon: '💬',
      title: 'Natural Conversations',
      description: 'Engage with AI-powered chatbots that understand context and provide meaningful responses.',
    },
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Get instant responses with our optimized AI models for seamless user experience.',
    },
    {
      icon: '🔒',
      title: 'Secure & Private',
      description: 'Your conversations and API keys are encrypted and stored securely.',
    },
    {
      icon: '🤖',
      title: 'Multiple AI Providers',
      description: 'Choose from OpenAI, Google Gemini, or Anthropic Claude - all in one platform.',
    },
  ];

  return (
    <div className="landing-page">
      {/* Header */}
      <header className={`landing-header ${scrolled ? 'scrolled' : ''}`}>
        <nav className="header-nav">
          <div className="header-brand" onClick={() => {
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }} style={{ cursor: 'pointer' }}>
            <span className="header-logo">💬</span>
            <span className="header-name">MyChatBots</span>
          </div>
          <div className="header-links">
            <a href="#features" className="header-link" onClick={(e) => {
              e.preventDefault();
              const element = document.getElementById('features');
              if (element) {
                const headerOffset = 80;
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth'
                });
              }
            }}>Features</a>
            <a href="#pricing" className="header-link" onClick={(e) => {
              e.preventDefault();
              const element = document.getElementById('pricing');
              if (element) {
                const headerOffset = 80;
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth'
                });
              }
            }}>Pricing</a>
          </div>
          <div className="header-actions">
            <button 
              className="btn btn-theme-toggle" 
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="btn btn-ghost" onClick={onOpenLogin}>Login</button>
            <button className="btn btn-primary-header" onClick={onOpenRegister}>Sign Up</button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background"></div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">✨</span>
            <span>Powered by Advanced AI</span>
          </div>
          <h1 className="hero-title">
            Build and Ship Conversations{' '}
            <span className="gradient-text">10x Faster</span>
          </h1>
          <p className="hero-description">
            Connect with multiple AI providers, manage your conversations, and experience
            intelligent chat interactions all in one powerful platform. Tailored for modern teams.
          </p>
          <div className="hero-buttons">
            <div className="btn-wrapper">
              <button className="btn btn-primary" onClick={onOpenRegister}>
                Start Building
                <span className="btn-arrow">→</span>
              </button>
            </div>
            <button className="btn btn-secondary" onClick={onOpenLogin}>
              Request a demo
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <div className="hero-card-content">
              <div className="chat-preview">
                <div className="chat-message user">Hello, how can you help me?</div>
                <div className="chat-message ai">I'm here to assist you with any questions!</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="section-container">
          <div className="section-header">
            <div className="section-badge">Features</div>
            <h2 className="section-title">What We Do</h2>
            <p className="section-description">
              Everything you need for intelligent conversations and seamless AI interactions
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon-wrapper">
                  <div className="feature-icon">{feature.icon}</div>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
                <div className="feature-link">
                  Learn more <span>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section" id="pricing">
        <div className="section-container">
          <div className="section-header">
            <div className="section-badge">Pricing</div>
            <h2 className="section-title">Simple, Transparent Pricing</h2>
            <p className="section-description">
              Choose the plan that works best for you
            </p>
          </div>
          <div className="pricing-grid pricing-grid-single">
            <div className="pricing-card pricing-card-featured pricing-card-unified">
              <div className="pricing-header">
                <h3 className="pricing-name">Get Started</h3>
                <div className="pricing-price">
                  <span className="price-amount">Free</span>
                  <span className="price-period">4 hours trial</span>
                </div>
                <p className="pricing-description">Try our platform for free, then continue for just €5/month</p>
              </div>
              <div className="pricing-trial-info">
                <div className="trial-info-item">
                  <span className="trial-icon">⏱️</span>
                  <div className="trial-text">
                    <strong>4 Hours Free Trial</strong>
                    <span>Full access to test all features</span>
                  </div>
                </div>
                <div className="trial-divider"></div>
                <div className="trial-info-item">
                  <span className="trial-icon">💳</span>
                  <div className="trial-text">
                    <strong>€5/month</strong>
                    <span>Continue after trial ends</span>
                  </div>
                </div>
              </div>
              <ul className="pricing-features">
                <li>✓ Full access to all features</li>
                <li>✓ Multiple AI providers (OpenAI, Gemini, Claude)</li>
                <li>✓ Unlimited conversations</li>
                <li>✓ Conversation history</li>
                <li>✓ Email support</li>
              </ul>
              <button className="btn btn-primary pricing-btn" onClick={onOpenRegister}>
                Start Free Trial
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="section-container">
          <div className="footer-content">
            <div className="footer-brand">
              <span className="footer-logo">💬</span>
              <span className="footer-name">MyChatBots</span>
            </div>
            <p className="footer-copyright">
              © 2024 MyChatBots. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

