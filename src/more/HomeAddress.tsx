import React, { memo } from "react";
import { View } from "react-native";
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
  Autocomplete,
  AutocompleteItem,
  Button,
} from "@ui-kitten/components";
import useLayout from "hooks/useLayout";
import { useTranslation } from "react-i18next";

import Text from "components/Text";
import Content from "components/Content";
import Container from "components/Container";
import NavigationAction from "components/NavigationAction";
import { globalStyle } from "styles/globalStyle";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import Flex from "components/Flex";
import { Images } from "assets/images";
import AnimatedAppearance from "components/AnimatedAppearance";
import { useNavigation } from "@react-navigation/native";

interface AutocompleteItemProps {
  id: number;
  title: string;
}

const HomeAddress = memo(() => {
  const { goBack } = useNavigation();
  const { height, width, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(["more", "common"]);

  const refMap = React.useRef<MapView | null>(null);
  const refInput = React.useRef<Autocomplete | null>(null);
  const [value, setValue] = React.useState("");
  const [data, setData] = React.useState(DATA_AUTO_COMPLETE);

  const filter = (item: AutocompleteItemProps, query: string) =>
    item.title.toLowerCase().includes(query.toLowerCase());
  const onSelect = (index: number) => {
    setValue(data[index].title);
    refInput.current?.blur();
  };

  const onChangeText = (query: string) => {
    setValue(query);
    setData(data.filter((item) => filter(item, query)));
  };

  const initialRegion = {
    latitude: 37.785834,
    longitude: -122.406417,
    latitudeDelta: 0.0422,
    longitudeDelta: 0.0421,
  };
  const [pinLocation, setPin] = React.useState<Region>(initialRegion);
  const [showAutoComplete, setComplete] = React.useState(false);

  const _onPress = React.useCallback(
    (item) => {
      setPin(item.region);
    },
    [refMap]
  );
  React.useEffect(() => {
    refMap.current?.animateToRegion(pinLocation);
  }, [pinLocation, refMap]);
  const _onChooseLocation = () => {
    goBack();
  };
  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content>
        <Text category="h2" mv={16} ml={24}>
          {t("homeAddress")}
        </Text>
        <Autocomplete
          placeholder={t("addressOrZipCode")}
          value={value}
          onChangeText={(nextValue) => onChangeText(nextValue)}
          accessoryLeft={<Icon pack="assets" name="search" />}
          style={styles.input}
          status="basic"
          size="large"
          ref={refInput}
          onSelect={onSelect}
          onFocus={() => {
            setComplete(true);
          }}
          onBlur={() => setComplete(false)}
        >
          {data.map((item, i) => {
            return (
              <AutocompleteItem
                key={i}
                accessoryLeft={<Icon pack="assets" name="searchHistory" />}
              >
                <Flex justify="flex-start" itemsCenter ml={24}>
                  <Icon pack="assets" name="searchHistory" />
                  <Text category="h8" ml={16} status="link">
                    {item.title}
                  </Text>
                </Flex>
              </AutocompleteItem>
            );
          })}
        </Autocomplete>
        <Flex
          itemsCenter
          mb={16}
          justify="flex-start"
          ml={24}
          onPress={() => _onPress(initialRegion)}
        >
          <Icon pack="assets" name="pinMap" style={styles.iconPin} />
          <View>
            <Text category="h8" status={"link"} mb={4}>
              {t("useCurrentLocation")}
            </Text>
            <Text category="h8-s">150 Greene St, New York, NY 10012</Text>
          </View>
        </Flex>
        {showAutoComplete ? (
          <></>
        ) : (
          <AnimatedAppearance>
            <MapView
              ref={refMap}
              initialRegion={{ ...initialRegion }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsTraffic={false}
              showsBuildings={false}
              onUserLocationChange={(event) => {
                console.log(event.nativeEvent.coordinate);
              }}
              style={[
                styles.mapView,
                { width: width, height: 581 * (height / 812) },
              ]}
            >
              <Marker
                image={Images.pinLocation}
                coordinate={pinLocation ? pinLocation : initialRegion}
              />
            </MapView>
          </AnimatedAppearance>
        )}
      </Content>
      <Button
        style={[styles.btn, { marginBottom: bottom + 8 }]}
        children={t("chooseThisLocation").toString()}
        onPress={_onChooseLocation}
        size='large'
      />
    </Container>
  );
});

export default HomeAddress;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  input: {
    ...globalStyle.shadow,
    marginBottom: 32,
    backgroundColor: "background-basic-color-2",
    marginHorizontal: 24,
  },
  mapView: {},
  iconPin: {
    ...globalStyle.icon24,
    tintColor: "text-placeholder-color",
    marginRight: 16,
  },
  btn: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
  },
});
const DATA_AUTO_COMPLETE = [
  {
    id: 0,
    title: "00 Nora Mountains Apt. 929",
    region: {
      latitude: 37.688834,
      longitude: -121.406317,
      latitudeDelta: 0.0422,
      longitudeDelta: 0.0421,
    },
  },
  {
    id: 0,
    title: "100 Nora Mountains Apt. 1929",
    region: {
      latitude: 37.781834,
      longitude: -122.401317,
      latitudeDelta: 0.0422,
      longitudeDelta: 0.0421,
    },
  },
];
