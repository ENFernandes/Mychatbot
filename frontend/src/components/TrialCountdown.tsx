import React, { useEffect, useMemo, useState } from 'react';
import './TrialCountdown.css';

type TrialCountdownProps = {
  trialEndsAt: string;
  onManagePlan: () => void;
};

function formatTime(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const TrialCountdown: React.FC<TrialCountdownProps> = ({ trialEndsAt, onManagePlan }) => {
  const trialEndMs = useMemo(() => new Date(trialEndsAt).getTime(), [trialEndsAt]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(trialEndMs - Date.now(), 0));

  useEffect(() => {
    const update = () => {
      setRemainingMs(Math.max(trialEndMs - Date.now(), 0));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [trialEndMs]);

  if (!trialEndsAt || trialEndMs <= Date.now()) {
    return null;
  }

  return (
    <div className="trial-countdown-badge">
      <div className="trial-countdown-text">
        <span className="trial-countdown-label">Trial ativo</span>
        <span className="trial-countdown-timer">{formatTime(remainingMs)}</span>
      </div>
      <button type="button" className="trial-countdown-button" onClick={onManagePlan}>
        Update plan
      </button>
    </div>
  );
};

export default TrialCountdown;

