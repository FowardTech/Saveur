import React from 'react';
import {Alert} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Icon,
  Toggle,
  useTheme,
} from '@ui-kitten/components';
import Flex from 'components/Flex';
import ButtonFill from 'components/ButtonFill';
import {globalStyle} from 'styles/globalStyle';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {MainBottomTabStackParamList} from 'navigation/types';

export interface ButtonOptionalProps {
  title: string;
  icon: string;
  onPress?(): void;
  navigateSrc?:
    | 'ProfileSrc'
    | 'MyChildren'
    | 'EditProfile'
    | 'PaymentMethod'
    | 'MyPost'
    | 'ChangeCareType'
    | 'MoreSrc'
    | 'ReferFriend';
  withToggle?: boolean;
  checked?: boolean;
  status:
    | 'basic'
    | 'danger'
    | 'placeholder'
    | 'success'
    | 'facebook'
    | 'warning'
    | 'twitter'
    | 'green'
    | 'twitter-3'
    | 'white'
    | 'transparent'
    | 'neutral';
}

const ButtonOptional = ({
  title,
  icon = 'back',
  status,
  onPress,
  withToggle,
  checked,
  navigateSrc,
}: ButtonOptionalProps) => {
  const theme = useTheme();
  const {navigate, goBack} =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();

  const onNavigate = React.useCallback(() => {
    if (navigateSrc === undefined) {
      Alert.alert('Warning', 'This feature is not available yet');
    } else {
      navigate('Profile', {screen: navigateSrc});
    }
  }, [navigateSrc]);
  const styles = useStyleSheet(themedStyles);
  return (
    <Flex
      style={styles.container}
      itemsCenter
      mt={24}
      onPress={onPress ? onPress : onNavigate}>
      <Flex justify="flex-start" itemsCenter>
        <ButtonFill icon={icon} status={status} size="medium" />
        <Text ml={24} category="para-m">
          {title}
        </Text>
      </Flex>
      {withToggle ? (
        <Toggle
          onChange={onPress}
          status="primary"
          onPress={onPress}
          checked={checked}
        />
      ) : (
        <Icon
          pack="assets"
          name="arrowRight"
          style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]}
        />
      )}
    </Flex>
  );
};

export default ButtonOptional;

const themedStyles = StyleService.create({
  container: {},
});
