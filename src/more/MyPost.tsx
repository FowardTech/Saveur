import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  ViewPager,
  Layout,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Content from 'components/Content';
import Container from 'components/Container';
import BasicTabBar from 'components/BasicTabBar';
import {Images} from 'assets/images';
import NavigationAction from 'components/NavigationAction';
import {CaregiverCardProps, Onl_State_Types_Enum} from 'constants/Types';
import {globalStyle} from 'styles/globalStyle';
import {FlatList} from 'react-native-gesture-handler';
import CaregiverPost from './components/CaregiverPost';
import {DATA_CURRENT_APPLICATION} from 'constants/Data';


const MyPost = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const shouldLoadComponent = (index: number) => index === activeIndex;

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:my-post').toString()}
        accessoryLeft={<NavigationAction />}
      />
      <FlatList
        data={[0]}
        stickyHeaderIndices={[0]}
        renderItem={() => {
          return (
            <Layout>
              <BasicTabBar
                style={styles.tabBar}
                activeIndex={activeIndex}
                onChange={setActiveIndex}
                tabs={[
                  t('more:open-job'),
                  t('more:uncompleted'),
                  t('more:close-job'),
                ]}
              />
            </Layout>
          );
        }}
        ListFooterComponent={() => (
          <ViewPager
            onSelect={setActiveIndex}
            selectedIndex={activeIndex}
            shouldLoadComponent={shouldLoadComponent}
            style={globalStyle.flexOne}>
            <Layout style={styles.content} level="1">
              {DATA_CURRENT_APPLICATION.map((item, i) => {
                return <CaregiverPost item={item} key={i} />;
              })}
            </Layout>
            <Content padder style={styles.content}></Content>
            <Content padder style={styles.content}></Content>
          </ViewPager>
        )}
      />
    </Container>
  );
});

export default MyPost;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  tabBar: {
    marginTop: 24,
    paddingBottom: 8,
    ...globalStyle.shadow,
  },
  content: {
    marginTop: 24,
    paddingHorizontal: 24,
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    ...globalStyle.shadow,
  },
});
const DATA_USER: CaregiverCardProps = {
  name: 'Edith Johnson',
  age: 28,
  yearExp: 6,
  location: 'Rochester, NY',
  gender: 'female',
  rate: {rateNumber: 4.68, review: 215},
  avatar: Images.avatar2,
  price: '$15-$20/hr',
  caredFamily: 192,
  backgroundCheck: true,
  carePro: true,
  onlineStatus: Onl_State_Types_Enum.Online,
};
