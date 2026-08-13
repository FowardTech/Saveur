import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/ms';
// Registers every locale this app actually supports (see
// constants/languages.ts's SUPPORTED_LANGUAGES) with dayjs itself, matched
// by the exact same bare ISO 639-1 code i18next uses -- without importing a
// locale file first, dayjs.locale(code) below silently no-ops and stays on
// whatever locale was last successfully set (previously that meant only
// 'en' ever actually worked, since 'ms' -- not even a supported app
// language -- was the only non-English locale file ever imported here).
// This is the root cause behind relative timestamps ("4 hours ago"),
// calendar month names, and other dayjs-formatted "subordinate text"
// staying in English everywhere in the app regardless of the selected
// language, even though the surrounding i18next-driven strings switched
// correctly -- exactly the "header translated, body/subordinate text not"
// gap reported for push notifications/Notification Center and elsewhere.
import 'dayjs/locale/es';
import 'dayjs/locale/fr';
import 'dayjs/locale/de';
import 'dayjs/locale/pt';
import 'dayjs/locale/it';
import 'dayjs/locale/zh';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/ar';
import 'dayjs/locale/hi';
import 'dayjs/locale/ru';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import {isSupportedLanguageCode} from 'constants/languages';

import auth from 'i18n/language/en/auth.json';
import intro from 'i18n/language/en/intro.json';
import success from 'i18n/language/en/success.json';
import home from 'i18n/language/en/home.json';
import common from 'i18n/language/en/common.json';
import notification from 'i18n/language/en/notification.json';
import message from 'i18n/language/en/message.json';
import request from 'i18n/language/en/request.json';
import find from 'i18n/language/en/find.json';
import payment from 'i18n/language/en/payment.json';
import more from 'i18n/language/en/more.json';
import countries from 'i18n/language/en/countries.json';
// BUG FIX (product report: "a lot of screens... are not automatically
// translated... nothing must be left"): this namespace's JSON file has
// existed, fully translated, for all 12 supported locales on disk this
// whole time (i18n/language/<locale>/practice.json) but was never actually
// imported/registered below -- so every t('practice:...') call anywhere in
// the app (e.g. src/practice/InterviewReplay.tsx) always fell back to its
// hardcoded English defaultValue regardless of the user's selected
// language, since i18next had no translated resource loaded for this
// namespace in ANY language to serve instead.
import practice from 'i18n/language/en/practice.json';

// Spanish — every namespace is now fully translated (see i18n/language/es/),
// so switching to Spanish (signup or Settings → Language, see
// constants/languages.ts) covers the whole app's UI text, not just the
// highest-traffic screens. Anything genuinely missing still falls back to
// English via `fallbackLng` below rather than showing a raw untranslated key.
import authEs from 'i18n/language/es/auth.json';
import introEs from 'i18n/language/es/intro.json';
import successEs from 'i18n/language/es/success.json';
import homeEs from 'i18n/language/es/home.json';
import commonEs from 'i18n/language/es/common.json';
import notificationEs from 'i18n/language/es/notification.json';
import messageEs from 'i18n/language/es/message.json';
import requestEs from 'i18n/language/es/request.json';
import findEs from 'i18n/language/es/find.json';
import paymentEs from 'i18n/language/es/payment.json';
import moreEs from 'i18n/language/es/more.json';
import countriesEs from 'i18n/language/es/countries.json';
import practiceEs from 'i18n/language/es/practice.json';

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
import commonFr from 'i18n/language/fr/common.json';
import notificationFr from 'i18n/language/fr/notification.json';
import messageFr from 'i18n/language/fr/message.json';
import requestFr from 'i18n/language/fr/request.json';
import findFr from 'i18n/language/fr/find.json';
import paymentFr from 'i18n/language/fr/payment.json';
import moreFr from 'i18n/language/fr/more.json';
import countriesFr from 'i18n/language/fr/countries.json';
import practiceFr from 'i18n/language/fr/practice.json';

import authDe from 'i18n/language/de/auth.json';
import introDe from 'i18n/language/de/intro.json';
import successDe from 'i18n/language/de/success.json';
import homeDe from 'i18n/language/de/home.json';
import commonDe from 'i18n/language/de/common.json';
import notificationDe from 'i18n/language/de/notification.json';
import messageDe from 'i18n/language/de/message.json';
import requestDe from 'i18n/language/de/request.json';
import findDe from 'i18n/language/de/find.json';
import paymentDe from 'i18n/language/de/payment.json';
import moreDe from 'i18n/language/de/more.json';
import countriesDe from 'i18n/language/de/countries.json';
import practiceDe from 'i18n/language/de/practice.json';

