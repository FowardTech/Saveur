import CreditCardContext from "../../../CreditCardContext";

import React, { useContext, useEffect, useRef, useState } from "react";
import { TextInput, StyleSheet, View, Animated, Easing } from "react-native";
import Text from "./Text";
import { Input } from "@ui-kitten/components";

type Props = React.ComponentProps<typeof TextInput> & {
  label: string;
  errorText?: string | null;
  endEnhancer?: React.ReactNode;
};

const TextField = React.forwardRef<Input, Props>((props, ref) => {
  const {
    label,
    errorText,
    value,
    endEnhancer,
    style,
    onBlur,
    onFocus,
    ...restOfProps
  } = props;
  const { inputColors = {}, fonts, overrides } = useContext(CreditCardContext);

  const [isFocused, setIsFocused] = useState(false);

  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused || !!value ? 1 : 0,
      duration: 150,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [focusAnim, isFocused, value]);
  return (
    <View style={style}>
      <Input
        label={label}
        style={[styles.input, overrides.input]}
        ref={ref}
        {...restOfProps}
        value={value}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
      />
      {endEnhancer && (
        <View style={styles.enhancerContainer}>{endEnhancer}</View>
      )}
      {!!errorText && (
        <Text style={[styles.error, overrides.errorText]}>{errorText}*</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  input: {
    borderRadius: 4,
    borderBottomWidth: 2,
  },
  labelContainer: {
    position: "absolute",
    paddingHorizontal: 8,
    backgroundColor: "#FFF",
  },
  label: {
    fontSize: 14,
    fontFamily:'GothamPro-Medium'
  },
  enhancerContainer: {
    position: "absolute",
    top: 12,
    right: 16,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: "#FA4169",
    fontFamily:'GothamPro-Medium'
  },
});

export default TextField;
