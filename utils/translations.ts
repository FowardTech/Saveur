import { Translations, TranslationsNonNull } from "constants/Types";

export const getTranslations = (
  translations: Translations = {}
): TranslationsNonNull => {
  return {
    cardNumber: "Card Number",
    cardHolderName: "CARD HOLDER",
    nameSurname: "Name Surname",
    mmYY: "MM/YY",
    expiration: "EXP DATE",
    securityCode: "Security Code",
    next: "Save",
    done: "Done",
    cardNumberRequired: "Card number is required.",
    cardNumberInvalid: "This card number looks invalid.",
    cardHolderNameRequired: "Cardholder name is required.",
    cardHolderNameInvalid: "This cardholder name looks invalid.",
    expirationRequired: "Expiration date is required.",
    expirationInvalid: "This expiration date looks invalid.",
    securityCodeRequired: "Security code is required.",
    securityCodeInvalid: "This security date looks invalid.",
    ...translations,
  };
};
