import React, { memo } from 'react';
import { View } from 'react-native';
import { StyleService, useStyleSheet } from '@ui-kitten/components';
import { useNavigation } from '@react-navigation/native';

import { useTranslation } from 'react-i18next';
import IRecommended from 'components/IRecommended';
import { UserProps } from 'constants/Types';
import TitleField from 'components/TitleField';

interface MyRecommendedProps {
  data: UserProps[];
}

const MyRecommend = memo(({ data }: MyRecommendedProps) => {
  const { goBack } = useNavigation();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);

  const _handleSeeAll = () => {};
  return (
    <View style={styles.container}>
      <TitleField title={t('home:recommend_for_you')} onPress={_handleSeeAll} />
      {data &&
        data.map((item, i) => {
          return <IRecommended item={item} key={i} mh={24} />;
        })}
    </View>
  );
});

export default MyRecommend;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    marginTop: 48,
  },
});
