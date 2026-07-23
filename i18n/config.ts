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

// Spanish — every namespace is now fully translated (see i18n/language/es/),
// so switching to Spanish (signup or Settings → Language, see
// constants/languages.ts) covers the whole app's UI text, not just the
// highest-traffic screens. Anything genuinely missing still falls back to
// English via `fallbackLng` below rather than showing a raw untranslated key.
import authEs from 'i18n/language/es/auth.json';
import introEs from 'i18n/language/es/intro.json';
import successEs from 'i18n/language/es/success.json';
import homeEs from 'i18n/language/es/home.json';
import filterEs from 'i18n/language/es/filter.json';
import commonEs from 'i18n/language/es/common.json';
import notificationEs from 'i18n/language/es/notification.json';
import messageEs from 'i18n/language/es/message.json';
import requestEs from 'i18n/language/es/request.json';
import findEs from 'i18n/language/es/find.json';
import creatJobEs from 'i18n/language/es/create_job.json';
import paymentEs from 'i18n/language/es/payment.json';
import moreEs from 'i18n/language/es/more.json';

// French, German, Portuguese, Italian, Chinese (Simplified), Japanese, Korean,
// Arabic, Hindi, Russian — added to round out coverage of the world's largest
// language communities and major business languages (see
// constants/languages.ts's SUPPORTED_LANGUAGES). Every namespace is fully
// translated for each of these, same as Spanish above — not a partial subset.
//
// NOTE on Arabic: this only covers text direction via i18next's string
// resources — it does NOT flip the app's layout to right-to-left. A real RTL
// mirror (I18nManager.forceRTL + an app restart, plus auditing every screen's
// flexDirection/absolute-positioning assumptions) is a separate, larger native
// layout change that hasn't been done here. Arabic text will read correctly,
// but the surrounding UI chrome (icons, alignment, nav) still lays out LTR.
import authFr from 'i18n/language/fr/auth.json';
import introFr from 'i18n/language/fr/intro.json';
import successFr from 'i18n/language/fr/success.json';
import homeFr from 'i18n/language/fr/home.json';
import filterFr from 'i18n/language/fr/filter.json';
import commonFr from 'i18n/language/fr/common.json';
import notificationFr from 'i18n/language/fr/notification.json';
import messageFr from 'i18n/language/fr/message.json';
import requestFr from 'i18n/language/fr/request.json';
import findFr from 'i18n/language/fr/find.json';
import creatJobFr from 'i18n/language/fr/create_job.json';
import paymentFr from 'i18n/language/fr/payment.json';
import moreFr from 'i18n/language/fr/more.json';

import authDe from 'i18n/language/de/auth.json';
import introDe from 'i18n/language/de/intro.json';
import successDe from 'i18n/language/de/success.json';
import homeDe from 'i18n/language/de/home.json';
import filterDe from 'i18n/language/de/filter.json';
import commonDe from 'i18n/language/de/common.json';
import notificationDe from 'i18n/language/de/notification.json';
import messageDe from 'i18n/language/de/message.json';
import requestDe from 'i18n/language/de/request.json';
import findDe from 'i18n/language/de/find.json';
import creatJobDe from 'i18n/language/de/create_job.json';
import paymentDe from 'i18n/language/de/payment.json';
import moreDe from 'i18n/language/de/more.json';

import authPt from 'i18n/language/pt/auth.json';
import introPt from 'i18n/language/pt/intro.json';
import successPt from 'i18n/language/pt/success.json';
import homePt from 'i18n/language/pt/home.json';
import filterPt from 'i18n/language/pt/filter.json';
import commonPt from 'i18n/language/pt/common.json';
import notificationPt from 'i18n/language/pt/notification.json';
import messagePt from 'i18n/language/pt/message.json';
import requestPt from 'i18n/language/pt/request.json';
import findPt from 'i18n/language/pt/find.json';
import creatJobPt from 'i18n/language/pt/create_job.json';
import paymentPt from 'i18n/language/pt/payment.json';
import morePt from 'i18n/language/pt/more.json';

import authIt from 'i18n/language/it/auth.json';
import introIt from 'i18n/language/it/intro.json';
import successIt from 'i18n/language/it/success.json';
import homeIt from 'i18n/language/it/home.json';
import filterIt from 'i18n/language/it/filter.json';
import commonIt from 'i18n/language/it/common.json';
import notificationIt from 'i18n/language/it/notification.json';
import messageIt from 'i18n/language/it/message.json';
import requestIt from 'i18n/language/it/request.json';
import findIt from 'i18n/language/it/find.json';
import creatJobIt from 'i18n/language/it/create_job.json';
import paymentIt from 'i18n/language/it/payment.json';
import moreIt from 'i18n/language/it/more.json';

