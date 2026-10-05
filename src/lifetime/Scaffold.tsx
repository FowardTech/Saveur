import React from 'react';
import {Alert, View} from 'react-native';
import {TopNavigation, Layout, Spinner, useTheme} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';

// Shared chrome for the lifetime career screens.
export const LifetimeScreen = ({title, children, avoidKeyboard}: {title: string; children: React.ReactNode; avoidKeyboard?: boolean}) => {
  const navigation = useNavigation<any>();
  return (
    <Container style={{flex: 1}}>
      <TopNavigation title={title} accessoryLeft={<NavigationAction onPress={() => navigation.goBack()} />} />
      <Content padder avoidKeyboard={avoidKeyboard} extraScrollHeight={120} enableOnAndroid contentContainerStyle={{paddingBottom: 80}}>
        {children}
      </Content>
    </Container>
  );
};

export const Card = ({children, style}: {children: React.ReactNode; style?: any}) => (
  <Layout level="2" style={[{borderRadius: 16, padding: 16, marginBottom: 12}, style]}>
    {children}
  </Layout>
);

export const H = ({children}: {children: React.ReactNode}) => (
  <Text category="h7" bold mt={8} mb={8}>
    {children}
  </Text>
);

export const Bullets = ({items, color}: {items: string[]; color?: string}) => (
  <View>
    {items.map((x, i) => (
      <View key={i} style={{flexDirection: 'row', marginTop: 4}}>
        <Text category="h9" style={{color, marginRight: 8}}>
          •
        </Text>
        <Text category="h9-s" style={{flex: 1, lineHeight: 21}}>
          {x}
        </Text>
      </View>
    ))}
  </View>
);

export const Loading = () => (
  <View style={{alignItems: 'center', paddingVertical: 48}}>
    <Spinner size="large" />
  </View>
);

export const Pill = ({label, color = '#7C5CFF'}: {label: string; color?: string}) => (
  <View style={{alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: color + '26'}}>
    <Text category="h10" bold style={{color}}>
      {label}
    </Text>
  </View>
);

export const PrimaryButton = ({label, onPress, loading, disabled, style}: {label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: any}) => (
  <CtaButton loading={loading} disabled={disabled || loading} onPress={onPress} style={style}>
    {label}
  </CtaButton>
);

/** Shows server errors; a 402 means a paid plan is needed. */
export const useAsyncAction = (t: (k: string, o?: any) => any) => {
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e: any) {
        const status = e?.response?.status;
        Alert.alert(
          status === 402 || status === 403
            ? String(t('common:upgrade_required', {defaultValue: 'Upgrade required'}))
            : String(t('common:something_went_wrong', {defaultValue: 'Something went wrong'})),
          status === 402 || status === 403
            ? String(t('common:upgrade_required_body', {defaultValue: 'This feature is part of a paid plan.'}))
            : e?.response?.data?.message ?? e?.message,
        );
      } finally {
        setBusy(false);
      }
    },
    [t],
  );
  return {busy, run};
};

export const useTint = () => {
  const theme = useTheme();
  return theme['text-hint-color'];
};
