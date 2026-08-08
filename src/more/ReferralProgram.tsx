import React, { memo } from 'react';
import { Alert, Share, TouchableOpacity, View } from 'react-native';
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
            {/* Plain card — gradient fill removed (explicit product
                direction: gradient is reserved for the homescreen XP
                check-in card only). Icons/text now use normal theme colors
                instead of the white/light re-theme the gradient fill used
                to need; the share button keeps its solid brand-blue fill
                since that reads fine on a plain card too. */}
            <Layout level="2" style={[styles.heroCard, styles.heroCardInner]}>
              <Icon pack="eva" name="gift-outline" style={[globalStyle.icon40, { tintColor: theme['color-primary-500'] }]} />
              <Text category="h3" bold center mt={16}>
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
                <Text category="h6" bold center style={{ color: theme['color-primary-500'] }}>
                  {summary.code}
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={styles.heroShareButton}>
                <Text category="h9-s" bold style={styles.heroShareButtonText}>
                  {t('more:referral_share_button', {defaultValue: 'Share My Link'})}
                </Text>
              </TouchableOpacity>
            </Layout>

            <Flex justify="space-between" mt={20} mb={20}>
              <StatBlock label={t('more:referral_stat_invited', {defaultValue: 'Invited'})} value={summary.referredCount} styles={styles} />
              <StatBlock label={t('more:referral_stat_pending', {defaultValue: 'Pending'})} value={summary.pendingCount} styles={styles} />
              <StatBlock label={t('more:referral_stat_rewarded', {defaultValue: 'Rewarded'})} value={summary.rewardedCount} styles={styles} />
            </Flex>

            {summary.creditEarnedCents > 0 ? (
              // Two layers, not one (product bug: "extra white card behind"
              // on Android, fine on iOS) — see HomeSrc.tsx's
              // checkInCardOuter/checkInCardInner for the full explanation
              // of this same Android elevation + translucent-background
              // pattern.
              <View style={styles.creditCardOuter}>
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
              </View>
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
                textStyle={globalStyle.inputText}
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
      <Text category="h3" bold>{value}</Text>
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
  // Plain card (gradient fill removed) — `card` shadow + a `level="2"`
  // background, same shape as every other card on this screen.
  heroCard: {
    ...globalStyle.card,
  },
  heroCardInner: {
    padding: 24,
    alignItems: 'center',
  },
  codeBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'color-primary-500',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    backgroundColor: 'rgba(0,99,248,0.08)',
  },
  heroShareButton: {
    marginTop: 16,
    width: '100%',
    // Product request: solid CTA pills app-wide -> border radius 5.
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // Was a hardcoded '#FFFFFF' fill with blue text — that's the opposite of
    // what the comment above this card says ("share button keeps its solid
    // brand-blue fill") and, more importantly, it's a hardcoded-white
    // background sitting on this card's adaptive `Layout level="2"` surface
    // (same dark-mode bug class as HomeSrc.tsx's checkInCard buttons before
    // their fix): in dark mode the card goes dark navy but this button
    // stayed stuck white. Restored to the solid brand-blue fill the comment
    // already describes, which is correct in both themes since
    // 'color-primary-500' isn't a theme-adaptive surface token — it's the
    // same brand blue in light and dark (see MockInterviewSetup/FindScreen's
    // hero cards for the identical pattern).
    backgroundColor: 'color-primary-500',
  },
  heroShareButtonText: {
    color: '#FFFFFF',
  },
  statBlock: {
    flex: 1,
  },
  // Split in two (product bug: "extra white card behind" on Android) — see
  // the JSX comment above where these are used.
  creditCardOuter: {
    ...globalStyle.card,
    // Redesign v2 (full reskin): `card` carries a real shadow again, so
    // this goes back to needing an opaque fill for Android to compute a
    // correctly-rounded shadow silhouette (see globalStyle.ts's own note
    // calling this file out by name); the inner creditCard's own
    // translucent success-tint still renders on top either way.
    backgroundColor: 'background-basic-color-2',
  },
  creditCard: {
    backgroundColor: 'color-success-transparent-200',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
  },
  redeemInput: {
    ...globalStyle.inputField,
  },
});
