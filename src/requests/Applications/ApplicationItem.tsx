import React from 'react';
import {View, TouchableOpacity} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Layout,
  Icon,
} from '@ui-kitten/components';
import Flex from 'components/Flex';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import {globalStyle} from 'styles/globalStyle';
import dayjs from 'utils/dayjs';
import {useTranslation} from 'react-i18next';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import {JobApplicationProps} from 'constants/Types';
import {isRemoteLocation} from 'utils/jobLocation';
import {getApplicationStageLabel} from 'utils/interviewTypeLabels';

export interface ApplicationItemProps {
  item: JobApplicationProps;
}

// SYMPHONY REDESIGN follow-up (explicit product report: "I told you i dont
// want color pills again. Why are you still putting colored pills in the
// applications screen") — this used to color-code the stage pill's text AND
// background per Applied/Interviewing/Offer/Rejected (see getStageBg below,
// now removed). Same "no per-status color-coding, plain neutral pill"
// direction already applied to the analysis chips in JDAnalyzer.tsx and to
// PracticeSessionItem.tsx's statusTag — a stage now reads only from its
// label text, same as every other pill in the app after that pass.
// getApplicationStageLabel (utils/interviewTypeLabels.ts) still handles the
// actual per-stage text/translation.

const ApplicationItem = ({item}: ApplicationItemProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);
  return (
    <TouchableOpacity
      onPress={() => {
        navigate('RequestStack', {
          screen: 'ApplicationDetails',
          params: {id: item.id},
        });
      }}
      activeOpacity={0.54}>
      {/* BUG FIX (product report: "these cards have a subtle light green
          color... please remove it and let it be white") — level="1"
          resolves to background-basic-color-1 (#F6FAF8), a near-white
          token with a slight green cast; level="2" resolves to
          background-basic-color-2 (#FFFFFF), true white, matching the
          page body underneath it. */}
      <Layout style={styles.container} level="2">
        <Flex justify="flex-start" itemsCenter mv={12} mh={12}>
          <CompanyLogoAvatar
            logoUrl={item.companyLogoUrl}
            companyName={item.company}
            size="medium"
            shape="rounded"
            fallbackIcon="briefcase-outline"
            style={styles.avatar}
          />
          <View style={globalStyle.flexOne}>
            <Text category="h7" ml={16} maxWidth={220} bold numberOfLines={1}>
              {item.role}
            </Text>
            <Text category="h8-s" ml={16} status="placeholder" mt={2} numberOfLines={1}>
              {item.company}
            </Text>
          </View>
          <View style={styles.stageTag}>
            {/* BUG FIX (product report: "make sure everything internally
                must be auto translated") -- was the raw backend enum
                literal (e.g. always "Applied" in English on every
                locale), same class of bug as ApplicationsTab.tsx/
                RequestsInPass.tsx already avoided by going through
                getApplicationStageLabel (utils/interviewTypeLabels.ts),
                which this render site had never been switched to. */}
            <Text category="h9" bold>
              {getApplicationStageLabel(item.stage, t)}
            </Text>
          </View>
        </Flex>
        <Layout level={'2'} style={styles.bottom}>
          {/* Bug report ("the job is not showing location") — root cause
              was upstream (WebViewScreen.tsx's trackApplication() always
              sent an empty location string), not this render, but a
              blank/empty `item.location` should still not render an
              icon next to nothing — hide the whole row instead, same as
              `nextStep` below. Also now shows a "Remote" tag when the
              location text itself says so (see utils/jobLocation.ts —
              there's no separate structured remote flag anywhere in the
              data model to read instead). */}
          {item.location ? (
            <Flex justify="flex-start" itemsCenter mb={6}>
              <Icon pack="assets" name="location16" style={styles.icon} />
              <Text category="h8-s" ml={8}>
                {item.location}
              </Text>
              {isRemoteLocation(item.location) ? (
                <View style={styles.remoteTag}>
                  <Text category="h10" bold>
                    {t('request:remote_tag', {defaultValue: 'Remote'})}
                  </Text>
                </View>
              ) : null}
            </Flex>
          ) : null}
          <Flex justify="flex-start" itemsCenter>
            <Icon pack="assets" name="calendar" style={styles.icon} />
            <Text category="h8-s" ml={8}>
              {/* dayjs.utc(...), not local dayjs(...) — item.appliedDate is
                  a plain calendar date encoded as UTC midnight by the
                  backend (see Saveur-Backend's app/api/tracker.py
                  _to_wire's comment); formatting it in the device's local
                  timezone rolled back to the previous day on any device
                  behind UTC (bug report: "user applied today and it's
                  showing July 31"). */}
              {t('request:applied-on', {
                date: dayjs.utc(item.appliedDate).format('MMM DD, YYYY'),
              })}
            </Text>
          </Flex>
          {item.nextStep ? (
            <Text category="h8" status="link" mt={8} bold>
              {item.nextStep}
            </Text>
          ) : null}
        </Layout>
      </Layout>
    </TouchableOpacity>
  );
};

export default ApplicationItem;

// Product report: "The cards in this interview screen is too big, The gaps
// between each cards are too much. Reduce the height... The application
// tracker screen is not looking perfect." — container's marginBottom (gap
// BETWEEN cards) and every inner row's spacing were all on the loose side;
// tightened together (same direction as PracticeSessionItem.tsx's identical
// pass, see that file's own comment) so a full tracker list reads as a
// compact, scannable list instead of oversized standalone tiles.
const themedStyles = StyleService.create({
  container: {
    ...globalStyle.card,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="1"` background shows through instead.
  },
  avatar: {
    marginRight: 4,
  },
  bottom: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: 'background-basic-color-3',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    // Same explicit 'transparent' as container above — this half renders
    // via <Layout level="2" style={styles.bottom}>, same override-order
    // reasoning. The borderTopWidth/borderColor above still renders fine
    // against a transparent fill, giving the same top/bottom divider look
    // without the opaque gray card fill.
    backgroundColor: 'transparent',
  },
  icon: {
    width: 14,
    height: 14,
    tintColor: 'text-placeholder-color',
  },
  // "Remote" tag next to the location text — same small pill treatment as
  // stageTag below. SYMPHONY REDESIGN follow-up ("I don't want color pills
  // again"): was a color-primary-transparent-100 blue tint; now the same
  // flat neutral gray as stageTag so it doesn't read as a status color.
  remoteTag: {
    marginLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'background-basic-color-3',
  },
  // SYMPHONY REDESIGN follow-up ("I told you i dont want color pills
  // again... why are you still putting colored pills in the applications
  // screen") — was a per-stage color background set inline via getStageBg
  // (now removed). This card's container is a white level="2" Layout, so a
  // flat background-basic-color-3 gray (not white) is used here so the
  // pill still reads as a distinct badge rather than disappearing into the
  // card behind it — same reasoning as PracticeSessionItem.tsx's
  // statusTag, see that file's own comment.
  stageTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'background-basic-color-3',
  },
});
