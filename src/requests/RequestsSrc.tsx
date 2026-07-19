import React, {memo} from 'react';
import {View, FlatList} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Layout,
  ViewPager,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Container from 'components/Container';
import {globalStyle} from 'styles/globalStyle';
import keyExtractor from 'utils/keyExtractor';
import BasicTabBar from 'components/BasicTabBar';
import ApplicationsTab from './Applications/ApplicationsTab';
import PracticeHistoryTab from './PracticeHistory/PracticeHistoryTab';

const RequestsSrc = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const shouldLoadComponent = React.useCallback(
    (index: number) => index === activeIndex,
    [activeIndex],
  );

  const ListFooterComponent = React.useCallback(() => {
    return (
      <View style={styles.footer}>
        <ViewPager
          selectedIndex={activeIndex}
          onSelect={setActiveIndex}
          style={[globalStyle.flexOne]}
          swipeEnabled={false}
          shouldLoadComponent={shouldLoadComponent}>
          <ApplicationsTab />
          <PracticeHistoryTab />
        </ViewPager>
      </View>
    );
  }, [activeIndex, shouldLoadComponent, styles.footer]);
  const ListHeaderComponent = React.useCallback(() => {
    return (
      <Layout>
        <BasicTabBar
          style={styles.tabBar}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          tabs={[t('request:applications'), t('request:practice_history')]}
        />
      </Layout>
    );
  }, [activeIndex, styles.tabBar, t]);

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('request:title').toString()} />
      <FlatList
        renderItem={() => <></>}
        stickyHeaderIndices={[0]}
        keyExtractor={keyExtractor}
        data={[0]}
        contentContainerStyle={styles.content}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        showsVerticalScrollIndicator={false}
      />
    </Container>
  );
});

export default RequestsSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {},
  tabBar: {
    marginTop: 12,
    paddingHorizontal: 12,
  },
  footer: {
    marginHorizontal: 24,
    paddingBottom: 40,
  },
});
