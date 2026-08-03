import {AppearanceParams} from '@stripe/stripe-react-native';

// Shared appearance config for every initPaymentSheet() call in the app
// (Subscription.tsx's subscribe flow, PaymentMethod.tsx's add-card flow) —
// previously neither call passed an `appearance` at all, so both used
// Stripe's plain default sheet styling, unbranded and visually disconnected
// from the rest of the app. Uses the Stripe React Native SDK's own
// `appearance` param (a first-class part of initPaymentSheet — no separate
// "custom checkout" build needed, and unlike hand-rolling raw CardField UI,
// this keeps Stripe's own PCI-compliant, accessible native sheet, just
// reskinned to match Saveur's brand color (#047857 — same blue as
// button-basic-color/color-primary-500, see utils/chartConfig.ts's
// `rgba(37, 116, 255, 1)`) and rounded-corner visual language used
// throughout the rest of the app (16/20/24px radii on cards, 24-28px on
// buttons — see e.g. src/more/Subscription.tsx's planCard style).
export const stripeAppearance: AppearanceParams = {
  colors: {
    light: {
      primary: '#047857',
      background: '#FFFFFF',
      componentBackground: '#F4F6FA',
      componentBorder: '#E4E9F2',
      componentDivider: '#E4E9F2',
      primaryText: '#181B22',
      secondaryText: '#8F9BB3',
      componentText: '#181B22',
      placeholderText: '#8F9BB3',
      icon: '#047857',
      error: '#FF4D4D',
    },
    dark: {
      primary: '#047857',
      background: '#1A1F2B',
      componentBackground: '#242A38',
      componentBorder: '#323A4B',
      componentDivider: '#323A4B',
      primaryText: '#FFFFFF',
      secondaryText: '#8F9BB3',
      componentText: '#FFFFFF',
      placeholderText: '#8F9BB3',
      icon: '#047857',
      error: '#FF6B6B',
    },
  },
  shapes: {
    borderRadius: 16,
    borderWidth: 1,
  },
  primaryButton: {
    colors: {
      light: {background: '#047857', text: '#FFFFFF'},
      dark: {background: '#047857', text: '#FFFFFF'},
    },
    shapes: {
      borderRadius: 24,
    },
  },
};
