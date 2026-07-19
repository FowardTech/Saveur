import React from "react";
import { Keyboard } from "react-native";

const useKeyboard = () => {
  const [keyboardShow, setKeyboardShow] = React.useState<boolean>(false);
  React.useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardShow(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardShow(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [Keyboard, keyboardShow]);
  return { keyboardShow };
};

export default useKeyboard;
