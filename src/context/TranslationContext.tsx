import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { TranslationConfig, TranslationContextType } from "../types";
import { TranslationService } from "../services/translation";

const TranslationContext = createContext<TranslationContextType>({
  translate: (text: string, type?: string) => text,
  loading: true,
  error: null,
});

export interface TranslationProviderProps {
  config: TranslationConfig;
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({
  config,
  children,
}) => {
  const [service] = useState(() => new TranslationService(config));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeTranslations = async () => {
      try {
        await service.init();
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to initialize translations")
        );
        setLoading(false);
      }
    };

    initializeTranslations();

    // Subscribe to translation updates
    service.onUpdate(() => {});
  }, [service]);

  const [translations, setTranslations] = useState<Record<string, string>>({});

  const translate = useMemo(
    () =>
      (text: string, type?: string): string => {
        if (!text) return text;
        if (loading) return text;

        // Return cached translation if available
        const cachedTranslation = service.getCachedTranslation(text);
        if (cachedTranslation) return cachedTranslation;

        // Return from local state if available
        if (translations[text]) return translations[text];

        // Start async translation if not already pending
        if (!service.isTranslationPending(text)) {
          service
            .translate(text, type)
            .then((translated) => {
              if (translated) {
                setTranslations((prev) => ({ ...prev, [text]: translated }));
              }
            })
            .catch((err) => {
              console.error("Translation error:", err);
            });
        }

        // Return original text while translation is in progress
        return text;
      },
    [service, loading, translations]
  );

  return (
    <TranslationContext.Provider value={{ translate, loading, error }}>
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
    t: context.translate,
    loading: context.loading,
    error: context.error,
  };
};
