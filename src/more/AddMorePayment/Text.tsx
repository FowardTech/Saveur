import CreditCardContext from "../../../CreditCardContext";
import React, { useContext } from "react";
import { Text as GlobalText } from "react-native";

type Props = React.ComponentProps<typeof GlobalText> & {
  bold?: boolean;
};

const Text: React.FC<Props> = (props) => {
  const { bold, style, ...restOfProps } = props;
  const { fonts } = useContext(CreditCardContext);

  return <GlobalText style={[style]} {...restOfProps} />;
};

export default Text;
