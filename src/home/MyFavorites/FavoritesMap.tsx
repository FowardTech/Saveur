import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Container from 'components/Container';
import MapView, {Region} from 'react-native-maps';
import {MY_FAVORITES} from 'constants/Data';
import ButtonFill from 'components/ButtonFill';
import {RootStackParamList} from 'navigation/types';
import IMapView from 'components/IMapView';

const FavoritesMap = memo(() => {
  const {goBack, navigate} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {top} = useLayout();
  const styles = useStyleSheet(themedStyles);

  const [data, setData] = React.useState(MY_FAVORITES);
  const refMap = React.useRef<MapView | null>(null);

  const initialRegion = {
    latitude: 37.785834,
    longitude: -122.406417,
    latitudeDelta: 0.0422,
    longitudeDelta: 0.0421,
  };
  const [pinLocation, setPin] = React.useState<Region>(initialRegion);

  React.useEffect(() => {
    refMap.current?.animateToRegion(pinLocation);
  }, [pinLocation, refMap]);

  const onFilter = () => {
    navigate('FavoritesFilter');
  };

  return (
    <Container style={styles.container} useSafeArea={false}>
      <TopNavigation
        accessoryLeft={() => (
          <ButtonFill
            icon={'close'}
            size="medium"
            status="white"
            onPress={goBack}
          />
        )}
        appearance="control"
        style={{top: top + 16, position: 'absolute', zIndex: 100, left: 12}}
      />
      <IMapView
        dataMaker={data}
        initialRegion={initialRegion}
        onFilter={onFilter}
      />
    </Container>
  );
});

export default FavoritesMap;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  filter: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginRight: 24,
  },
  mapView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    position: 'absolute',
    bottom: 0,
  },
});
