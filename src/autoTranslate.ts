import { TranslationService } from "./services/translation";
import { TranslationConfig } from "./types";

const autoTranslate = {
  init: async (config: TranslationConfig) => {
    const service = new TranslationService(config);
    await service.init();
    return service;
  },
};

export default autoTranslate;
