import { FormModel } from "constants/Types";
import React from "react";
import { StyleSheet, View } from "react-native";
import CardIcon from "../CardIcon";
import PlaceholderText from "./PlaceholderText";

type Props = {
  model: FormModel;
  cardType?: string;
};

const BackSide: React.FC<Props> = ({ model, cardType }) => {
  return (
    <>
      <View style={styles.black} />
      <View style={styles.tapeContainer}>
        <View style={styles.cvvContainer}>
          <PlaceholderText
            style={styles.cvvText}
            value={model.cvv}
            placeholder={cardType === "american-express" ? "XXXX" : "XXX"}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <CardIcon cardNumber={model.cardNumber} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  black: {
    height: 48,
    width: "100%",
    backgroundColor: "black",
    marginVertical: 24,
  },
  tape: {
    width: "70%",
    height: 28,
  },
  tapeContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
  },
  cvvContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cvvText: {
    backgroundColor: "white",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  footer: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
});

export default BackSide;
