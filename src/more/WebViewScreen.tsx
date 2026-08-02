import React, {memo} from 'react';
import {ActivityIndicator, Alert, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {WebView, WebViewNavigation, WebViewMessageEvent} from 'react-native-webview';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum} from 'constants/Types';
import {Images} from 'assets/images';
import * as applicationsService from 'services/applicationsService';
import * as jobAlertsService from 'services/jobAlertsService';

// Generic in-app WebView screen — currently used to open a job posting's
// apply page from src/more/JobAlerts.tsx / JobAlertDetails.tsx (so tapping a
// job alert stays in-app, "click it and it redirects them to the
// application page (webview)" per the feature request, instead of leaving
// to the system browser). Deliberately generic (title + url params) rather
// than job-alert-specific, so anything else in the app that needs an
// in-app browser later can reuse it too.
//
// --- Job-application auto-tracking (only active when `job` param is set) ---
// The real "Submit Application" button lives on the employer's own ATS page
// (Greenhouse/Lever/Workday/etc.), not anything this app controls — so there
// is no click handler of ours to hook. What we CAN do, because a WebView is
// not sandboxed the way a cross-origin fetch() would be (CORS restricts
// network calls between origins, not a script observing the DOM of the page
// it's actually rendering), is inject a script into the loaded page itself
// that watches for the same signal a human would look for: the confirmation
// message every ATS shows after a successful submit ("Thank you for
// applying", "Your application has been submitted", etc.), plus a
// secondary signal of the URL changing to something "thank-you"/"confirm"/
// "success"-shaped. Neither signal is platform-specific — we don't have
// verified exact URL schemes for the dozens of ATS platforms this app can
// surface postings from, so scanning the rendered page's own text for
// human-readable confirmation phrasing is the more honest, broadly-portable
// approach vs. guessing at per-platform URL paths.
// Belt-and-suspenders fallback: if neither signal fires but the user spent
// real time on the page and actually navigated within it (not just glanced
// and bounced), ask directly on the way out rather than silently losing
// the application from the tracker.
const SUCCESS_PHRASES = [
  'thank you for applying', 'thanks for applying',
  'application submitted', 'application has been submitted',
  'application was submitted', 'successfully submitted your application',
  'we have received your application', "we've received your application",
  'your application has been received', 'application received',
  'application complete', 'application is complete',
  'submitted your application', 'thank you for your application',
  'your application was successful',
];

const SUCCESS_URL_KEYWORDS = [
  'thank-you', 'thankyou', 'thank_you',
  'confirmation', 'confirm-submission',
  'success', 'submitted', 'application-complete', 'application-received',
];

// Bug report: "the app is still fetching job alerts that are redirecting
// the users to non-existing workday pages" — a posting that was live when
// the backend verified it (see Saveur-Backend's job_search_service.py,
// DEAD_PAGE_MARKERS) can still have closed by the time a user actually taps
// it days later, and Workday's career sites in particular are JS-rendered
// SPAs that render their own "this page doesn't exist" text client-side —
// something no automated check can fully rule out in advance. Rather than
// only ever fixing this upstream (which can never have a 100% guarantee),
// this closes the loop at the actual point of failure: scan the real,
// fully-rendered page the user is looking at for the same phrases the
// backend already checks for, and show our own graceful "no longer
// available" screen instead of letting the raw Workday/ATS error page sit
// inside the app looking like something WE broke. Kept in sync with that
// backend list by hand (no shared source between a Python service and a
// WebView-injected JS string) — same set of phrases, same intent.
const DEAD_PAGE_MARKERS = [
  'page not found', 'job not found', 'position no longer',
  'no longer accepting applications', 'this job is no longer',
  'job has expired', 'this posting has been closed', '404 not found',
  "we couldn't find", 'sorry, this job', 'requisition is not available',
  'the page you are looking for does not exist',
  "page you're looking for does not exist",
  'the page you requested could not be found',
  'this job posting is no longer available',
  'this position has been filled',
  'job posting not found',
];

// Workday's bot/device detection has a history of serving a degraded or
// blocked experience to react-native-webview's default user agent (which
// identifies itself as a mobile app webview, not a real browser) — a
// realistic desktop Chrome UA is a known, low-risk way to get the same
// rendering path a real applicant using an actual browser would get.
// Applies to every apply page this screen opens, not just Workday's, since
// there's no reliable way to know the ATS platform in advance from the URL
// alone in every case, and a desktop UA is a safe default for all of them.
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Minimum time (ms) spent in the WebView, and at least one real in-page
// navigation, before the "did you apply?" fallback prompt is worth showing
// on the way out — avoids asking after someone opens the page and backs out
// in two seconds.
const FALLBACK_MIN_DWELL_MS = 25000;