import authZh from 'i18n/language/zh/auth.json';
import introZh from 'i18n/language/zh/intro.json';
import successZh from 'i18n/language/zh/success.json';
import homeZh from 'i18n/language/zh/home.json';
import filterZh from 'i18n/language/zh/filter.json';
import commonZh from 'i18n/language/zh/common.json';
import notificationZh from 'i18n/language/zh/notification.json';
import messageZh from 'i18n/language/zh/message.json';
import requestZh from 'i18n/language/zh/request.json';
import findZh from 'i18n/language/zh/find.json';
import creatJobZh from 'i18n/language/zh/create_job.json';
import paymentZh from 'i18n/language/zh/payment.json';
import moreZh from 'i18n/language/zh/more.json';

import authJa from 'i18n/language/ja/auth.json';
import introJa from 'i18n/language/ja/intro.json';
import successJa from 'i18n/language/ja/success.json';
import homeJa from 'i18n/language/ja/home.json';
import filterJa from 'i18n/language/ja/filter.json';
import commonJa from 'i18n/language/ja/common.json';
import notificationJa from 'i18n/language/ja/notification.json';
import messageJa from 'i18n/language/ja/message.json';
import requestJa from 'i18n/language/ja/request.json';
import findJa from 'i18n/language/ja/find.json';
import creatJobJa from 'i18n/language/ja/create_job.json';
import paymentJa from 'i18n/language/ja/payment.json';
import moreJa from 'i18n/language/ja/more.json';

import authKo from 'i18n/language/ko/auth.json';
import introKo from 'i18n/language/ko/intro.json';
import successKo from 'i18n/language/ko/success.json';
import homeKo from 'i18n/language/ko/home.json';
import filterKo from 'i18n/language/ko/filter.json';
import commonKo from 'i18n/language/ko/common.json';
import notificationKo from 'i18n/language/ko/notification.json';
import messageKo from 'i18n/language/ko/message.json';
import requestKo from 'i18n/language/ko/request.json';
import findKo from 'i18n/language/ko/find.json';
import creatJobKo from 'i18n/language/ko/create_job.json';
import paymentKo from 'i18n/language/ko/payment.json';
import moreKo from 'i18n/language/ko/more.json';

import authAr from 'i18n/language/ar/auth.json';
import introAr from 'i18n/language/ar/intro.json';
import successAr from 'i18n/language/ar/success.json';
import homeAr from 'i18n/language/ar/home.json';
import filterAr from 'i18n/language/ar/filter.json';
import commonAr from 'i18n/language/ar/common.json';
import notificationAr from 'i18n/language/ar/notification.json';
import messageAr from 'i18n/language/ar/message.json';
import requestAr from 'i18n/language/ar/request.json';
import findAr from 'i18n/language/ar/find.json';
import creatJobAr from 'i18n/language/ar/create_job.json';
import paymentAr from 'i18n/language/ar/payment.json';
import moreAr from 'i18n/language/ar/more.json';

import authHi from 'i18n/language/hi/auth.json';
import introHi from 'i18n/language/hi/intro.json';
import successHi from 'i18n/language/hi/success.json';
import homeHi from 'i18n/language/hi/home.json';
import filterHi from 'i18n/language/hi/filter.json';
import commonHi from 'i18n/language/hi/common.json';
import notificationHi from 'i18n/language/hi/notification.json';
import messageHi from 'i18n/language/hi/message.json';
import requestHi from 'i18n/language/hi/request.json';
import findHi from 'i18n/language/hi/find.json';
import creatJobHi from 'i18n/language/hi/create_job.json';
import paymentHi from 'i18n/language/hi/payment.json';
import moreHi from 'i18n/language/hi/more.json';

import authRu from 'i18n/language/ru/auth.json';
import introRu from 'i18n/language/ru/intro.json';
import successRu from 'i18n/language/ru/success.json';
import homeRu from 'i18n/language/ru/home.json';
import filterRu from 'i18n/language/ru/filter.json';
import commonRu from 'i18n/language/ru/common.json';
import notificationRu from 'i18n/language/ru/notification.json';
import messageRu from 'i18n/language/ru/message.json';
import requestRu from 'i18n/language/ru/request.json';
import findRu from 'i18n/language/ru/find.json';
import creatJobRu from 'i18n/language/ru/create_job.json';
import paymentRu from 'i18n/language/ru/payment.json';
import moreRu from 'i18n/language/ru/more.json';

