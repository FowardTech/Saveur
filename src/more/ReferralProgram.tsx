import React, { memo } from 'react';
import { Alert, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
  Spinner,
} from '@ui-kitten/components';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import * as referralService from 'services/referralService';
import { ReferralSummary } from 'services/referralService';

// Referral program — share a link, both sides get a reward off their next
// subscription once the referred person actually subscribes to a paid plan
// (see services/referralService.ts, backend spec addendum §6). The reward
// amount is admin-configurable (career-spark-suite's Growth page — see
// app_config_service.py's "referral" section) and changes without a
// release, so the copy below reads it from `summary.rewardAmountCents`
// instead of a hardcoded "$5" — it used to say "$5" unconditionally even
// after an admin changed the actual configured amount.
const ReferralProgram = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);

  const [summary, setSummary] = React.useState<ReferralSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [redeemCode, setRedeemCode] = React.useState('');
  const [isRedeeming, setIsRedeeming] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await referralService.getMyReferral();
      setSummary(result);
    } catch (e: any) {
      setLoadError(e?.message ?? t('more:referral_load_failed', {defaultValue: 'Could not load your referral info.'}));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const rewardLabel = summary ? `$${(summary.rewardAmountCents / 100).toFixed(2)}` : '';

  const onShare = async () => {
    if (!summary) return;
    try {
      await Share.share({
        // `url` below already carries the link (and is what gives iOS its
        // native Open-Graph link-preview card via web.py's referral_redirect
        // page) — the message text used to ALSO interpolate {{url}} into
        // itself, which made iOS's share sheet show the link twice: once
        // inside this text, once as the separate preview card for `url`.
        message: t('more:referral_share_message', {
          defaultValue:
            "Join me on Saveur and get {{reward}} off your first Pro subscription — I'll get {{reward}} off mine too!",
          reward: rewardLabel,
        }),
        url: summary.shareUrl,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const onRedeem = async () => {
    const code = redeemCode.trim();
    if (!code || isRedeeming) return;
    setIsRedeeming(true);
    try {
      const ok = await referralService.redeemCode(code);
      if (ok) {
        Alert.alert(
          t('more:referral_code_applied_title', {defaultValue: 'Code applied'}),
          t('more:referral_code_applied_body', {defaultValue: 'This referral has been recorded.'}),
        );
        setRedeemCode('');
      } else {
        Alert.alert(
          t('more:referral_code_failed_title', {defaultValue: "Couldn't apply that code"}),
          t('more:referral_code_failed_body', {
            defaultValue: "It may be invalid, your own code, or you've already been referred.",
          }),
        );
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:refer_and_earn', {defaultValue: 'Refer & Earn'})} accessoryLeft={<NavigationAction />} />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {isLoading ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {loadError}
            </Text>
            <Text category="h9" status="link" bold onPress={load}>
              {t('common:try_again', {defaultValue: 'Try again'})}
            </Text>
          </Flex>
        ) : summary ? (
          <>
            <Layout level="2" style={styles.heroCard}>
              <Icon pack="eva" name="gift-outline" style={[globalStyle.icon40, { tintColor: theme['text-basic-color'] }]} />
              <Text category="h5" bold center mt={16}>
                {t('more:referral_hero_title', {defaultValue: 'Give {{reward}}, Get {{reward}}', reward: rewardLabel})}
              </Text>
              <Text category="h9-s" status="placeholder" center mt={8} mb={20}>
                {t('more:referral_hero_description', {
                  defaultValue:
                    'Share your link. When someone you invite subscribes to any paid plan, you both get {{reward}} off your next subscription.',
                  reward: rewardLabel,
                })}
              </Text>
              <View style={styles.codeBox}>
                <Text category="h6" bold center>
                  {summary.code}
                </Text>
              </View>
              <Button style={{ marginTop: 16, width: '100%' }} onPress={onShare}>
                {t('more:referral_share_button', {defaultValue: 'Share My Link'})}
              </Button>
            </Layout>

            <Flex justify="space-between" mt={20} mb={20}>
              <StatBlock label={t('more:referral_stat_invited', {defaultValue: 'Invited'})} value={summary.referredCount} styles={styles} />
              <StatBlock label={t('more:referral_stat_pending', {defaultValue: 'Pending'})} value={summary.pendingCount} styles={styles} />
              <StatBlock label={t('more:referral_stat_rewarded', {defaultValue: 'Rewarded'})} value={summary.rewardedCount} styles={styles} />
            </Flex>

            {summary.creditEarnedCents > 0 ? (
              <Layout level="2" style={styles.creditCard}>
                <Text category="h9" bold status="success">
                  {t('more:referral_credit_earned', {
                    defaultValue: '${{amount}} in credit earned',
                    amount: (summary.creditEarnedCents / 100).toFixed(2),
                  })}
                </Text>
                <Text category="h10" status="placeholder" mt={4}>
                  {t('more:referral_credit_auto_applied', {
                    defaultValue: 'Automatically applied to your next Saveur invoice.',
                  })}
                </Text>
              </Layout>
            ) : null}

            <Text category="h8" bold mt={28} mb={8}>
              {t('more:referral_have_code', {defaultValue: 'Have a code from a friend?'})}
            </Text>
            <Flex justify="flex-start">
              <Input
                placeholder={t('more:referral_code_placeholder', {defaultValue: 'Enter referral code'})}
                value={redeemCode}
                onChangeText={setRedeemCode}
                autoCapitalize="characters"
                style={[styles.redeemInput, globalStyle.flexOne]}
              />
              <Button
                size="small"
                appearance="outline"
                disabled={!redeemCode.trim() || isRedeeming}
                style={{ marginLeft: 8 }}
                onPress={onRedeem}>
                {isRedeeming ? '…' : t('more:referral_apply', {defaultValue: 'Apply'})}
              </Button>
            </Flex>
          </>
        ) : null}
      </Content>
    </Container>
  );
});

function StatBlock({ label, value, styles }: { label: string; value: number; styles: any }) {
  // Same Flex `center` (alignSelf, not alignItems) mixup fixed elsewhere
  // this session (ProLockGate/VerifyEmailGate) — `itemsCenter` is the prop
  // that actually centers these two Text children horizontally.
  return (
    <Flex vertical itemsCenter style={styles.statBlock}>
      <Text category="h5" bold>{value}</Text>
      <Text category="h10" status="placeholder">{label}</Text>
    </Flex>
  );
}

export default ReferralProgram;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  heroCard: {
    ...globalStyle.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  codeBox: {
    ...globalStyle.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'color-primary-500',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  statBlock: {
    flex: 1,
  },
  creditCard: {
    ...globalStyle.card,
    backgroundColor: 'color-success-transparent-200',
    borderRadius: 16,
    padding: 16,
  },
  redeemInput: {
    borderRadius: 12,
  },
});
