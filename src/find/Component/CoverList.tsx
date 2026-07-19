import React, { memo } from 'react';
import { Image, ImageRequireSource, TouchableOpacity } from 'react-native';
import { StyleService, useStyleSheet, Layout } from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Carousel from 'react-native-reanimated-carousel';
import keyExtractor from 'utils/keyExtractor';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from 'navigation/types';

interface CoverListProps {
  list: ImageRequireSource[];
}

const CoverList = memo(({ list }: CoverListProps) => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { height, width, top } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const refCarousel = React.useRef(null);

  const [index, setIndex] = React.useState(0);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.54}
      onPress={() => navigate('ProfileGallery')}
    >
      <Carousel
        ref={refCarousel}
        data={list}
        width={width}
        height={height}
        loop
        onSnapToItem={e => {
          setIndex(e);
        }}
        renderItem={({ item }) => {
          return (
            <Image
              source={item}
              style={{ width: width, height: height / 1.5 }}
            />
          );
        }}
      />
      <Layout
        style={[styles.text, { bottom: (180 + top) * (height / 812) }]}
        level="6"
      >
        <Text category="h10" mh={10} mv={2} status="primary">
          {index + 1}/{list.length}
        </Text>
      </Layout>
    </TouchableOpacity>
  );
});

export default CoverList;

const themedStyles = StyleService.create({
  container: {
    position: 'absolute',
    top: 0,
  },
  text: {
    position: 'absolute',
    right: 16,
    borderRadius: 12,
  },
});
