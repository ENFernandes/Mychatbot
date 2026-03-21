import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export type Provider = 'openai' | 'gemini' | 'claude';

interface UseProvidersReturn {
  availableProviders: Provider[];
  currentProvider: Provider;
  models: string[];
  currentModel: string;
  isLoading: boolean;
  error: string | null;
  setCurrentProvider: (provider: Provider) => void;
  setCurrentModel: (model: string) => void;
  refetch: () => Promise<void>;
}

export function useProviders(token: string | null): UseProvidersReturn {
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [currentProvider, setCurrentProvider] = useState<Provider>('openai');
  const [models, setModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    if (!token) {
      setAvailableProviders([]);
      setModels([]);
      setCurrentModel('');
      return;
    }

    try {
      const { data } = await api.get('/user/keys');
      const providers = (data.keys || []).map((k: any) => k.provider) as Provider[];
      setAvailableProviders(providers);

      if (providers.length > 0 && !providers.includes(currentProvider)) {
        setCurrentProvider(providers[0]);
      }
    } catch (e) {
      console.error('Error fetching providers:', e);
      setAvailableProviders([]);
    }
  }, [token, currentProvider]);

  const fetchModels = useCallback(async () => {
    if (!token || !currentProvider || availableProviders.length === 0) {
      setModels([]);
      setCurrentModel('');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: modelResp } = await api.get('/models', {
        params: { provider: currentProvider },
      });
      const modelList = modelResp.models || [];
      setModels(modelList);
      setCurrentModel(modelList[0] || '');
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setError(`API key for ${currentProvider} not configured`);
      } else if (status === 401) {
        setError(`Invalid API key for ${currentProvider}`);
      } else {
        setError(e?.response?.data?.error || 'Error fetching models');
      }
      setModels([]);
      setCurrentModel('');
    } finally {
      setIsLoading(false);
    }
  }, [token, currentProvider, availableProviders]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    availableProviders,
    currentProvider,
    models,
    currentModel,
    isLoading,
    error,
    setCurrentProvider,
    setCurrentModel,
    refetch: fetchProviders,
  };
}
