import React, {memo} from 'react';
import {Image} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, Layout, Button} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';

// Landing screen for tapping the admin-configured ad popup — see
// src/home/HomeSrc.tsx for where that popup is triggered and
// services/adsService.ts for the backend contract. Shows the ad's full
// write-up (detail_body); "cta_url" is optional — an ad with no link set
// just shows the write-up with no further action, matching the ask that
// tapping the popup should show "more detail about the advert" rather than
// requiring every ad to leave the app.
const AdDetails = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AdDetails'>>();
  const {ad} = route.params;

  const onCta = () => {
    if (ad.ctaUrl) {
      navigate('WebViewScreen', {url: ad.ctaUrl, title: ad.title});
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:advert', {defaultValue: 'Advert'})} accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        {ad.imageUrl ? (
          <Image source={{uri: ad.imageUrl}} style={styles.image} resizeMode="cover" />
        ) : null}
        <Layout level="2" style={styles.card}>
          <Text category="h5" bold mb={12}>
            {ad.title}
          </Text>
          <Text category="h8-s" style={styles.detailBody}>
            {ad.detailBody}
          </Text>
        </Layout>

        {ad.ctaUrl ? (
          <Button style={[globalStyle.shadowBtn]} onPress={onCta}>
            {ad.ctaLabel || t('more:learn_more', {defaultValue: 'Learn more'})}
          </Button>
        ) : null}
      </Content>
    </Container>
  );
});

export default AdDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    marginBottom: 20,
  },
  card: {
    ...globalStyle.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  detailBody: {
    lineHeight: 22,
  },
});
