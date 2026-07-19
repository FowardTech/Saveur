import { LibraryProps, Overrides } from "constants/Types";
import { createContext } from "react";

export type ContextProps = LibraryProps & {
  overrides: Overrides;
};

const CreditCardContext = createContext<ContextProps>({
  LottieView: undefined,
  // iOS only
  horizontalStart: true,
  overrides: {},
  requiresName: true,
  inputColors: {},
});

export default CreditCardContext;
