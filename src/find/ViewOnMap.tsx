import React, {memo} from 'react';
import {StyleSheet, useWindowDimensions, View, Image} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  ViewPager,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import {RootStackParamList} from 'navigation/types';
import NavigationAction from 'components/NavigationAction';
import BasicTabBar from 'components/BasicTabBar';
import IMapView from 'components/IMapView';
import {MY_FAVORITES} from 'constants/Data';

const ViewOnMap = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common']);

  const [selected, setSelected] = React.useState(0);
  const [data, setData] = React.useState(MY_FAVORITES);
  const initialRegion = {
    latitude: 37.785834,
    longitude: -122.406417,
    latitudeDelta: 0.0422,
    longitudeDelta: 0.0421,
  };
  const onFilter = () => {};
  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:view_on_map')}
        accessoryLeft={<NavigationAction icon="close" />}
      />
      <BasicTabBar
        style={styles.tab}
        activeIndex={selected}
        onChange={setSelected}
        tabs={[t('find:recommended'), t('find:new_profile'), t('find:nearby')]}
      />
      <ViewPager
        selectedIndex={selected}
        swipeEnabled={false}
        style={styles.container}>
        <View style={styles.viewPager}>
          <IMapView
            dataMaker={data}
            initialRegion={initialRegion}
            onFilter={onFilter}
          />
        </View>
        <>
          <Text>New Profile</Text>
        </>
        <>
          <Text>Nearby</Text>
        </>
      </ViewPager>
    </Container>
  );
});

export default ViewOnMap;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  viewPager: {
    flex: 1,
    marginTop: 12,
  },
  tab: {
    marginTop: 12,
  },
});
