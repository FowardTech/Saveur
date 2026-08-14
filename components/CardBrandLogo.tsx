import React from 'react';
import {StyleProp, ViewStyle} from 'react-native';
import Svg, {Circle, Rect, Text as SvgText} from 'react-native-svg';
import {Icon, useTheme} from '@ui-kitten/components';

// Product report (screenshot: a card labeled "Visa" rendering a Mastercard
// mark): PaymentMethod.tsx and PaymentHistory.tsx used to render a single
// hardcoded Mastercard PNG (assets/icons/ic_master.png) for every saved
// card/payment regardless of its real `brand`/`cardBrand` field — the app
// only ever shipped that one brand asset (see PaymentMethod.tsx's old
// comment on iconLogoBank), and PaymentHistory.tsx's `Icon pack="assets"
// name="master"` fallback resolves to a plain tinted Crown glyph (lucide
// dropped brand marks entirely — see assets/AssetIconsPack.tsx's `master`
// registration), which isn't a card logo at all. Neither screen ever looked
// at the actual brand string Stripe already sends back
// (SavedPaymentMethodProps.brand / PaymentHistoryItemProps.cardBrand — see
// constants/Types.tsx, sourced straight from Stripe's PaymentMethod.card.brand,
// e.g. "visa", "mastercard", "amex", "discover", "diners", "jcb", "unionpay",
// or a local-rail brand like "verve").
//
// This renders a real, brand-colored mark per network instead — same
// card-shaped (48x30-ish) footprint every brand's actual logo uses, drawn
// with react-native-svg (already a dependency — see HomeHeroArt.tsx for the
// same pattern) rather than needing a separate raster asset per brand. Only
// falls back to the Crown glyph (this app's existing generic/placeholder
// icon, not a brand mark) when the brand string doesn't match anything
// recognized — e.g. a future network Stripe adds, or `null`/`unknown` —
// exactly the "crown icon should be a fallback" behavior asked for.
export interface CardBrandLogoProps {
  brand?: string | null;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

function normalize(brand?: string | null): string {
  return (brand ?? '').trim().toLowerCase();
}

const VB_W = 48;
const VB_H = 30;

const CardBrandLogo: React.FC<CardBrandLogoProps> = ({brand, width = 44, height = 28, style}) => {
  const theme = useTheme();
  const key = normalize(brand);
  const r = Math.min(VB_W, VB_H) * 0.16;

  switch (key) {
    case 'visa':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#1A1F71" />
          <SvgText
            x={VB_W / 2}
            y={20}
            fontSize={13}
            fontStyle="italic"
            fontWeight="bold"
            fill="#FFFFFF"
            textAnchor="middle">
            VISA
          </SvgText>
        </Svg>
      );

    case 'mastercard':
    case 'master':
      // The universally recognized mark even without a wordmark — two
      // overlapping circles, red left / orange right, on a white card.
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#FFFFFF" stroke="rgba(39,39,85,0.12)" strokeWidth={1} />
          <Circle cx={20} cy={15} r={9} fill="#EB001B" />
          <Circle cx={28} cy={15} r={9} fill="#F79E1B" opacity={0.85} />
        </Svg>
      );

    case 'amex':
    case 'american express':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#006FCF" />
          <SvgText x={VB_W / 2} y={19} fontSize={10} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
            AMEX
          </SvgText>
        </Svg>
      );

    case 'discover':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#1B1B1B" />
          <SvgText x={18} y={19} fontSize={8.5} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
            DISC
          </SvgText>
          <Circle cx={36} cy={22} r={9} fill="#FF6000" />
        </Svg>
      );

    case 'diners':
    case 'diners club':
    case 'dinersclub':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#0079BE" />
          <Circle cx={20} cy={15} r={8} fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
          <Circle cx={28} cy={15} r={8} fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
        </Svg>
      );

    case 'jcb':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#FFFFFF" stroke="rgba(39,39,85,0.12)" strokeWidth={1} />
          <Rect x={4} y={6} width={12} height={18} rx={3} fill="#0E4C96" />
          <Rect x={18} y={6} width={12} height={18} rx={3} fill="#E30138" />
          <Rect x={32} y={6} width={12} height={18} rx={3} fill="#00944E" />
          <SvgText x={VB_W / 2} y={19} fontSize={8} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
            JCB
          </SvgText>
        </Svg>
      );

    case 'unionpay':
    case 'union pay':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#FFFFFF" stroke="rgba(39,39,85,0.12)" strokeWidth={1} />
          <Rect x={4} y={6} width={13} height={18} rx={3} fill="#E21836" />
          <Rect x={17.5} y={6} width={13} height={18} rx={3} fill="#00447C" />
          <Rect x={31} y={6} width={13} height={18} rx={3} fill="#007B84" />
        </Svg>
      );

    case 'verve':
      return (
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={style}>
          <Rect width={VB_W} height={VB_H} rx={r} fill="#00A651" />
          <SvgText
            x={VB_W / 2}
            y={19}
            fontSize={10}
            fontStyle="italic"
            fontWeight="bold"
            fill="#FFFFFF"
            textAnchor="middle">
            VERVE
          </SvgText>
        </Svg>
      );

    default:
      // Unrecognized/unknown brand — the app's existing generic placeholder
      // glyph, tinted like every other themed icon, instead of guessing.
      return (
        <Icon
          // "premiumAcc" (not "master") on purpose — both keys resolve to
          // the same Crown glyph in AssetIconsPack.tsx, but "master" reads
          // confusingly like "mastercard" right next to brand-matching code
          // whose whole point is to stop defaulting to Mastercard's logo.
          pack="assets"
          name="premiumAcc"
          style={[{width, height: width, tintColor: theme['text-hint-color']}, style]}
        />
      );
  }
};

export default CardBrandLogo;
