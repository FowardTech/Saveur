import React, { memo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import { globalStyle } from 'styles/globalStyle';
import { CareerEventProps } from 'constants/Types';

// Home screen's compact preview of the Career Fairs & Events already shown
// in full on Networking Assistant (src/more/NetworkingAssistant.tsx) —
// product request: "targeted career fairs and events card to display under
// the continue & Upcoming cards. They should be horizontally scrollable too
// like the continue and upcoming cards." Same single-row, icon-left/
// text-right white-card shape as ContinueLearningCard.tsx (this file's own
// `card` style is copied from there verbatim) so it visually reads as one
// family of cards with the row above it — just swapping the icon badge for
// a real per-platform logo (product follow-up: "The logo of the platform
// where the event was gotten from should be on the individual cards too" —
// see CareerEventProps.logoUrl, computed backend-side from
// CareerEvent.source through the same geticon.dev lookup Job Alerts/Dream
// Companies already use for employer logos; CompanyLogoAvatar already
// handles a missing/404ing logo with a clean icon fallback, no broken-image
// risk here).
//
// Purely presentational (unlike ContinueLearningCard/UpcomingSessionHomeCard,
// which each fetch their own data) — HomeSrc.tsx owns the fetch/list/cap-
// to-4 logic (same "HomeSrc fetches list data directly" convention its other
// sections already follow, e.g. the roadmap fetch) and just maps this
// component over the result.
const CareerFairEventCard = memo(({ event, style, onPress }: {
  event: CareerEventProps;
  style?: StyleProp<ViewStyle>;
  onPress: (event: CareerEventProps) => void;
}) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const subtitle = [event.organizer, event.location || event.matchedCountry].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity activeOpacity={0.8} style={[styles.card, style]} onPress={() => onPress(event)}>
      <CompanyLogoAvatar
        logoUrl={event.logoUrl}
        companyName={event.organizer || event.title}
        size="small"
        fallbackIcon="building-outline"
        style={styles.logoWrap}
      />
      <View style={globalStyle.flexOne}>
        <Text category="h10" bold numberOfLines={1}>
          {event.title}
        </Text>
        <Text category="h10" status="placeholder" numberOfLines={1} mt={1}>
          {subtitle || event.matchedRole}
        </Text>
      </View>
      <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
    </TouchableOpacity>
  );
});

export default CareerFairEventCard;

const themedStyles = StyleService.create({
  // Copied verbatim from ContinueLearningCard.tsx's own `card` style — see
  // that file's comment history for the full "very small info card, white
  // fill, hairline border, no shadow" reasoning this matches.
  // FULL RESKIN: stopped cancelling out globalStyle.card's own shadow —
  // see ContinueLearningCard.tsx's own comment on this exact same change.
  // Product request: "reduce the box shadow on the For You cards" (this
  // card only ever appears inside HomeSrc.tsx's "For You" row) — same
  // lighter override HomeSrc.tsx's own forYouTile style applies, scoped
  // here rather than touching the shared globalStyle.card token.
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-2',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  logoWrap: {
    marginRight: 10,
  },
});
