import React from 'react';
import {StyleSheet} from 'react-native';
import type {IconProvider} from '@ui-kitten/components';

// Shared adapter: turns any lucide-react-native icon component into a UI
// Kitten IconProvider, so <Icon pack="..." name="..." style={...}/> call
// sites throughout the app don't need to change at all -- only the two
// pack registrations (AssetIconsPack.tsx, LucideEvaIconsPack.tsx) know
// these are now Lucide icons under the hood, per explicit product
// direction: "I want you to use the icon style you used in the admin
// dashboard (lucide-react) in this mobile app... including the tabs and
// settings."
//
// UI Kitten calls toReactElement(props) with whatever `style` the call site
// passed (an object or an array like [globalStyle.icon20, {tintColor:
// theme[...], marginLeft: 8}]) -- Image (the old raster-icon renderer) just
// forwarded that whole style object straight through, since RN's Image
// understands width/height/tintColor/margin all as plain style props.
// lucide-react-native's icons are SVGs, not Images -- react-native-svg reads
// stroke color via a `color` prop and dimensions via a `size` prop, not
// `tintColor`/width/height in a style object, so those two need pulling out
// and passed as real props; everything else in the style (margins, absolute
// positioning, etc.) still gets forwarded as `style` so existing layouts
// don't shift.
export function lucideIcon(
  LucideComponent: React.ComponentType<{
    size?: number;
    color?: string;
    fill?: string;
    strokeWidth?: number;
    style?: any;
  }>,
  // Renders the icon solid (fill = same as the stroke color) instead of
  // outline-only. Used for this pack's "...Active" keys (homeActive,
  // searchActive, commentActive, bookmarkActive, moreActive, etc.), which
  // used to be a visually distinct FILLED png swapped in for the bottom tab
  // bar's active tab (see MainBottomTab.tsx's ButtonTab) -- Lucide has one
  // stroke-based icon per name rather than a separate filled variant, so
  // `filled` is how that same "active = solid, inactive = outline" contrast
  // is preserved rather than collapsing to a color-only difference.
  filled: boolean = false,
): IconProvider<any> {
  return {
    toReactElement: (props: any) => {
      const flat: Record<string, any> = StyleSheet.flatten(props?.style) || {};
      const {width, height, tintColor, color, ...rest} = flat;
      const size = width ?? height ?? 24;
      // Falls back to a plain dark gray rather than pure black when no
      // tintColor/color was set at all (a handful of call sites render the
      // bare default with no style override) -- matches this app's
      // 'text-basic-color' token closely enough without needing theme
      // access inside this generic adapter.
      const iconColor = tintColor ?? color ?? '#1A1A1A';
      return (
        <LucideComponent
          size={size}
          color={iconColor}
          fill={filled ? iconColor : 'none'}
          strokeWidth={2}
          style={rest}
        />
      );
    },
  };
}
