import {useTheme} from '@ui-kitten/components';
import React, {memo} from 'react';
import {TouchableOpacity, ViewProps} from 'react-native';

export interface FlexProps extends ViewProps {
  vertical?: boolean;
  padder?: boolean;
  mt?: number;
  mb?: number;
  mh?: number;
  mv?: number;
  ml?: number;
  mr?: number;
  ph?: number;
  pv?: number;
  pb?: number;
  border?: number;
  margin?: number;
  center?: boolean;
  itemsCenter?: boolean;
  wrap?: boolean;
  onPress?(): void;
  level?: '1' | '2' | '3' | '4' | '5' | '6';
  justify?:
    | 'center'
    | 'space-between'
    | 'flex-start'
    | 'flex-end'
    | 'space-around'
    | 'space-evenly'
    | undefined;
}

const Flex: React.FC<FlexProps> = memo(
  ({
    style,
    padder,
    children,
    mt,
    mb,
    mh,
    mv,
    ml,
    mr,
    ph,
    pv,
    pb,
    margin,
    itemsCenter,
    wrap,
    center,
    vertical,
    level,
    justify = 'space-between',
    onPress,
    border,
    ...props
  }) => {
    const theme = useTheme();
    return (
      <>
        <TouchableOpacity
          disabled={!onPress}
          activeOpacity={!onPress ? 1 : 0.54}
          onPress={onPress}
          style={[
            {
              borderRadius: border,
              alignItems: itemsCenter ? 'center' : undefined,
              // Only force paddingHorizontal when `padder`/`ph` is
              // explicitly requested. Leaving it undefined otherwise (instead
              // of 0) means it no longer silently overrides a `padding`
              // shorthand passed in via `style` — paddingHorizontal takes
              // precedence over `padding` in RN's layout engine regardless of
              // style-array order, so hardcoding it to 0 here was clobbering
              // left/right padding on every card that relied on
              // `style={{padding: X}}` instead of the `padder`/`ph` props
              // (this is why several cards had text flush against the
              // edges — the "padding" cards were rendering fine vertically
              // but with the sides silently zeroed out).
              paddingHorizontal: ph ?? (padder ? 24 : undefined),
              paddingBottom: pb,
              flexDirection: vertical ? 'column' : 'row',
              justifyContent: justify,
              marginTop: mt,
              marginBottom: mb,
              marginLeft: ml,
              marginRight: mr,
              marginHorizontal: mh,
              marginVertical: mv,
              alignSelf: center ? 'center' : undefined,
              flexWrap: wrap ? 'wrap' : undefined,
              margin: margin,
              paddingVertical: pv,
              backgroundColor: level
                ? theme[`background-basic-color-${level}`]
                : 'transparent',
            },
            style,
          ]}
          {...props}>
          {children}
        </TouchableOpacity>
      </>
    );
  },
);

export default Flex;