function buildInjectedJavaScript(): string {
  const phrasesJson = JSON.stringify(SUCCESS_PHRASES);
  const deadPhrasesJson = JSON.stringify(DEAD_PAGE_MARKERS);
  return `
    (function () {
      try {
        var phrases = ${phrasesJson};
        var deadPhrases = ${deadPhrasesJson};
        var fired = false;
        function scan() {
          if (fired) return;
          try {
            var text = (document.body && document.body.innerText || '').toLowerCase();
            // Dead-posting check runs first — a page that's actually gone
            // shouldn't also get a chance to match a success phrase (it
            // won't in practice, but checking dead-ness first keeps the
            // intent unambiguous).
            for (var d = 0; d < deadPhrases.length; d++) {
              if (text.indexOf(deadPhrases[d]) !== -1) {
                fired = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'dead_posting', matchedPhrase: deadPhrases[d],
                }));
                if (window.__saveurApplyObserver) { window.__saveurApplyObserver.disconnect(); }
                if (window.__saveurApplyInterval) { clearInterval(window.__saveurApplyInterval); }
                return;
              }
            }
            for (var i = 0; i < phrases.length; i++) {
              if (text.indexOf(phrases[i]) !== -1) {
                fired = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'application_submitted', matchedPhrase: phrases[i],
                }));
                if (window.__saveurApplyObserver) { window.__saveurApplyObserver.disconnect(); }
                if (window.__saveurApplyInterval) { clearInterval(window.__saveurApplyInterval); }
                return;
              }
            }
          } catch (e) {}
        }
        scan();
        if (document.body && window.MutationObserver) {
          var observer = new MutationObserver(function () { scan(); });
          observer.observe(document.body, {childList: true, subtree: true, characterData: true});
          window.__saveurApplyObserver = observer;
        }
        // Covers pages that render via canvas/shadow-DOM tricks the
        // MutationObserver can miss, and the case where injectedJavaScript
        // runs before document.body exists yet. Capped at 2 minutes of
        // polling so an application page left open in the background isn't
        // burning battery indefinitely.
        var elapsed = 0;
        window.__saveurApplyInterval = setInterval(function () {
          elapsed += 2000;
          if (elapsed > 120000) { clearInterval(window.__saveurApplyInterval); return; }
          scan();
        }, 2000);
      } catch (e) {}
    })();
    true;
  `;
}

function urlLooksLikeSuccess(url: string): boolean {
  const lower = url.toLowerCase();
  return SUCCESS_URL_KEYWORDS.some(kw => lower.includes(kw));
}