import authPt from 'i18n/language/pt/auth.json';
import introPt from 'i18n/language/pt/intro.json';
import successPt from 'i18n/language/pt/success.json';
import homePt from 'i18n/language/pt/home.json';
import commonPt from 'i18n/language/pt/common.json';
import notificationPt from 'i18n/language/pt/notification.json';
import messagePt from 'i18n/language/pt/message.json';
import requestPt from 'i18n/language/pt/request.json';
import findPt from 'i18n/language/pt/find.json';
import paymentPt from 'i18n/language/pt/payment.json';
import morePt from 'i18n/language/pt/more.json';
import countriesPt from 'i18n/language/pt/countries.json';
import practicePt from 'i18n/language/pt/practice.json';

import authIt from 'i18n/language/it/auth.json';
import introIt from 'i18n/language/it/intro.json';
import successIt from 'i18n/language/it/success.json';
import homeIt from 'i18n/language/it/home.json';
import commonIt from 'i18n/language/it/common.json';
import notificationIt from 'i18n/language/it/notification.json';
import messageIt from 'i18n/language/it/message.json';
import requestIt from 'i18n/language/it/request.json';
import findIt from 'i18n/language/it/find.json';
import paymentIt from 'i18n/language/it/payment.json';
import moreIt from 'i18n/language/it/more.json';
import countriesIt from 'i18n/language/it/countries.json';
import practiceIt from 'i18n/language/it/practice.json';

import authZh from 'i18n/language/zh/auth.json';
import introZh from 'i18n/language/zh/intro.json';
import successZh from 'i18n/language/zh/success.json';
import homeZh from 'i18n/language/zh/home.json';
import commonZh from 'i18n/language/zh/common.json';
import notificationZh from 'i18n/language/zh/notification.json';
import messageZh from 'i18n/language/zh/message.json';
import requestZh from 'i18n/language/zh/request.json';
import findZh from 'i18n/language/zh/find.json';
import paymentZh from 'i18n/language/zh/payment.json';
import moreZh from 'i18n/language/zh/more.json';
import countriesZh from 'i18n/language/zh/countries.json';
import practiceZh from 'i18n/language/zh/practice.json';

import authJa from 'i18n/language/ja/auth.json';
import introJa from 'i18n/language/ja/intro.json';
import successJa from 'i18n/language/ja/success.json';
import homeJa from 'i18n/language/ja/home.json';
import commonJa from 'i18n/language/ja/common.json';
import notificationJa from 'i18n/language/ja/notification.json';
import messageJa from 'i18n/language/ja/message.json';
import requestJa from 'i18n/language/ja/request.json';
import findJa from 'i18n/language/ja/find.json';
import paymentJa from 'i18n/language/ja/payment.json';
import moreJa from 'i18n/language/ja/more.json';
import countriesJa from 'i18n/language/ja/countries.json';
import practiceJa from 'i18n/language/ja/practice.json';

import authKo from 'i18n/language/ko/auth.json';
import introKo from 'i18n/language/ko/intro.json';
import successKo from 'i18n/language/ko/success.json';
import homeKo from 'i18n/language/ko/home.json';
import commonKo from 'i18n/language/ko/common.json';
import notificationKo from 'i18n/language/ko/notification.json';
import messageKo from 'i18n/language/ko/message.json';
import requestKo from 'i18n/language/ko/request.json';
import findKo from 'i18n/language/ko/find.json';
import paymentKo from 'i18n/language/ko/payment.json';
import moreKo from 'i18n/language/ko/more.json';
import countriesKo from 'i18n/language/ko/countries.json';
import practiceKo from 'i18n/language/ko/practice.json';

import authAr from 'i18n/language/ar/auth.json';
import introAr from 'i18n/language/ar/intro.json';
import successAr from 'i18n/language/ar/success.json';
import homeAr from 'i18n/language/ar/home.json';
import commonAr from 'i18n/language/ar/common.json';
import notificationAr from 'i18n/language/ar/notification.json';
import messageAr from 'i18n/language/ar/message.json';
import requestAr from 'i18n/language/ar/request.json';
import findAr from 'i18n/language/ar/find.json';
import paymentAr from 'i18n/language/ar/payment.json';
import moreAr from 'i18n/language/ar/more.json';
import countriesAr from 'i18n/language/ar/countries.json';
import practiceAr from 'i18n/language/ar/practice.json';

