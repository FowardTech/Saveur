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
      // BUG FIX: this used to only pull `style` out of `props` and threw
      // away everything else UI Kitten's <Icon> forwards here (onPress,
      // hitSlop, testID, accessibilityLabel, disabled, ...) -- Icon.
      // component.js passes through every prop except name/pack/animation/
      // animationConfig (see node_modules/@ui-kitten/components/ui/icon/
      // icon.component.js's `iconProps`), so any call site doing
      // <Icon pack="eva"/"assets" name="..." onPress={...}/> instead of
      // wrapping the Icon in a TouchableOpacity silently lost its tap
      // handler app-wide the moment this pack switched from real SVG eva-
      // icons/raster PNGs (which happened to forward onPress) to Lucide
      // (product bug report: the Job Details header's people/share icons
      // "not working" -- same root cause almost certainly affects every
      // other bare onPress-on-Icon call site across the app, e.g. tab bar
      // icons, Settings rows, etc., not just this one screen). Spreading
      // `...rest` (everything but `style`) onto <LucideComponent> restores
      // that -- lucide-react-native's icons forward unknown props to the
      // underlying react-native-svg <Svg>, which already supports the
      // standard RN touch-responder props (onPress, onPressIn/Out, hitSlop)
      // the same way <Image> and eva-icons' SVGs always did.
      const {style, ...rest} = props || {};
      const flat: Record<string, any> = StyleSheet.flatten(style) || {};
      const {width, height, tintColor, color, ...restStyle} = flat;
      const size = width ?? height ?? 24;
      // Falls back to a plain dark gray rather than pure black when no
      // tintColor/color was set at all (a handful of call sites render the
      // bare default with no style override) -- matches this app's
      // 'text-basic-color' token closely enough without needing theme
      // access inside this generic adapter.
      const iconColor = tintColor ?? color ?? '#1A1A1A';
      return (
        <LucideComponent
          {...rest}
          size={size}
          color={iconColor}
          fill={filled ? iconColor : 'none'}
          strokeWidth={2}
          style={restStyle}
        />
      );
    },
  };
}
