import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TranslationConfig, TranslationContextType } from "../types";
import { TranslationService } from "../services/translation";
import { validateConfig } from "../utils/validation";

const TranslationContext = createContext<TranslationContextType | null>(null);

export interface TranslationProviderProps {
  config: TranslationConfig;
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({
  config,
  children,
}) => {
  const service = useMemo(
    () => new TranslationService(config),
    // Recreate only when auth or locale identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config.apiKey,
      config.getAccessToken,
      config.apiBaseUrl,
      config.sourceLocale,
      config.targetLocale,
    ]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    validateConfig(config);
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const initializeTranslations = async () => {
      try {
        if (config.sourceLocale !== config.targetLocale) {
          await service.init();
        }
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to initialize translations")
          );
          setLoading(false);
        }
      }
    };

    initializeTranslations();

    service.onUpdate(() => {
      if (!cancelled) {
        setVersion((v) => v + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [service, config.sourceLocale, config.targetLocale]);

  const translate = useMemo(
    () =>
      (text: string, persist: boolean = true): string => {
        if (!text || loading) return text;

        if (config.sourceLocale === config.targetLocale) {
          return text;
        }

        const cachedTranslation = service.getCachedTranslation(text);
        if (cachedTranslation) return cachedTranslation;

        if (!service.isTranslationPending(text)) {
          return service.translate(text, persist);
        }

        return text;
      },
    // version updates when new translations arrive so cached lookups re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, loading, version, config.sourceLocale, config.targetLocale]
  );

  const value = useMemo(
    () => ({ translate, loading, error }),
    [translate, loading, error]
  );

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useAutoTranslate = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      "useAutoTranslate must be used within a TranslationProvider"
    );
  }
  return {
    t: (text: string, persist: boolean = true) =>
      context.translate(text, persist),
    loading: context.loading,
    error: context.error,
  };
};