import authHi from 'i18n/language/hi/auth.json';
import introHi from 'i18n/language/hi/intro.json';
import successHi from 'i18n/language/hi/success.json';
import homeHi from 'i18n/language/hi/home.json';
import commonHi from 'i18n/language/hi/common.json';
import notificationHi from 'i18n/language/hi/notification.json';
import messageHi from 'i18n/language/hi/message.json';
import requestHi from 'i18n/language/hi/request.json';
import findHi from 'i18n/language/hi/find.json';
import paymentHi from 'i18n/language/hi/payment.json';
import moreHi from 'i18n/language/hi/more.json';
import countriesHi from 'i18n/language/hi/countries.json';
import practiceHi from 'i18n/language/hi/practice.json';

import authRu from 'i18n/language/ru/auth.json';
import introRu from 'i18n/language/ru/intro.json';
import successRu from 'i18n/language/ru/success.json';
import homeRu from 'i18n/language/ru/home.json';
import commonRu from 'i18n/language/ru/common.json';
import notificationRu from 'i18n/language/ru/notification.json';
import messageRu from 'i18n/language/ru/message.json';
import requestRu from 'i18n/language/ru/request.json';
import findRu from 'i18n/language/ru/find.json';
import paymentRu from 'i18n/language/ru/payment.json';
import moreRu from 'i18n/language/ru/more.json';
import countriesRu from 'i18n/language/ru/countries.json';
import practiceRu from 'i18n/language/ru/practice.json';

export const defaultNS = 'common';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      auth: typeof auth;
      intro: typeof intro;
      success: typeof success;
      home: typeof home;
      common: typeof common;
      notification: typeof notification;
      message: typeof message;
      request: typeof request;
      find: typeof find;
      payment: typeof payment;
      more: typeof more;
      countries: typeof countries;
      practice: typeof practice;
    };
  }
}

