import React from 'react';
import {View, TouchableOpacity} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  useTheme,
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
import {Application_Stage_Enum, JobApplicationProps} from 'constants/Types';
import {isRemoteLocation} from 'utils/jobLocation';

export interface ApplicationItemProps {
  item: JobApplicationProps;
}

// Maps a tracked application's real backend stage (services/
// applicationsService.ts's listApplications) to this design system's status
// color tokens for the stage pill below.
const getStageStatus = (stage: Application_Stage_Enum) => {
  switch (stage) {
    case Application_Stage_Enum.Applied:
      return 'info';
    case Application_Stage_Enum.Interviewing:
      return 'warning';
    case Application_Stage_Enum.Offer:
      return 'success';
    case Application_Stage_Enum.Rejected:
      return 'danger';
    default:
      return 'basic';
  }
};

// Product report ("make the applied pills look better") — the stage pill
// used to be a flat background-basic-color-3 gray no matter the stage, with
// only the TEXT color (via getStageStatus above) hinting at Applied/
// Interviewing/Offer/Rejected. Same "tinted background, not just tinted
// text" treatment PracticeSessionItem.tsx's statusTag already uses for its
// own success/warning pill — a stage now reads at a glance from the pill's
// color alone, not just from parsing the label text.
// Falls back to the solid -100 tint if a -transparent-200 token isn't
// resolved for a given status — same defensive pattern already used for
// this exact "info" status elsewhere (src/home/Notification/
// ApplicationItem.tsx's colorFor), since 'info' specifically isn't
// overridden in this app's own light.json/dark.json (see PaymentHistory.tsx's
// comment on that) and comes entirely from Eva's base theme merge.
const getStageBg = (stage: Application_Stage_Enum, theme: Record<string, string>) => {
  switch (getStageStatus(stage)) {
    case 'info':
      return theme['color-info-transparent-200'] ?? theme['color-info-100'];
    case 'warning':
      return theme['color-warning-transparent-200'] ?? theme['color-warning-100'];
    case 'success':
      return theme['color-success-transparent-200'] ?? theme['color-success-100'];
    case 'danger':
      return theme['color-danger-transparent-200'] ?? theme['color-danger-100'];
    default:
      return theme['background-basic-color-3'];
  }
};

const ApplicationItem = ({item}: ApplicationItemProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
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
          <View style={[styles.stageTag, {backgroundColor: getStageBg(item.stage, theme)}]}>
            <Text category="h9" status={getStageStatus(item.stage) as any} bold>
              {item.stage}
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
                  <Text category="h10" bold status="info">
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
  // "Remote" tag next to the location text — same small pill treatment
  // as stageTag below, just a distinct info-blue tint so it doesn't read
  // as another pipeline-stage badge.
  remoteTag: {
    marginLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'color-primary-transparent-100',
  },
  // backgroundColor is now set inline per-stage (see getStageBg above) —
  // was a flat background-basic-color-3 gray for every stage, so this base
  // style only carries the shape now.
  stageTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
});
