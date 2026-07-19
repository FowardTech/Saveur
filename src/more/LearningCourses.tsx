import React, { memo } from 'react';
import { Alert, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { DATA_COURSES } from 'constants/Data';

// Mock course catalog — browse/list is the priority here (per the feature
// scope this was built against), not a full lesson-viewer. Progress bars
// are static mock data (see constants/Data.ts -> DATA_COURSES) rather than
// wired to real completion tracking. "Start" surfaces an alert placeholder
// instead of a real lesson player.
// BACKEND TODO: GET /learning/courses (with real per-user progress), and a
// real lesson-content/viewer endpoint behind "Start".
const LearningCourses = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);

  const onStart = (title: string) => {
    Alert.alert(title, 'Course content coming soon.');
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:learning_courses', { defaultValue: 'Learning Courses' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:learning_courses_description', {
            defaultValue: 'Short courses to sharpen specific interview and career skills.',
          })}
        </Text>
        {DATA_COURSES.map(course => {
          const progressPct = course.totalModules > 0 ? course.completedModules / course.totalModules : 0;
          const isComplete = course.completedModules >= course.totalModules;
          return (
            <Layout key={course.id} level="2" style={styles.courseCard}>
              <Flex justify="space-between" itemsCenter mb={6}>
                <View style={styles.categoryPill}>
                  <Text category="h10" bold status="link">{course.category}</Text>
                </View>
                <Text category="h10" status="placeholder">{course.durationMin} min</Text>
              </Flex>
              <Text category="h7" bold mb={4}>{course.title}</Text>
              <Text category="h9-s" status="placeholder" mb={12}>{course.description}</Text>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progressPct * 100)}%`,
                      backgroundColor: isComplete ? theme['color-success-500'] : theme['color-primary-500'],
                    },
                  ]}
                />
              </View>
              <Flex justify="space-between" itemsCenter mt={8} mb={16}>
                <Text category="h10" status="placeholder">
                  {course.completedModules}/{course.totalModules} {t('more:modules', { defaultValue: 'modules' })}
                </Text>
                <Text category="h10" status={isComplete ? 'success' : 'placeholder'} bold>
                  {isComplete ? t('more:completed', { defaultValue: 'Completed' }) : `${Math.round(progressPct * 100)}%`}
                </Text>
              </Flex>

              <Button
                size="small"
                status={isComplete ? 'success' : 'primary'}
                onPress={() => onStart(course.title)}
              >
                {isComplete
                  ? t('more:review', { defaultValue: 'Review' })
                  : course.completedModules > 0
                  ? t('more:continue', { defaultValue: 'Continue' })
                  : t('more:start', { defaultValue: 'Start' })}
              </Button>
            </Layout>
          );
        })}
      </Content>
    </Container>
  );
});

export default LearningCourses;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  courseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  categoryPill: {
    backgroundColor: 'background-basic-color-3',
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
});
