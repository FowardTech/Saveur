import React, {memo} from 'react';
import {View, Image} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import MapView, {Marker, Region} from 'react-native-maps';
import {Images} from 'assets/images';
import Carousel from 'react-native-snap-carousel';
import AnimatedAppearance from './AnimatedAppearance';
import ButtonFill from './ButtonFill';
import IRecommended from './IRecommended';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';

interface IMapViewProps {
  dataMaker: Array<any>;
  initialRegion: Region;
  onFilter?(): void;
}

const IMapView = memo(({dataMaker, initialRegion, onFilter}: IMapViewProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {height, width} = useLayout();
  const styles = useStyleSheet(themedStyles);

  const refMap = React.useRef<MapView | null>(null);
  const [mapIndex, setMapIndex] = React.useState(0);
  const [pinLocation, setPin] = React.useState<Region>(initialRegion);

  React.useEffect(() => {
    refMap.current?.animateToRegion(pinLocation);
  }, [pinLocation, refMap]);

  const renderEventMap = React.useCallback(({item}) => {
    return (
      <IRecommended item={item} onPress={() => navigate('CaregiverProfile')} />
    );
  }, []);

  return (
    <View style={styles.container}>
      <AnimatedAppearance>
        <MapView
          ref={refMap}
          initialRegion={{...initialRegion}}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsTraffic={false}
          showsBuildings={false}
          onUserLocationChange={event => {
            console.log(event.nativeEvent.coordinate);
          }}
          style={[styles.mapView, {width: width, height: height}]}>
          <Marker
            image={Images.pinLocation}
            coordinate={pinLocation ? pinLocation : initialRegion}
          />
          {dataMaker.map((item, i) => {
            return (
              <Marker
                key={i}
                onPress={() => {
                  setMapIndex(i);
                }}
                coordinate={item.mapLocation ? item.mapLocation : initialRegion}
                children={
                  <Image
                    source={item.avatar}
                    style={{
                      width: 48,
                      height: 48,
                      transform: [{scale: mapIndex === item.id ? 1 : 0.85}],
                    }}
                  />
                }
              />
            );
          })}
        </MapView>
      </AnimatedAppearance>
      <View style={styles.content}>
        <ButtonFill
          status="warning"
          icon="filter"
          size="large"
          style={styles.filter}
          onPress={onFilter}
        />
        {/* <Carousel
          layout={'default'}
          data={dataMaker}
          sliderWidth={width}
          itemWidth={width - 32}
          renderItem={renderEventMap}
          inactiveSlideScale={1}
          inactiveSlideOpacity={1}
          loop
          scrollEventThrottle={16}
          onSnapToItem={index => {
            setMapIndex(index);
            refMap?.current?.animateToRegion({
              ...initialRegion,
              latitude: dataMaker[index].mapLocation.latitude - 0.011,
              longitude: dataMaker[index].mapLocation.longitude,
            });
          }}
        /> */}
      </View>
    </View>
  );
});

export default IMapView;

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