export const defaultNS = 'common';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      auth: typeof auth;
      intro: typeof intro;
      success: typeof success;
      home: typeof home;
      filter: typeof filter;
      common: typeof common;
      notification: typeof notification;
      message: typeof message;
      request: typeof request;
      find: typeof find;
      creat_job: typeof creat_job;
      payment: typeof payment;
      more: typeof more;
    };
  }
}

export const resources = {
  en: {
    auth,
    intro,
    success,
    home,
    filter,
    common,
    notification,
    message,
    request,
    find,
    creat_job,
    payment,
    more,
  },
  es: {
    auth: authEs,
    intro: introEs,
    success: successEs,
    home: homeEs,
    filter: filterEs,
    common: commonEs,
    notification: notificationEs,
    message: messageEs,
    request: requestEs,
    find: findEs,
    creat_job: creatJobEs,
    payment: paymentEs,
    more: moreEs,
  },
  fr: {
    auth: authFr,
    intro: introFr,
    success: successFr,
    home: homeFr,
    filter: filterFr,
    common: commonFr,
    notification: notificationFr,
    message: messageFr,
    request: requestFr,
    find: findFr,
    creat_job: creatJobFr,
    payment: paymentFr,
    more: moreFr,
  },
  de: {
    auth: authDe,
    intro: introDe,
    success: successDe,
    home: homeDe,
    filter: filterDe,
    common: commonDe,
    notification: notificationDe,
    message: messageDe,
    request: requestDe,
    find: findDe,
    creat_job: creatJobDe,
    payment: paymentDe,
    more: moreDe,
  },
  pt: {
    auth: authPt,
    intro: introPt,
    success: successPt,
    home: homePt,
    filter: filterPt,
    common: commonPt,
    notification: notificationPt,
    message: messagePt,
    request: requestPt,
    find: findPt,
    creat_job: creatJobPt,
    payment: paymentPt,
    more: morePt,
  },
  it: {
    auth: authIt,
    intro: introIt,
    success: successIt,
    home: homeIt,
    filter: filterIt,
    common: commonIt,
    notification: notificationIt,
    message: messageIt,
    request: requestIt,
    find: findIt,
    creat_job: creatJobIt,
    payment: paymentIt,
    more: moreIt,
  },
  zh: {
    auth: authZh,
    intro: introZh,
    success: successZh,
    home: homeZh,
    filter: filterZh,
    common: commonZh,
    notification: notificationZh,
    message: messageZh,
    request: requestZh,
    find: findZh,
    creat_job: creatJobZh,
    payment: paymentZh,
    more: moreZh,
  },
  ja: {
    auth: authJa,
    intro: introJa,
    success: successJa,
    home: homeJa,
    filter: filterJa,
    common: commonJa,
    notification: notificationJa,
    message: messageJa,
    request: requestJa,
    find: findJa,
    creat_job: creatJobJa,
    payment: paymentJa,
    more: moreJa,
  },
  ko: {
    auth: authKo,
    intro: introKo,
    success: successKo,
    home: homeKo,
    filter: filterKo,
    common: commonKo,
    notification: notificationKo,
    message: messageKo,
    request: requestKo,
    find: findKo,
    creat_job: creatJobKo,
    payment: paymentKo,
    more: moreKo,
  },
  ar: {
    auth: authAr,
    intro: introAr,
    success: successAr,
    home: homeAr,
    filter: filterAr,
    common: commonAr,
    notification: notificationAr,
    message: messageAr,
    request: requestAr,
    find: findAr,
    creat_job: creatJobAr,
    payment: paymentAr,
    more: moreAr,
  },
  hi: {
    auth: authHi,
    intro: introHi,
    success: successHi,
    home: homeHi,
    filter: filterHi,
    common: commonHi,
    notification: notificationHi,
    message: messageHi,
    request: requestHi,
    find: findHi,
    creat_job: creatJobHi,
    payment: paymentHi,
    more: moreHi,
  },
  ru: {
    auth: authRu,
    intro: introRu,
    success: successRu,
    home: homeRu,
    filter: filterRu,
    common: commonRu,
    notification: notificationRu,
    message: messageRu,
    request: requestRu,
    find: findRu,
    creat_job: creatJobRu,
    payment: paymentRu,
    more: moreRu,
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
