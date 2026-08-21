export {
  TranslationProvider,
  useAutoTranslate,
} from "./context/TranslationContext";

export type {
  AccessTokenResponse,
  TranslationConfig,
  TranslationContextType,
} from "./types";

export { ConfigurationError, AccessTokenError } from "./types";
export { TranslationService } from "./services/translation";
export { FormattedText } from "./components/FormattedText";

import autoTranslate from "./autoTranslate";

export default autoTranslate;
