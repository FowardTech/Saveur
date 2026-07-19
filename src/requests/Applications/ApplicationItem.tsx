import React from 'react';
import {View, TouchableOpacity} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Layout,
  Icon,
  Avatar,
} from '@ui-kitten/components';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import dayjs from 'utils/dayjs';
import {useTranslation} from 'react-i18next';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum, JobApplicationProps} from 'constants/Types';

export interface ApplicationItemProps {
  item: JobApplicationProps;
}

// TODO: swap for a real application-tracker data source once the backend exists.
const getStageStatus = (stage: Application_Stage_Enum) => {
  switch (stage) {
    case Application_Stage_Enum.Applied:
      return 'info';
    case Application_Stage_Enum.Interviewing:
      return 'warning';
    case Application_Stage_Enum.Offer:
      return 'success';
    case Application_Stage_Enum.Rejected:
      return 'danger';
    default:
      return 'basic';
  }
};

const ApplicationItem = ({item}: ApplicationItemProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);
  return (
    <TouchableOpacity
      onPress={() => {
        navigate('RequestStack', {
          screen: 'ApplicationDetails',
          params: {id: item.id},
        });
      }}
      activeOpacity={0.54}>
      <Layout style={styles.container} level="1">
        <Flex justify="flex-start" itemsCenter mv={16} mh={16}>
          <Avatar source={item.logo} size="medium" shape="square" style={styles.avatar} />
          <View style={globalStyle.flexOne}>
            <Text category="h7" ml={16} maxWidth={220} bold numberOfLines={1}>
              {item.role}
            </Text>
            <Text category="h8-s" ml={16} status="placeholder" mt={4} numberOfLines={1}>
              {item.company}
            </Text>
          </View>
          <View style={styles.stageTag}>
            <Text category="h9" status={getStageStatus(item.stage) as any} bold>
              {item.stage}
            </Text>
          </View>
        </Flex>
        <Layout level={'2'} style={styles.bottom}>
          <Flex justify="flex-start" itemsCenter mb={8}>
            <Icon pack="assets" name="location16" style={styles.icon} />
            <Text category="h8-s" ml={8}>
              {item.location}
            </Text>
          </Flex>
          <Flex justify="flex-start" itemsCenter>
            <Icon pack="assets" name="calendar" style={styles.icon} />
            <Text category="h8-s" ml={8}>
              {t('request:applied-on', {
                date: dayjs(item.appliedDate).format('MMM DD, YYYY'),
              })}
            </Text>
          </Flex>
          {item.nextStep ? (
            <Text category="h8" status="link" mt={12} bold>
              {item.nextStep}
            </Text>
          ) : null}
        </Layout>
      </Layout>
    </TouchableOpacity>
  );
};

export default ApplicationItem;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 24,
    ...globalStyle.shadowFade,
    borderRadius: 16,
  },
  avatar: {
    marginRight: 4,
  },
  bottom: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'background-basic-color-3',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  icon: {
    width: 14,
    height: 14,
    tintColor: 'text-placeholder-color',
  },
  stageTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'background-basic-color-3',
  },
});
