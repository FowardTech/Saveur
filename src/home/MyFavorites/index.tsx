import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {MY_FAVORITES} from 'constants/Data';
import IRecommended from 'components/IRecommended';
import {RootStackParamList} from 'navigation/types';
import ButtonFill from 'components/ButtonFill';
import {isEmpty} from 'lodash';
import {Image, View} from 'react-native';
import {Images} from 'assets/images';
import Text from 'components/Text';

const MyFavorites = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['home', 'common']);

  const [data, setData] = React.useState(MY_FAVORITES);
  const _onFilter = React.useCallback(() => {
    return navigate('FavoritesFilter');
  }, []);
  const _onMap = () => {
    navigate('FavoritesMap');
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:my_favorites')}
        accessoryLeft={<NavigationAction />}
        accessoryRight={<NavigationAction icon="map" onPress={_onMap} />}
      />
      {isEmpty(data) ? (
        <View style={styles.contentEmpty}>
          <Image source={Images.emptyFavorites} />
          <Text category="h6" bold mt={40} mb={16}>
            {t('home:empty_favorites_title')}
          </Text>
          <Text category="h7" center mb={32}>
            {t('home:empty_favorites_description')}
          </Text>
          <Button children={t('home:find_caregivers')} />
        </View>
      ) : (
        <>
          <Content contentContainerStyle={styles.content}>
            {data.map((item, i) => {
              return <IRecommended item={item} key={i} mh={24} />;
            })}
          </Content>
          <ButtonFill
            icon="filter"
            status="warning"
            size="large"
            onPress={_onFilter}
            style={styles.filter}
          />
        </>
      )}
    </Container>
  );
});

export default MyFavorites;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 32,
    paddingBottom: 80,
  },
  filter: {
    position: 'absolute',
    right: 12,
    bottom: 60,
  },
  contentEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
