import React, { useMemo, useState } from 'react';
import TrialCountdown from '../components/TrialCountdown';
import './UpdatePlan.css';

type UpdatePlanProps = {
  trialEndsAt: string | null;
  isLocked: boolean;
  onUpgrade: () => Promise<void>;
  onBack?: () => void;
  onGoHome?: () => void;
};

function computeRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return 0;
  return Math.max(new Date(trialEndsAt).getTime() - Date.now(), 0);
}

const UpdatePlan: React.FC<UpdatePlanProps> = ({ trialEndsAt, isLocked, onUpgrade, onBack, onGoHome }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remainingMs = useMemo(() => computeRemaining(trialEndsAt), [trialEndsAt]);

  const handleUpgrade = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onUpgrade();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar a atualização do plano.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCountdown = !isLocked && trialEndsAt && remainingMs > 0;

  return (
    <div className="update-plan-wrapper">
      {showCountdown && (
        <TrialCountdown
          trialEndsAt={trialEndsAt}
          onManagePlan={handleUpgrade}
        />
      )}
      <div className="update-plan-card">
        <header className="update-plan-header">
          <span className={`update-plan-status ${isLocked ? 'locked' : 'active'}`}>
            {isLocked ? 'Trial expirado' : 'Trial ativo'}
          </span>
          <h1>{isLocked ? 'Seu acesso está bloqueado' : 'Mantenha seu acesso ilimitado'}</h1>
          <p>
            {isLocked
              ? 'O período de trial terminou e a subscrição precisa ser renovada para desbloquear a aplicação.'
              : 'Atualize agora para garantir que não haverá interrupções no seu acesso.'}
          </p>
        </header>

        <ul className="update-plan-benefits">
          <li>Converse sem limites com modelos premium.</li>
          <li>Monitorização prioritária e suporte dedicado.</li>
          <li>Sem interrupções quando novas funcionalidades forem lançadas.</li>
        </ul>

        {trialEndsAt && (
          <div className="update-plan-timeline">
            <span className="timeline-label">Fim do trial</span>
            <span className="timeline-value">
              {new Date(trialEndsAt).toLocaleString()}
            </span>
          </div>
        )}

        {error && <div className="update-plan-error">{error}</div>}

        <div className="update-plan-actions">
          <button
            type="button"
            className="upgrade-button"
            onClick={handleUpgrade}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Aguarde…' : 'Atualizar plano'}
          </button>
          {!isLocked && onBack && (
            <button type="button" className="secondary-button" onClick={onBack}>
              Voltar
            </button>
          )}
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              if (onGoHome) {
                onGoHome();
              } else if (onBack) {
                onBack();
              }
            }}
          >
            Voltar à página inicial
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePlan;

