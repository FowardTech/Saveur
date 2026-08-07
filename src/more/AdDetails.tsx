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
import CtaButton from 'components/CtaButton';

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
        {/* BUG FIX (product report: "I dont want banner title, subtitle
            and detail screen body to be mandatory... sometimes I might not
            want a caption to show in the ads") — title/detailBody used to
            render unconditionally, so an image-only ad with no caption at
            all still showed an empty white card (empty heading + empty
            paragraph) floating below the image. Now the whole card is
            skipped when there's genuinely nothing to show in it, and each
            line inside it is independently optional so a title-only or
            detail-only ad doesn't leave a blank gap where the other was. */}
        {ad.title || ad.detailBody ? (
          <Layout level="2" style={styles.card}>
            {ad.title ? (
              <Text category="h3" bold mb={ad.detailBody ? 12 : 0}>
                {ad.title}
              </Text>
            ) : null}
            {ad.detailBody ? (
              <Text category="h8-s" style={styles.detailBody}>
                {ad.detailBody}
              </Text>
            ) : null}
          </Layout>
        ) : null}

        {ad.ctaUrl ? (
          <CtaButton style={[globalStyle.shadowBtn]} onPress={onCta}>
            {ad.ctaLabel || t('more:learn_more', {defaultValue: 'Learn more'})}
          </CtaButton>
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
    padding: 20,
    marginBottom: 24,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  detailBody: {
    lineHeight: 22,
  },
});
