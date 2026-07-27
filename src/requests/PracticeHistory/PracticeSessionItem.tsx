import React from 'react';
import {TouchableOpacity} from 'react-native';
import {
  useStyleSheet,
  useTheme,
  StyleService,
  Layout,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import dayjs from 'utils/dayjs';
import {RootStackParamList} from 'navigation/types';
import {MockInterviewSessionProps} from 'constants/Types';
import {getInterviewTypeLabel, getPracticeModeLabel, getDifficultyLabel, getSessionStatusLabel} from 'utils/interviewTypeLabels';

export interface PracticeSessionItemProps {
  item: MockInterviewSessionProps;
}

const PracticeSessionItem = ({item}: PracticeSessionItemProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['find', 'common']);

  // Completed sessions open their real feedback. A "Scheduled" (upcoming)
  // session hasn't happened yet, so it must NOT go to InterviewFeedback —
  // that screen calls interviewService.completeSession on mount, which would
  // silently mark the not-yet-taken session "Completed" with a fake score.
  // Route it into the setup flow (pre-filled with the same interview type)
  // so tapping it actually starts the interview instead.
  const onPress = () => {
    if (item.status === 'Completed') {
      navigate('InterviewFeedback', {
        sessionId: String(item.id),
        interviewType: item.interviewType,
      });
    } else {
      navigate('MockInterviewSetup', {interviewType: item.interviewType});
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.54}>
      <Layout style={styles.container} level="2">
        <Flex justify="flex-start" itemsCenter mb={8}>
          <Text category="h7" bold style={globalStyle.flexOne} numberOfLines={1}>
            {getInterviewTypeLabel(item.interviewType, t)}
          </Text>
          <Text
            category="h9"
            bold
            status={item.status === 'Completed' ? 'success' : 'warning'}
            style={[
              styles.statusTag,
              {
                backgroundColor:
                  item.status === 'Completed'
                    ? theme['color-success-transparent-200']
                    : theme['color-warning-transparent-200'],
              },
            ]}>
            {item.status === 'Completed'
              ? `${item.overallScore ?? '--'}%`
              : getSessionStatusLabel(item.status, t)}
          </Text>
        </Flex>
        <Text category="h8-s" status="placeholder" mb={4}>
          {getPracticeModeLabel(item.mode, t)} · {getDifficultyLabel(item.difficulty, t)} · {item.durationMin}{' '}
          {t('find:minutes_unit', {defaultValue: 'min'})}
        </Text>
        <Flex justify="flex-start" itemsCenter mt={4}>
          <Icon pack="assets" name="calendar" style={styles.icon} />
          <Text category="h8-s" ml={8}>
            {dayjs(item.date).format('MMM DD, YYYY')}
          </Text>
        </Flex>
      </Layout>
    </TouchableOpacity>
  );
};

export default PracticeSessionItem;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    ...globalStyle.shadowFade,
  },
  statusTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  icon: {
    width: 14,
    height: 14,
    tintColor: 'text-placeholder-color',
  },
});
