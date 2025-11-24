import React from 'react';
import './Legal.css';

const Privacy: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <div className="legal-content">
          <p>Last updated: {new Date().toLocaleDateString('en-US')}</p>
          
          <section>
            <h2>1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us, including your name, email address, and payment information when you register and use our services.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>
              We use the information collected to provide, maintain, and improve our services, process transactions, send notifications, and provide customer support.
            </p>
          </section>

          <section>
            <h2>3. API Key Security</h2>
            <p>
              Your API keys are encrypted and stored securely. We never share your API keys with third parties. You are responsible for maintaining the security of your account credentials.
            </p>
          </section>

          <section>
            <h2>4. Information Sharing</h2>
            <p>
              We do not sell, rent, or share your personal information with third parties, except as described in this policy or as required by law.
            </p>
          </section>

          <section>
            <h2>5. Cookies and Similar Technologies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze how you use our services, and personalize content.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal information at any time. You may also opt out of receiving marketing communications.
            </p>
          </section>

          <section>
            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of any changes by posting the new policy on this page.
            </p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us through the support channels available on the platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

