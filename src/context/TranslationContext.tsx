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
  /**
   * Translates the given text to the target language
   * @param text - The text to translate
   * @param type - Optional parameter to specify the type of text being translated (e.g., 'title', 'description', etc.)
   *              This is used by the translation service to provide context-aware translations
   * @returns The translated text, or the original text if translation is not yet available
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [version, setVersion] = useState(0);

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
    service.onUpdate(() => {
      // Increment version to trigger re-render when translations update
      setVersion((v) => v + 1);
    });
  }, [service]);

  const translate = useMemo(
    () =>
      (text: string, type?: string): string => {
        if (!text || loading) return text;

        // Skip translation if source and target languages are the same
        if (config.sourceLocale === config.targetLocale) {
          return text;
        }

        // Return cached translation if available
        const cachedTranslation = service.getCachedTranslation(text);
        if (cachedTranslation) return cachedTranslation;

        // Start async translation if not already pending
        if (!service.isTranslationPending(text)) {
          return service.translate(text, type);
        }

        // Return original text while translation is pending
        return text;
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, loading, version] // Add version to dependencies to trigger re-render
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
