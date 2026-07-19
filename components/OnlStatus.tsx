import React from 'react';
import {View} from 'react-native';
import {useTheme, StyleService, useStyleSheet} from '@ui-kitten/components';
import {Onl_State_Types_Enum} from 'constants/Types';

interface OnlStatusProps {
  status?: Onl_State_Types_Enum;
}

const OnlStatus = ({status}: OnlStatusProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  return (
    <View
      style={[
        styles.onlineIcon,
        {
          backgroundColor:
            status === Onl_State_Types_Enum.Online
              ? theme['color-primary-300']
              : status === Onl_State_Types_Enum.Offline
              ? theme['color-basic-400']
              : status === Onl_State_Types_Enum.LiveStream
              ? theme['color-danger-100']
              : status === Onl_State_Types_Enum.JustLeave
              ? theme['color-primary-300']
              : theme['color-warning-100'],
        },
      ]}
    />
  );
};

export default OnlStatus;

const themedStyles = StyleService.create({
  onlineIcon: {
    width: 16,
    height: 16,
    position: 'absolute',
    borderRadius: 99,
    borderWidth: 2,
    borderColor: 'background-basic-color-2',
    bottom: 2,
    right: 2,
    zIndex: 100,
  },
});
