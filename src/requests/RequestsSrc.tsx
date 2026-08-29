import React, {memo} from 'react';
import {View, FlatList} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  ViewPager,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
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
      // SYMPHONY REDESIGN follow-up (product report: "remove the white
      // background covering the tabs. Just make the tabs button pills
      // thats enough") -- reverses the earlier white-card-with-shadow
      // wrapper (see this block's superseded comment history) per this
      // explicit new instruction. Just the pill tabs now, no wrapping
      // card, sitting directly on the screen's own background.
      <BasicTabBar
        style={styles.tabBar}
        activeIndex={activeIndex}
        onChange={setActiveIndex}
        tabs={[t('request:applications'), t('request:practice_history')]}
      />
    );
  }, [activeIndex, styles.tabBar, t]);

  return (
    <Container style={styles.container}>
      {/* BUG FIX (product report: "check any other screen that does not
          have a back button... since we have remove the bottom tab
          navigation") -- same root cause/fix as FindScreen.tsx's own
          comment: this is the "Interviews" tab (Applications/Practice
          History), reached only via MoreSrc.tsx's row tap now that the
          bottom tab bar is gone, previously with no way back. Plain
          default goBack() resolves at the hidden tab navigator's own
          level (backBehavior="history"), returning to whichever of
          Home/Coach/Profile was open before. */}
      <TopNavigation title={t('request:title').toString()} accessoryLeft={() => <NavigationAction />} />
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
