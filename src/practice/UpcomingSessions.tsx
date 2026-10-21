import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import {NavigationProp, useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import CtaButton from 'components/CtaButton';
import {SkeletonListRow} from 'components/Skeleton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {ScheduledInterviewProps} from 'constants/Types';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import {getInterviewTypeLabel, getPracticeModeLabel} from 'utils/interviewTypeLabels';
import {guessCompanyLogoUrl} from 'utils/companyLogo';

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Product request: a session scheduled for today shows in Home's "Today"
// card; anything scheduled for a later day lives here, in the drawer's
// "Upcoming" screen, which lists every scheduled mock interview (today's
// included, so this is the one place to see them all and manage them).
const UpcomingSessions = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t, i18n} = useTranslation(['common', 'home', 'find']);

  const [sessions, setSessions] = React.useState<ScheduledInterviewProps[] | undefined>(undefined);

  const load = React.useCallback(() => scheduledInterviewService.listUpcoming().then(setSessions), []);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      scheduledInterviewService.listUpcoming().then(list => {
        if (!cancelled) setSessions(list);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const dayLabel = (ms: number) => {
    const diffDays = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 86400000);
    if (diffDays === 0) return t('common:upcoming_today', {defaultValue: 'Today'}).toString();
    if (diffDays === 1) return t('common:upcoming_tomorrow', {defaultValue: 'Tomorrow'}).toString();
    return new Date(ms).toLocaleDateString(i18n.language, {weekday: 'long', month: 'short', day: 'numeric'});
  };
  const timeLabel = (ms: number) =>
    new Date(ms).toLocaleTimeString(i18n.language, {hour: 'numeric', minute: '2-digit'});

  const onPressSession = (s: ScheduledInterviewProps) => {
    if (Date.now() < s.scheduledAt) {
      Alert.alert(
        t('home:upcoming_session_not_ready_title', {defaultValue: 'Not quite time yet'}),
        t('home:upcoming_session_not_ready_body', {
          defaultValue: 'This session unlocks at {{time}}.',
          time: new Date(s.scheduledAt).toLocaleString(i18n.language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }).toString(),
      );
      return;
    }
    navigate('MockInterviewSetup', {
      interviewType: s.interviewType,
      mode: s.mode,
      difficulty: s.difficulty,
      role: s.role,
      company: s.company,
      durationMin: s.durationMin,
    });
  };

  const onDelete = (s: ScheduledInterviewProps) => {
    Alert.alert(
      t('home:upcoming_session_delete_confirm_title', {defaultValue: 'Cancel this session?'}),
      t('home:upcoming_session_delete_confirm_body', {defaultValue: 'You can always schedule a new one later.'}).toString(),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
        {
          text: t('common:delete', {defaultValue: 'Delete'}).toString(),
          style: 'destructive',
          onPress: async () => {
            setSessions(prev => prev?.filter(x => x.id !== s.id));
            try {
              await scheduledInterviewService.removeScheduled(s.id);
            } finally {
              load();
            }
          },
        },
      ],
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={
          <Text center category="h6" bold>
            {t('common:upcoming_title', {defaultValue: 'Upcoming'})}
          </Text>
        }
      />
      <Content contentContainerStyle={styles.content}>
        {sessions === undefined ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : sessions.length === 0 ? (
          <View style={styles.empty}>
            <Icon pack="eva" name="calendar-outline" style={{width: 32, height: 32, tintColor: theme['text-hint-color']}} />
            <Text category="h8" bold mt={12} center>
              {t('common:upcoming_empty_title', {defaultValue: 'No upcoming sessions'})}
            </Text>
            <Text category="h9" status="placeholder" mt={6} center>
              {t('common:upcoming_empty_body', {defaultValue: 'Schedule a mock interview and it will show up here.'})}
            </Text>
          </View>
        ) : (
          sessions.map((s, i) => {
            const ready = Date.now() >= s.scheduledAt;
            const showDay = i === 0 || startOfDay(sessions[i - 1].scheduledAt) !== startOfDay(s.scheduledAt);
            return (
              <View key={s.id}>
                {showDay ? (
                  <Text category="h9" bold mb={8} mt={i === 0 ? 0 : 12} style={{color: theme['text-hint-color']}}>
                    {dayLabel(s.scheduledAt)}
                  </Text>
                ) : null}
                <TouchableOpacity activeOpacity={0.8} onPress={() => onPressSession(s)} style={styles.row}>
                  {s.company ? (
                    <CompanyLogoAvatar logoUrl={guessCompanyLogoUrl(s.company)} companyName={s.company} size="medium" />
                  ) : (
                    <View style={styles.iconBadge}>
                      <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon20, {tintColor: '#FFFFFF'}]} />
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text category="h8" bold numberOfLines={1}>
                      {getInterviewTypeLabel(s.interviewType, t)}
                    </Text>
                    <Text category="h10" status="placeholder" mt={2} numberOfLines={1}>
                      {[timeLabel(s.scheduledAt), s.role, s.company].filter(Boolean).join(' · ')}
                    </Text>
                    <Text category="h10" status="placeholder" mt={2} numberOfLines={1}>
                      {`${getPracticeModeLabel(s.mode, t)} · ${s.durationMin} ${t('common:upcoming_min', {defaultValue: 'min'})}`}
                    </Text>
                  </View>
                  <Icon
                    pack="eva"
                    name={ready ? 'chevron-right-outline' : 'lock-outline'}
                    style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]}
                  />
                  <TouchableOpacity
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    onPress={() => onDelete(s)}
                    style={styles.deleteBtn}>
                    <Icon pack="eva" name="close-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </Content>
      <View style={styles.footer}>
        <CtaButton onPress={() => navigate('ScheduleInterview')}>
          {t('common:upcoming_schedule_cta', {defaultValue: 'Schedule a session'})}
        </CtaButton>
      </View>
    </Container>
  );
});

export default UpcomingSessions;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24},
  empty: {alignItems: 'center', paddingTop: 80, paddingHorizontal: 32},
  row: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-2',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'color-primary-solid',
  },
  rowText: {flex: 1, marginLeft: 12, marginRight: 8},
  deleteBtn: {marginLeft: 10},
  footer: {paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8},
});
