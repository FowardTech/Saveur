import React, {memo} from 'react';
import {View, Image} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import ApplicationItem from './ApplicationItem';
import {isEmpty} from 'lodash';
import {Images} from 'assets/images';
import {NotificationProps} from 'constants/Types';

interface ApplicationScrProps {
  data: NotificationProps[];
  onPressItem(item: NotificationProps): void;
}

// List body for the real notification screen (src/home/Notification/index.tsx)
// — the empty state and per-row rendering. Screen-level loading/error state
// lives in index.tsx; this component only ever sees an already-loaded list.
const Applications = memo(({data, onPressItem}: ApplicationScrProps) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['notification', 'common']);
  const RenderEmpty = React.useCallback(() => {
    return (
      <View style={styles.emptyContent}>
        <Image source={Images.noApplication} />
        <Text category="h6" mt={46} mb={16}>
          {t('notification:empty_title', {defaultValue: "You're all caught up!"})}
        </Text>
        <Text center category="para-m" mh={40}>
          {t('notification:empty_description', {
            defaultValue: 'New notifications about your interview practice will show up here.',
          })}
        </Text>
      </View>
    );
  }, [styles.emptyContent, t]);

  return (
    <Container style={styles.container}>
      {isEmpty(data) ? (
        <RenderEmpty />
      ) : (
        <>
          {data.map(item => {
            return <ApplicationItem item={item} key={item.id} onPress={() => onPressItem(item)} />;
          })}
        </>
      )}
    </Container>
  );
});

export default Applications;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    marginTop:-45,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  findJob: {
    marginTop: 24,
  },
});
