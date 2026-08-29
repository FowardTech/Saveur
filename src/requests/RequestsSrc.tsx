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
      // Product report: "the container holding the applications and
      // practice history tabs is transparent that should not be. It
      // should be white background with bottom box shadow only" -- was
      // transparent (see this block's own prior comment history, now
      // superseded). White fill + a soft shadow on the bottom edge only
      // (shadowOffset height positive, matching this app's other sticky
      // header treatments) so this tab bar reads as a raised strip sitting
      // above the page content below it.
      <Layout style={styles.tabBarWrap}>
        <BasicTabBar
          style={styles.tabBar}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          tabs={[t('request:applications'), t('request:practice_history')]}
        />
      </Layout>
    );
  }, [activeIndex, styles.tabBar, styles.tabBarWrap, t]);

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
  // See ListHeaderComponent's own comment -- white fill + bottom-only
  // shadow (iOS: shadowOffset/Opacity/Radius; Android: elevation).
  tabBarWrap: {
    backgroundColor: 'background-basic-color-2',
    shadowColor: 'rgba(31, 41, 84, 0.35)',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tabBar: {
    marginTop: 12,
    paddingHorizontal: 12,
  },
  footer: {
    marginHorizontal: 24,
    paddingBottom: 40,
  },
});