const WebViewScreen = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'WebViewScreen'>>();
  const {url, title, job} = route.params ?? {url: ''};
  const [isLoading, setIsLoading] = React.useState(true);
  // Set once the injected script confirms the loaded page is actually a
  // dead/expired posting (see DEAD_PAGE_MARKERS above) — replaces the
  // WebView with our own graceful empty state instead of leaving Workday's
  // (or any other ATS's) own broken-looking error page on screen.
  const [isDead, setIsDead] = React.useState(false);

  const injectedJavaScript = React.useMemo(
    () => (job ? buildInjectedJavaScript() : undefined),
    [job],
  );

  // Refs, not state — these are read from navigation/message callbacks and
  // a beforeRemove listener, none of which should re-render this screen.
  const trackedRef = React.useRef(false);
  const trackingInFlightRef = React.useRef(false);
  const openedAtRef = React.useRef(Date.now());
  const navigatedAwayRef = React.useRef(false);

  const trackApplication = React.useCallback((source: 'auto_detected' | 'manual_confirm') => {
    if (!job || trackedRef.current || trackingInFlightRef.current) return;
    trackingInFlightRef.current = true;
    applicationsService
      .addApplication({
        company: job.company,
        role: job.role,
        location: '',
        logo: Images.avatar1,
        appliedDate: Date.now(),
        stage: Application_Stage_Enum.Applied,
        applyUrl: job.applyUrl,
        companyLogoUrl: job.companyLogoUrl,
        source,
      })
      .then(() => {
        trackedRef.current = true;
        Alert.alert(
          t('more:application_tracked_title', {defaultValue: 'Added to your applications'}),
          t('more:application_tracked_body', {
            defaultValue: 'We added {{role}} at {{company}} to your Application Tracker.',
            role: job.role,
            company: job.company,
          }),
        );
      })
      .catch(() => {
        // Don't interrupt the apply flow over a tracking failure — the
        // application itself still went through on the employer's site.
      })
      .finally(() => {
        trackingInFlightRef.current = false;
      });
  }, [job, t]);

  const onMessage = React.useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'application_submitted') {
        trackApplication('auto_detected');
      } else if (data?.type === 'dead_posting') {
        setIsDead(true);
        // Best-effort — see reportDeadJobAlert's own docstring for why this
        // never blocks/interrupts what the user sees regardless of outcome.
        if (job?.id) {
          jobAlertsService.reportDeadJobAlert(job.id);
        }
      }
    } catch {
      // Ignore malformed/unexpected messages from the page.
    }
  }, [trackApplication, job?.id]);

  const onNavigationStateChange = React.useCallback((navState: WebViewNavigation) => {
    setIsLoading(navState.loading);
    if (!job) return;
    if (navState.url && navState.url !== url) {
      navigatedAwayRef.current = true;
    }
    if (navState.url && urlLooksLikeSuccess(navState.url)) {
      trackApplication('auto_detected');
    }
  }, [job, url, trackApplication]);

  // Fallback: leaving the screen without an automatic detection firing, but
  // only ask if the user plausibly actually engaged with the application
  // (spent real time on it, and the page navigated at least once — e.g.
  // through a multi-step form) rather than just glancing at the posting.
  React.useEffect(() => {
    if (!job) return undefined;
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (trackedRef.current) return;
      const dwellMs = Date.now() - openedAtRef.current;
      if (dwellMs < FALLBACK_MIN_DWELL_MS || !navigatedAwayRef.current) return;
      Alert.alert(
        t('more:did_you_apply_title', {defaultValue: 'Did you apply for this job?'}),
        t('more:did_you_apply_body', {
          defaultValue: "We couldn't confirm automatically — mark {{role}} at {{company}} as applied?",
          role: job.role,
          company: job.company,
        }),
        [
          {text: t('common:no', {defaultValue: 'No'}), style: 'cancel'},
          {
            text: t('more:yes_mark_applied', {defaultValue: 'Yes, mark as applied'}),
            onPress: () => trackApplication('manual_confirm'),
          },
        ],
      );
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, job]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        // This screen's title comes from a job/application title (e.g.
        // "Job Application for Software Engineer - Dubai, UAE at
        // Cobblestone Energy") — long enough to wrap onto a second line
        // with the default unconstrained title render, which then sat
        // directly under/behind the back button. alignment="start" +
        // numberOfLines={1} keeps it to a single truncated line that
        // starts to the right of the back button instead of being
        // centered across the full width and wrapping.
        alignment="start"
        title={
          <Text category="h6" bold numberOfLines={1} ellipsizeMode="tail" style={styles.headerTitle}>
            {title ?? ''}
          </Text>
        }
        accessoryLeft={<NavigationAction />}
      />
      <View style={styles.container}>
        {isDead ? (
          // Bug report: "the app is still fetching job alerts that are
          // redirecting the users to non-existing workday pages" — this
          // replaces whatever raw ATS error page the WebView just rendered
          // (see DEAD_PAGE_MARKERS' own comment above for why that can
          // still happen even after backend verification) with our own
          // graceful state, already reported dead server-side by onMessage
          // above so it won't resurface for this or any other user.
          <Flex vertical center style={styles.deadState}>
            <Icon
              pack="eva"
              name="alert-circle-outline"
              style={[globalStyle.icon40, {tintColor: theme['text-hint-color'], alignItems:'center', textAlign: 'center', jusifyContent:'center'}]}
            />
            <Text category="h6" bold center mt={16}>
              {t('more:job_posting_gone_title', {defaultValue: 'This posting is no longer available'})}
            </Text>
            <Text category="h9-s" status="placeholder" center mt={8} mb={24}>
              {t('more:job_posting_gone_body', {
                defaultValue: "It looks like this job has been filled or taken down. We've removed it so it won't show up again.",
              })}
            </Text>
            <CtaButton size="small" onPress={() => navigation.goBack()}>
              {t('common:go_back', {defaultValue: 'Go back'}).toString()}
            </CtaButton>
          </Flex>
        ) : (
          <>
            <WebView
              source={{uri: url}}
              userAgent={DESKTOP_USER_AGENT}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onNavigationStateChange={onNavigationStateChange}
              injectedJavaScript={injectedJavaScript}
              onMessage={onMessage}
              startInLoadingState={false}
            />
            {isLoading ? (
              <Flex vertical center style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme['color-primary-500']} />
              </Flex>
            ) : null}
          </>
        )}
      </View>
    </Container>
  );
});

export default WebViewScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  headerTitle: {
    marginLeft: 8,
    flexShrink: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'background-basic-color-1',
  },
  deadState: {
    flex: 1,
    paddingHorizontal: 32,
  },
});
