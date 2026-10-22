import React, {memo} from 'react';
import {TopNavigation, StyleService, useStyleSheet} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import CoachingReportCard from 'components/CoachingReportCard';
import {RootStackParamList} from 'navigation/types';

// Home no longer shows the coaching report card (it was long and pushed the
// rest of the dashboard down); it lives here, reached from the drawer.
const CoachingReportScreen = memo(() => {
  const {goBack} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['home', 'common']);
  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={
          <Text center category="h6" bold>
            {t('home:coaching_report_title', {defaultValue: 'Your Coaching Report'})}
          </Text>
        }
      />
      <Content contentContainerStyle={styles.content}>
        <CoachingReportCard />
      </Content>
    </Container>
  );
});

export default CoachingReportScreen;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32},
});
