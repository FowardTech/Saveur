import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import BookingItem, {BookingItemProps} from '../Components/BookingItem';
import TitleList from '../Components/TitleList';
import {MainBottomTabStackParamList} from 'navigation/types';
import {useTranslation} from 'react-i18next';
import {Images} from 'assets/images';
import EmptyData from '../Components/EmptyData';
import {Request_Type_Enum} from 'constants/Types';

interface BookingsTabProps {
  currentData: BookingItemProps[];
  passData: BookingItemProps[];
}

const BookingsTab = memo(({passData, currentData}: BookingsTabProps) => {
  const {navigate} =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();
  const styles = useStyleSheet(themedStyles);

  const onSeeAllPast = () => {
    navigate('Interviews', {
      screen: 'RequestsInPast',
      params: {requestType: Request_Type_Enum.Booking},
    });
  };
  const {t} = useTranslation(['request', 'common']);

  return (
    <View style={styles.container}>
      {currentData === undefined && passData === undefined ? (
        <EmptyData
          image={Images.noBooking}
          title={t('request:noBooking')}
          description={t('request:noBookingTitle')}
        />
      ) : (
        <>
          {currentData.length > 0 ? (
            <>
              <TitleList current dataLength={currentData.length} />
              {currentData.map((item, i) => {
                return <BookingItem item={item} key={i} />;
              })}
            </>
          ) : null}
          {passData.length > 0 ? (
            <View style={styles.passContent}>
              <TitleList
                current={false}
                dataLength={passData.length}
                onSeeAll={onSeeAllPast}
              />
              {passData.map((item, i) => {
                return <BookingItem item={item} key={i} />;
              })}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
});

export default BookingsTab;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingTop: 32,
  },
  passContent: {
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
    marginTop: 120,
  },
});
