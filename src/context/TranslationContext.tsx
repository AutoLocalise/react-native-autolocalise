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
  translate: (text: string) => text,
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
  const [version, setVersion] = useState(0); // Version state to force re-render

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
      setVersion((v) => v + 1); // Increment version to trigger re-render
    });
  }, [service]);

  const translate = useMemo(
    () =>
      (text: string): string => {
        if (!text) return text;
        console.log("translate");
        // Use service's cache directly
        const cachedTranslation = service.getCachedTranslation(text);
        if (cachedTranslation) return cachedTranslation;

        // If not in cache and not already being translated, trigger translation
        if (!service.isTranslationPending(text)) {
          service.translate(text).then(() => {
            // Translation will be updated through the onUpdate subscription
          });
        }

        return text; // Return original text while translation is pending
      },
    [service, version] // Include version in dependencies to trigger re-render when translations update
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
