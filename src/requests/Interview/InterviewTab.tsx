import React, {memo} from 'react';
import {StyleService, useStyleSheet} from '@ui-kitten/components';

import RequestInterviewItem from '../Components/RequestInterviewItem';
import {RequestInterviewItemProps, Request_Type_Enum} from 'constants/Types';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {MainBottomTabStackParamList} from 'navigation/types';
import TitleList from '../Components/TitleList';
import {View} from 'react-native';
import {Images} from 'assets/images';
import {useTranslation} from 'react-i18next';
import EmptyData from '../Components/EmptyData';

interface InterviewProps {
  dataCurrentRequest: RequestInterviewItemProps[];
  dataPassRequest: RequestInterviewItemProps[];
}

const InterviewTab = memo(
  ({dataCurrentRequest, dataPassRequest}: InterviewProps) => {
    const {t} = useTranslation(['request', 'common']);
    const {navigate} =
      useNavigation<NavigationProp<MainBottomTabStackParamList>>();
    const styles = useStyleSheet(themedStyles);

    const onSeeAllPast = () => {
      navigate('Interviews', {
        screen: 'RequestsInPast',
        params: {requestType: Request_Type_Enum.Interview},
      });
    };

    return (
      <View style={styles.container}>
        {dataCurrentRequest && dataPassRequest === undefined ? (
          <EmptyData
            image={Images.noInterview}
            title={t('request:noRequest')}
            description={t('request:noRequestTitle')}
          />
        ) : (
          <View>
            {dataCurrentRequest.length > 0 ? (
              <>
                <TitleList current dataLength={dataCurrentRequest.length} />
                {dataCurrentRequest.map((item, i) => {
                  return <RequestInterviewItem item={item} key={i} />;
                })}
              </>
            ) : null}

            {dataPassRequest.length > 0 ? (
              <>
                <TitleList
                  current={false}
                  dataLength={dataPassRequest.length}
                  mt={20}
                  onSeeAll={onSeeAllPast}
                />
                {dataPassRequest.map((item, i) => {
                  return <RequestInterviewItem item={item} key={i} />;
                })}
              </>
            ) : null}
          </View>
        )}
      </View>
    );
  },
);

export default InterviewTab;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingTop: 32,
  },
  empty: {},
});
