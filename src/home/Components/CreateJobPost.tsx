import React from 'react';
import {View, Image} from 'react-native';
import {StyleService, useStyleSheet, Button} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import {Images} from 'assets/images';
import {RootStackParamList} from 'navigation/types';

const CreateJobPost = () => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {height, width} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['home', 'common']);

  const _onCreatePost = () => {
    navigate('CreateJobStack', {screen: 'CreateJob'});
  };
  return (
    <View style={styles.container}>
      <Image
        source={Images.createPost}
        style={[
          /* @ts-ignore */
          styles.bg,
          {
            width: 327 * (width / 375),
            height: 152 * (height / 812),
            position: 'absolute',
            marginTop: 16,
          },
        ]}
      />
      <Text category="h7" center status={'control'} mh={64} mb={16} bold>
        {t('home:title_first_time')}
      </Text>
      <Button
        children={() => (
          <Text category="h8" bold status={'primary'}>
            {t('home:create_job_post')}
          </Text>
        )}
        size="medium"
        style={styles.createPostBtn}
        status="warning"
        onPress={_onCreatePost}
      />
    </View>
  );
};

export default CreateJobPost;

const themedStyles = StyleService.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: {
    padding: 24,
    borderRadius: 12,
  },
  createPostBtn: {
    marginHorizontal: 40,
    marginTop: 12,
  },
});
