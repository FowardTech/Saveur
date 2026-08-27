import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';

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
  const theme = useTheme();
  const showProgress = typeof progressPercent === 'number' && !!progressLabel;
  const clampedPercent = Math.max(0, Math.min(100, progressPercent ?? 0));

  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        {/* COLOR HISTORY: flat blue -> linear gradient -> product follow-up
            ("remove only the linear gradient of the hero card. give the
            card a box shadow and a border and the text inside the card
            should be black"): no colored/gradient fill at all now -- see
            `outer`/`inner`'s own style comments for the plain white
            box-shadow-plus-border card this becomes, same as every other
            card on Home. The "Today's Mission" badge pill and the Start
            Task button's icon/label are explicitly left untouched per
            that same request (only the button's own background changes --
            see the button's own comment below), even though the badge's
            translucent-white fill was originally tuned for a dark/colored
            card background. */}
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
          {/* Product report: "reduce the height of the hero card" (asked
              twice) -- 64 -> 48 -> 42, shrinking topRow's own height (the
              tallest single element in this card) without cropping the
              art. */}
          <ArtMissionPhone size={42} />
        </View>

        <Text category="h6" bold numberOfLines={2} mt={6} style={styles.title}>
          {title}
        </Text>
        <Text category="h9-s" numberOfLines={2} mt={3} style={styles.subtitle}>
          {subtitle}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon pack="eva" name={metaLeft.icon} style={{ width: 15, height: 15, tintColor: theme['text-hint-color'] }} />
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
            <Icon pack="eva" name={metaRight.icon} style={{ width: 15, height: 15, tintColor: theme['text-hint-color'] }} />
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
              <Text category="h10" bold style={styles.progressText}>
                {progressLabel}
              </Text>
              <Text category="h10" bold style={styles.progressText}>
                {clampedPercent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${clampedPercent}%` }]} />
            </View>
          </>
        ) : null}

        {/* Product report: "just change the background of the button to
            the default blue" -- was a white pill with blue icon/label
            (readable against the old blue/gradient card fill). Now filled
            with theme['color-primary-100'] (this app's own "default
            blue", same token CtaButton.tsx reads), so the icon/label flip
            to white to stay legible against it -- the one necessary
            consequence of actually changing this button's own background,
            not a separate untouched-per-request change. */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.cta, !showProgress && styles.ctaNoProgress, { backgroundColor: theme['color-primary-100'] }]}
          onPress={onPress}>
          <Icon pack="eva" name={ctaIcon} style={{ width: 18, height: 18, tintColor: '#FFFFFF', marginRight: 8 }} />
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
  // Two-layer split (shadow-casting outer / padding+content inner), same
  // construction GradientCard.tsx established for this app.
  // COLOR HISTORY: flat blue -> linear gradient -> product follow-up
  // ("remove only the linear gradient of the hero card. give the card a
  // box shadow and a border") -- globalStyle.cardBorder added alongside
  // globalStyle.card's own shadow (same combo CareerRoadmap.tsx's
  // statsCard uses), backgroundColor now the plain card fill every other
  // Home card uses instead of a color/gradient.
  // Product report: "move the hero card up a little bit" -- marginTop
  // 16 -> 6, tightening the gap to whatever renders above it on Home
  // (the For You pill row).
  outer: {
    ...globalStyle.card,
    ...globalStyle.cardBorder,
    marginTop: 6,
    backgroundColor: 'background-basic-color-2',
  },
  // Product report: "reduce the height of the hero card" (asked twice --
  // padding 18 -> 14 -> 12).
  inner: {
    borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
    backgroundColor: 'background-basic-color-2',
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
  // NOT touched per explicit request ("dont touch the today's mission
  // pill") -- still white, tuned for the old dark/colored card fill.
  badgeText: {
    color: '#FFFFFF',
  },
  // Product report: "the text inside the card should be black" -- was
  // white (tuned for the old blue/gradient fill).
  title: {
    color: 'text-basic-color',
  },
  subtitle: {
    color: 'text-hint-color',
  },
  // Product report: "reduce the height of the hero card" (asked twice) --
  // marginTop 18 -> 10 -> 8.
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Product report: "the text inside the card should be black" -- this
  // divider/label/value trio was tuned for the old blue/gradient fill
  // (translucent white); same hairline-gray/text-hint/text-basic set
  // every other card's meta content in this app already uses.
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginHorizontal: 14,
  },
  metaLabel: {
    color: 'text-hint-color',
    marginLeft: 8,
  },
  metaValue: {
    color: 'text-basic-color',
    marginLeft: 8,
    marginTop: 2,
  },
  // Product report: "reduce the height of the hero card" (asked twice) --
  // marginTop 18 -> 10 -> 8.
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  // Product report: "the text inside the card should be black" -- new
  // style split off from badgeText (which stays white, untouched, for
  // the pill), since progressRow's own label/percentage text was
  // previously sharing that same white style.
  progressText: {
    color: 'text-basic-color',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'color-primary-100',
  },
  // Product report: "reduce the height of the hero card" (asked twice) --
  // paddingVertical 13 -> 10 -> 9, marginTop 18 -> 10 -> 8.
  // backgroundColor is now set inline at the render call site (product
  // report: "just change the background of the button to the default
  // blue") -- was a hardcoded white pill here.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 9,
    marginTop: 8,
  },
  // A little extra breathing room above the CTA when the progress block
  // (which normally supplies its own marginTop above the CTA) is skipped
  // entirely -- otherwise the CTA sits right under the meta row.
  ctaNoProgress: {
    marginTop: 12,
  },
  // Product report: "just change the background of the button to the
  // default blue" -- with the button now filled blue (see the render
  // call site), the label flips from blue to white to stay legible.
  ctaText: {
    color: '#FFFFFF',
  },
});
