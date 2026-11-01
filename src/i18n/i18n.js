import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import si from './locales/si.json';
import ta from './locales/ta.json';

export const LANGUAGES = ['en', 'si', 'ta'];
const STORAGE_KEY = 'lotus-language';

const readSaved = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.includes(saved) ? saved : 'en';
  } catch {
    return 'en'; // storage blocked (private window etc.)
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      si: { translation: si },
      ta: { translation: ta },
    },
    lng: readSaved(),
    fallbackLng: 'en',
    // Keys are the English text itself, so "." and ":" inside a sentence must not split the key
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
  });

// Remember the choice and tell the browser which language the page is in (fonts, screen readers)
const applyLanguage = (lng) => {
  document.documentElement.lang = lng;
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* ignore */ }
};
applyLanguage(i18n.language);
i18n.on('languageChanged', applyLanguage);

export default i18n;
