import React from "react";
import { View } from "react-native";

import Text from "components/Text";
import { useStyleSheet, StyleService } from "@ui-kitten/components";
import Flex from "components/Flex";
interface ProfileTagProps {
  label: string;
  title: string;
  secureTextEntry?: boolean;
}

const ProfileTag = ({ label, title, secureTextEntry }: ProfileTagProps) => {
  const styles = useStyleSheet(themedStyles);
  let array = [...title.split("")];
  return (
    <View style={styles.container}>
      <Text category="h8" status={"placeholder"} mb={12}>
        {label}
      </Text>
      {secureTextEntry ? (
        <Flex justify="flex-start">
          {array.map((item, i) => {
            return <View style={styles.dot} key={i} />;
          })}
        </Flex>
      ) : (
        <Text category="h6" bold>{title}</Text>
      )}
    </View>
  );
};

export default ProfileTag;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 32,
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: "text-basic-color",
    marginHorizontal: 2,
    borderRadius: 99,
  },
});