export const resources = {
  en: {
    auth,
    intro,
    success,
    home,
    common,
    notification,
    message,
    request,
    find,
    payment,
    more,
    countries,
    practice,
  },
  es: {
    auth: authEs,
    intro: introEs,
    success: successEs,
    home: homeEs,
    common: commonEs,
    notification: notificationEs,
    message: messageEs,
    request: requestEs,
    find: findEs,
    payment: paymentEs,
    more: moreEs,
    countries: countriesEs,
    practice: practiceEs,
  },
  fr: {
    auth: authFr,
    intro: introFr,
    success: successFr,
    home: homeFr,
    common: commonFr,
    notification: notificationFr,
    message: messageFr,
    request: requestFr,
    find: findFr,
    payment: paymentFr,
    more: moreFr,
    countries: countriesFr,
    practice: practiceFr,
  },
  de: {
    auth: authDe,
    intro: introDe,
    success: successDe,
    home: homeDe,
    common: commonDe,
    notification: notificationDe,
    message: messageDe,
    request: requestDe,
    find: findDe,
    payment: paymentDe,
    more: moreDe,
    countries: countriesDe,
    practice: practiceDe,
  },
  pt: {
    auth: authPt,
    intro: introPt,
    success: successPt,
    home: homePt,
    common: commonPt,
    notification: notificationPt,
    message: messagePt,
    request: requestPt,
    find: findPt,
    payment: paymentPt,
    more: morePt,
    countries: countriesPt,
    practice: practicePt,
  },
  it: {
    auth: authIt,
    intro: introIt,
    success: successIt,
    home: homeIt,
    common: commonIt,
    notification: notificationIt,
    message: messageIt,
    request: requestIt,
    find: findIt,
    payment: paymentIt,
    more: moreIt,
    countries: countriesIt,
    practice: practiceIt,
  },
  zh: {
    auth: authZh,
    intro: introZh,
    success: successZh,
    home: homeZh,
    common: commonZh,
    notification: notificationZh,
    message: messageZh,
    request: requestZh,
    find: findZh,
    payment: paymentZh,
    more: moreZh,
    countries: countriesZh,
    practice: practiceZh,
  },
  ja: {
    auth: authJa,
    intro: introJa,
    success: successJa,
    home: homeJa,
    common: commonJa,
    notification: notificationJa,
    message: messageJa,
    request: requestJa,
    find: findJa,
    payment: paymentJa,
    more: moreJa,
    countries: countriesJa,
    practice: practiceJa,
  },
  ko: {
    auth: authKo,
    intro: introKo,
    success: successKo,
    home: homeKo,
    common: commonKo,
    notification: notificationKo,
    message: messageKo,
    request: requestKo,
    find: findKo,
    payment: paymentKo,
    more: moreKo,
    countries: countriesKo,
    practice: practiceKo,
  },
  ar: {
    auth: authAr,
    intro: introAr,
    success: successAr,
    home: homeAr,
    common: commonAr,
    notification: notificationAr,
    message: messageAr,
    request: requestAr,
    find: findAr,
    payment: paymentAr,
    more: moreAr,
    countries: countriesAr,
    practice: practiceAr,
  },
  hi: {
    auth: authHi,
    intro: introHi,
    success: successHi,
    home: homeHi,
    common: commonHi,
    notification: notificationHi,
    message: messageHi,
    request: requestHi,
    find: findHi,
    payment: paymentHi,
    more: moreHi,
    countries: countriesHi,
    practice: practiceHi,
  },
  ru: {
    auth: authRu,
    intro: introRu,
    success: successRu,
    home: homeRu,
    common: commonRu,
    notification: notificationRu,
    message: messageRu,
    request: requestRu,
    find: findRu,
    payment: paymentRu,
    more: moreRu,
    countries: countriesRu,
    practice: practiceRu,
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
    // BUG FIX (product report: "anytime i change language it just reload
    // [and] some of the content of the app just refuse to load"): with
    // useSuspense true, react-i18next's useTranslation() hook SUSPENDS
    // every mounted consumer for the duration of i18n.changeLanguage()
    // (it listens for the 'languageChanging' event, which fires before
    // the switch completes, specifically to avoid a flash of mixed-
    // language content). Suspending requires an ancestor <Suspense>
    // boundary to catch it -- this app has none anywhere (grepped the
    // whole repo), so every language switch threw an uncaught suspend
    // across the entire component tree. That's the "reload": an
    // unhandled crash, not an intentional one. Screens that had already
    // fetched data before the crash, in a useEffect with an empty/already
    // -satisfied dependency array, never got a chance to re-fetch once
    // things recovered -- that's the "content just refuses to load".
    // react-i18next's own docs call this out explicitly for React Native:
    // "you should set useSuspense to false as Suspense is not supported
    // yet on React Native." All translation resources are already
    // bundled synchronously via `resources` above (no backend, nothing
    // ever actually loads async), so turning this off costs nothing --
    // t() just returns synchronously either way.
    useSuspense: false,
  },
});

i18n.on('languageChanged', lng => {
  dayjs.locale(lng);
  // BUG FIX (product report: FAQ/About screens stuck in English after a
  // mid-session language switch): admin-authored content (see
  // services/configService.ts's loadAppConfig) was only ever fetched once
  // at App.tsx startup. Re-fetch it in the new language every time i18next's
  // language actually changes — dynamic import avoids configService (which
  // is imported by many screens) being pulled into this file's module graph
  // at top-level import time.
  import('services/configService')
    .then(m => m.loadAppConfig())
    .catch(() => {});
});

// Restore a language picked on the onboarding carousel's top-right dropdown
// (see src/onboarding/index.tsx) before this device has ever finished
// signup. `lng: 'en'` above is just the synchronous cold-start default —
// i18next itself has no persistence of its own — so without this, a user
// who set e.g. French on the onboarding slides and then closed the app
// before finishing signup would land back on English next launch. Runs
// async right after init (any UI mounting in that gap briefly renders
// English, same one-frame tradeoff other cold-start caches in this app
// accept — see appConfigCache's comment in constants/Types.tsx). A
// signed-in profile's own `locale` (AuthContext.tsx's syncLanguageFromProfile)
// always wins once it loads, since that runs later, after auth state
// resolves, and writes back to this same AsyncStorage key is unnecessary —
// SignupFirstStep/SelectLanguage only ever need i18n.language itself.
AsyncStorage.getItem(EKeyAsyncStorage.preferredLocale)
  .then(code => {
    if (code && isSupportedLanguageCode(code) && code !== i18n.language) {
      i18n.changeLanguage(code);
    }
  })
  .catch(() => {});
