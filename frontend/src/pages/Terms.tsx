import React from 'react';
import './Legal.css';

const Terms: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Terms of Use</h1>
        <div className="legal-content">
          <p>Last updated: {new Date().toLocaleDateString('en-US')}</p>
          
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using MultiProviderAI, you agree to comply with and be bound by the following terms and conditions of use.
            </p>
          </section>

          <section>
            <h2>2. Service Description</h2>
            <p>
              MultiProviderAI is a platform that allows users to connect to multiple AI providers (OpenAI, Google Gemini, Anthropic Claude) using their own API keys.
            </p>
          </section>

          <section>
            <h2>3. API Key Usage</h2>
            <p>
              You are responsible for maintaining the security of your API keys. MultiProviderAI does not store or access your API keys in an unauthorized manner. You are responsible for all costs incurred through the use of your API keys.
            </p>
          </section>

          <section>
            <h2>4. User Account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2>5. Limitation of Liability</h2>
            <p>
              MultiProviderAI shall not be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the service.
            </p>
          </section>

          <section>
            <h2>6. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes will take effect immediately upon publication.
            </p>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>
              If you have any questions about these Terms of Use, please contact us through the support channels available on the platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;

