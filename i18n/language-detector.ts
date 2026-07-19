import {LanguageDetectorAsyncModule} from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ReactNativeLocalize from 'react-native-localize';

const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  init: () => {},
  detect: async callback => {
    const fallbackLng = ReactNativeLocalize.getLocales()[0].languageCode;

    try {
      const localLng = await AsyncStorage.getItem('lng');
      if (localLng) {
        callback(localLng);
      } else {
        callback(fallbackLng);
      }
    } catch (error) {
      callback(fallbackLng);
    }
  },
  cacheUserLanguage: async lng => {
    try {
      await AsyncStorage.setItem('lng', lng);
    } catch (error) {}
  },
};

export default languageDetector;
