import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { ArtMissionPhone } from 'src/home/HomeHeroArt';

// HOME REDESIGN (product reference — a rich "Today's Mission" hero card:
// pill badge, phone+badges illustration, bold title/subtitle, a two-stat
// meta row, a progress bar, and a white pill CTA button). Built as a
// reusable component rather than inline HomeSrc.tsx JSX because the
// product ask was explicit: "use this look and feel throughout the whole
// app" — this is the first screen to use it (see HomeSrc.tsx), but the
// shape (badge/title/subtitle/meta/progress/CTA, all real props, no
// hardcoded copy) is meant to be reused wherever another screen needs the
// same "here's the one thing to do right now" hero treatment.
//
// Deliberately has NO literal "Estimated Time"/"Difficulty" fields like
// the reference screenshot — Saveur's real data (daily challenges, AI
// Career Roadmap steps) doesn't carry either of those, and this app's own
// convention throughout (see e.g. NextLessonHomeCard/DailyChallengeCard's
// own comments) is an honest state over a fabricated one. `metaLeft`/
// `metaRight` are generic icon+label+value slots instead, so each caller
// supplies whatever real stat it actually has (HomeSrc.tsx currently
// passes challenge type + XP reward, or roadmap step count + target role
// — see that file's own comment for the full fallback chain).
export interface MissionHeroCardProps {
  badgeIcon: string; // eva icon pack name
  badgeLabel: string;
  title: string;
  subtitle: string;
  metaLeft: { icon: string; label: string; value: string };
  metaRight: { icon: string; label: string; value: string };
  // Optional -- not every state this card can be in has a real percentage
  // to show (e.g. the generic "ask your coach" fallback state, when
  // there's no daily challenge or roadmap step to report progress on).
  // Omitting both entirely skips the whole progress block rather than
  // rendering a fabricated 0%.
  progressPercent?: number;
  progressLabel?: string;
  ctaLabel: string;
  ctaIcon?: string;
  onPress: () => void;
}

const MissionHeroCard: React.FC<MissionHeroCardProps> = ({
  badgeIcon,
  badgeLabel,
  title,
  subtitle,
  metaLeft,
  metaRight,
  progressPercent,
  progressLabel,
  ctaLabel,
  ctaIcon = 'play-circle-outline',
  onPress,
}) => {
  const styles = useStyleSheet(themedStyles);
  const showProgress = typeof progressPercent === 'number' && !!progressLabel;
  const clampedPercent = Math.max(0, Math.min(100, progressPercent ?? 0));

  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        {/* Badge + illustration sit side by side in normal flow (not
            absolutely positioned) so the illustration can never overlap
            the title/subtitle/meta/progress/CTA below it, regardless of
            how short that content is (e.g. the generic "Ask your AI
            Career Coach" fallback state, whose title/subtitle are much
            shorter than a 2-line daily challenge prompt — the previous
            absolute-positioned art sat on top of the meta row in that
            case, hiding it). */}
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Icon pack="eva" name={badgeIcon} style={{ width: 13, height: 13, tintColor: '#FFFFFF', marginRight: 5 }} />
            <Text category="h10" bold style={styles.badgeText}>
              {badgeLabel}
            </Text>
          </View>
          <ArtMissionPhone size={64} />
        </View>

        <Text category="h6" bold numberOfLines={2} mt={14} style={styles.title}>
          {title}
        </Text>
        <Text category="h9-s" numberOfLines={2} mt={6} style={styles.subtitle}>
          {subtitle}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon pack="eva" name={metaLeft.icon} style={{ width: 15, height: 15, tintColor: 'rgba(255,255,255,0.85)' }} />
            <View style={globalStyle.flexOne}>
              <Text category="h10" style={styles.metaLabel}>
                {metaLeft.label}
              </Text>
              <Text category="h9-s" bold numberOfLines={1} style={styles.metaValue}>
                {metaLeft.value}
              </Text>
            </View>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Icon pack="eva" name={metaRight.icon} style={{ width: 15, height: 15, tintColor: 'rgba(255,255,255,0.85)' }} />
            <View style={globalStyle.flexOne}>
              <Text category="h10" style={styles.metaLabel}>
                {metaRight.label}
              </Text>
              <Text category="h9-s" bold numberOfLines={1} style={styles.metaValue}>
                {metaRight.value}
              </Text>
            </View>
          </View>
        </View>

        {showProgress ? (
          <>
            <View style={styles.progressRow}>
              <Text category="h10" bold style={styles.badgeText}>
                {progressLabel}
              </Text>
              <Text category="h10" bold style={styles.badgeText}>
                {clampedPercent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${clampedPercent}%` }]} />
            </View>
          </>
        ) : null}

        <TouchableOpacity activeOpacity={0.85} style={[styles.cta, !showProgress && styles.ctaNoProgress]} onPress={onPress}>
          <Icon pack="eva" name={ctaIcon} style={{ width: 18, height: 18, tintColor: '#0063f8', marginRight: 8 }} />
          <Text category="h9" bold style={styles.ctaText}>
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MissionHeroCard;

const themedStyles = StyleService.create({
  // Two-layer split (shadow-casting outer / color-clipping inner), same
  // construction GradientCard.tsx established for this app. Dark
  // slate-navy fill (product request: "change the background of the hero
  // card from blue to #272e3b") -- was the flat brand blue, #0052D9.
  outer: {
    ...globalStyle.card,
    marginTop: 16,
    backgroundColor: '#272e3b',
  },
  inner: {
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: '#272e3b',
  },
  // Badge (left) + illustration (right), both in normal flow -- see the
  // JSX's own comment on why the illustration moved out of absolute
  // positioning (it used to sit on top of the meta/progress/CTA content
  // whenever the title/subtitle were short).
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: {
    color: '#FFFFFF',
  },
  title: {
    color: '#FFFFFF',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 14,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.75)',
    marginLeft: 8,
  },
  metaValue: {
    color: '#FFFFFF',
    marginLeft: 8,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 13,
    marginTop: 18,
  },
  // A little extra breathing room above the CTA when the progress block
  // (which normally supplies its own marginTop:18 above the CTA) is
  // skipped entirely -- otherwise the CTA sits right under the meta row.
  ctaNoProgress: {
    marginTop: 20,
  },
  // Submit-button color -- reverted back to the default brand blue along
  // with CtaButton.tsx/globalStyle.shadowBtn ("change the submit buttons
  // back to the default blue"). This CTA is a plain TouchableOpacity, not
  // CtaButton itself (it needs a white pill fill instead of CtaButton's
  // own solid-color fill), so the color is set directly here rather than
  // through that component.
  ctaText: {
    color: '#0063f8',
  },
});
