import { STORAGE_KEYS } from "../storageKeys";

export const getStoredSkipIntroButtonEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(STORAGE_KEYS.SKIP_INTRO_BUTTON_ENABLED);
  return val === null ? true : val === "true";
};

export const setStoredSkipIntroButtonEnabled = (enabled: boolean): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.SKIP_INTRO_BUTTON_ENABLED, String(enabled));
  }
};
