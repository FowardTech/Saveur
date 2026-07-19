import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/ms';

import auth from 'i18n/language/en/auth.json';
import intro from 'i18n/language/en/intro.json';
import success from 'i18n/language/en/success.json';
import home from 'i18n/language/en/home.json';
import filter from 'i18n/language/en/filter.json';
import common from 'i18n/language/en/common.json';
import notification from 'i18n/language/en/notification.json';
import message from 'i18n/language/en/message.json';
import request from 'i18n/language/en/request.json';
import find from 'i18n/language/en/find.json';
import creat_job from 'i18n/language/en/create_job.json';
import payment from 'i18n/language/en/payment.json';
import more from 'i18n/language/en/more.json';

// Spanish — second locale proving the i18n pipeline works end to end. Only
// the highest-traffic/first-run namespaces are fully translated (common,
// auth, intro/onboarding, home, find); the rest fall back to English via
// `fallbackLng` below rather than showing raw untranslated keys.
import authEs from 'i18n/language/es/auth.json';
import introEs from 'i18n/language/es/intro.json';
import homeEs from 'i18n/language/es/home.json';
import findEs from 'i18n/language/es/find.json';
import commonEs from 'i18n/language/es/common.json';

export const defaultNS = 'common';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      intro: typeof intro;
      common: typeof common;
      auth: typeof auth;
      success: typeof success;
      home: typeof home;
      filter: typeof filter;
      notification: typeof notification;
      message: typeof message;
      request: typeof request;
      creat_job: typeof creat_job;
      find: typeof find;
      payment: typeof payment;
      more: typeof more;
    };
  }
}

export const resources = {
  en: {
    intro,
    common,
    auth,
    success,
    home,
    filter,
    notification,
    message,
    find,
    creat_job,
    request,
    payment,
    more,
  },
  es: {
    intro: introEs,
    common: commonEs,
    auth: authEs,
    home: homeEs,
    find: findEs,
  },
} as const;

i18n.use(initReactI18next).init({
  lng: 'en',
  // Any namespace/key not (yet) translated in a non-English locale falls
  // back to English instead of rendering the raw i18next key.
  fallbackLng: 'en',
  compatibilityJSON: 'v3',
  defaultNS,
  resources,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: true,
  },
});

i18n.on('languageChanged', lng => {
  dayjs.locale(lng);
});
