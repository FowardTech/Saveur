import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';

import {useTranslation} from 'react-i18next';
import {Onl_State_Types_Enum, Request_Type_Enum} from 'constants/Types';
import {Images} from 'assets/images';
import AbilityItem from './PlanItem';
import TitleField from 'components/TitleField';

const NextPlan = memo(() => {
  const {goBack} = useNavigation();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['home', 'common']);

  const _handleSeeAll = () => {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <TitleField title={t('home:next_plan')} onPress={_handleSeeAll} />
      {/* Content */}
      <AbilityItem
        item={{
          id: '1',
          user: {
            id: '1',
            avatar: Images.avatar3,
            name: 'Christine Bradley',
            onlineState: Onl_State_Types_Enum.Offline,
            age: 24,
          },
          meeting_time: '17:00 - 17:30',
          type: Request_Type_Enum.Interview,
          date: new Date(),
        }}
      />
    </View>
  );
});

export default NextPlan;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
});
