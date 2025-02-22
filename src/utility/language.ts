import { Config } from "@/config";

export function getLanguagePromptForJson(
  language: string,
  targetKeys: string[] = [],
) {
  let targetKeysStr = "";
  if (targetKeys.length > 0) {
    targetKeysStr = targetKeys.join(",");
  }
  return `Please respond ${targetKeysStr} in ${language}. But key and identifier in the JSON must be in English.`;
}

export function getLanguageFromConfig(config: Config) {
  let result = config.language.language || "English";
  if (config.language.autoDetect) {
    result = getLanguageFromEnv();
  }
  return result;
}

export function getLanguageFromEnv() {
  const lang = Bun.env.LANG?.split(".")[0]?.split("_")[0] || "en";
  const fullLangNames = {
    en: "English",
    ja: "Japanese",
    zh: "Chinese",
    ko: "Korean",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    nl: "Dutch",
    pl: "Polish",
    pt: "Portuguese",
    ru: "Russian",
    tr: "Turkish",
    vi: "Vietnamese",
    ar: "Arabic",
    hi: "Hindi",
    bn: "Bengali",
  };
  return fullLangNames[lang as keyof typeof fullLangNames] || "English";
}
