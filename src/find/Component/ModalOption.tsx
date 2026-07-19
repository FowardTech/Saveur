import React from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, Layout} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import {EvaStatus} from '@ui-kitten/components/devsupport';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

interface OptionProps {
  title: string;
  onPress?(): void;
  status?: EvaStatus;
}
interface ModalOptionProps {
  children: OptionProps[];
  onHide?(): void;
}

const ModalOption = ({children, onHide}: ModalOptionProps) => {
  const {height, width, top, bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['common']);
  return (
    <View style={styles.container}>
      <Layout style={styles.content}>
        {children.map((item, i) => {
          return (
            <Flex
              onPress={item.onPress}
              key={i}
              style={[
                {width: width - 32},
                i !== children.length - 1 ? {...styles.item} : null,
              ]}
              justify="center">
              <Text category="h7" bold center mv={16} status={item.status}>
                {item.title}
              </Text>
            </Flex>
          );
        })}
      </Layout>
      <Flex onPress={onHide}>
        <Layout style={[globalStyle.flexOne, styles.cancel]}>
          <Text category="h7" bold center mv={16}>
            {t('common:cancel')}
          </Text>
        </Layout>
      </Flex>
    </View>
  );
};

export default ModalOption;

const themedStyles = StyleService.create({
  container: {
    borderRadius: 12,
  },
  content: {
    borderRadius: 12,
  },
  item: {
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-4',
  },
  cancel: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 16,
  },
});
