import React, { memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { DATA_INTERVIEW_TYPES } from 'constants/Data';
import { Difficulty_Enum, Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import * as interviewService from 'services/interviewService';

// "Practice" tab — the entry point for AI mock interviews. Lets a candidate
// jump straight into a category, or open the full setup wizard (mode /
// difficulty / timed). TODO: interview-type cards below are static; wire to
// real content packs & personalized recommendations later.
const FindScreen = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const onStartSetup = (interviewType?: Interview_Type_Enum) => {
    navigate('MockInterviewSetup', { interviewType });
  };

  // Starts a real session (same as MockInterviewSetup does for a Coding
  // pick) so this shortcut actually shows up in Practice History instead of
  // silently skipping session tracking.
  const onStartCodingPractice = async () => {
    const { sessionId } = await interviewService.startSession({
      interviewType: Interview_Type_Enum.Coding,
      mode: Practice_Mode_Enum.Text,
      difficulty: Difficulty_Enum.Intermediate,
      timed: true,
    });
    navigate('CodingInterview', { sessionId, interviewType: Interview_Type_Enum.Coding });
  };

  const TOOLS = [
    { title: 'Resume Builder', icon: 'myPost', onPress: () => navigate('ResumeBuilder') },
    { title: 'JD Analyzer', icon: 'edit_full', onPress: () => navigate('JDAnalyzer') },
    { title: 'Coding Practice', icon: 'edit', onPress: onStartCodingPractice },
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('find:title')} />
      <Content contentContainerStyle={styles.content} padder>
        <Flex
          style={styles.hero}
          vertical
          onPress={() => onStartSetup()}
          justify="flex-start">
          <Text category="h5" status="control" bold mb={8}>
            {t('find:start_mock_interview')}
          </Text>
          <Text category="h8-s" status="control" mb={16}>
            {t('find:start_mock_interview_description')}
          </Text>
          <View style={styles.heroButton}>
            <Text category="h8" status="link" bold>
              {t('find:choose_type_mode')}
            </Text>
            <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
          </View>
        </Flex>

        <Text category="h6" bold mt={32} mb={16}>
          {t('find:tools')}
        </Text>
        <Flex justify="flex-start" wrap>
          {TOOLS.map((tool, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={tool.onPress}
              style={styles.toolCard}>
              <Icon
                pack="assets"
                name={tool.icon}
                style={[globalStyle.icon24, { tintColor: '#181b22' }]}
              />
              <Text category="h9" center mt={8} bold>
                {tool.title}
              </Text>
            </TouchableOpacity>
          ))}
        </Flex>

        <Text category="h6" bold mt={40} mb={16}>
          {t('find:interview_types')}
        </Text>
        <View style={styles.typesGrid}>
          {DATA_INTERVIEW_TYPES.map((item, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => onStartSetup(item.type)}
              style={styles.typeCard}>
              <Icon
                pack="assets"
                name={item.icon}
                style={[globalStyle.icon24, { tintColor: '#181b22' }]}
              />
              <Text category="h9" mt={12} bold numberOfLines={2}>
                {item.type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Content>
    </Container>
  );
});

export default FindScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  hero: {
    marginTop: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: 'button-basic-color',
    ...globalStyle.shadowBtn,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    padding: 16,
    marginBottom: 16,
  },
});
