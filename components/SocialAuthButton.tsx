import React, {memo, useState} from 'react';
import {Image, ImageStyle} from 'react-native';
import {Button, Icon, StyleService, useStyleSheet} from '@ui-kitten/components';
import Text from 'components/Text';

// Product report (Login.tsx + SignupThirdStep.tsx, verbatim): "in the
// signup and login the google and linkedIn buttons should have border,
// they should have google and linkedIn logo instead of those random icons
// used there". Both screens used to render this as inline JSX -- an
// absolutely-positioned generic eva icon (globe-2-outline for Google,
// briefcase-outline for LinkedIn -- neither an actual brand mark) floating
// over a `status="outline"` Button -- duplicated near-identically in both
// files. Pulled into one shared component so both screens render the exact
// same real-logo + bordered treatment instead of two copies of the same
// fix drifting apart later.
//
// BORDER: `status="outline"` alone isn't enough -- this app's own
// mapping.json zeroes `borderWidth` back to 0 for every Button "size"
// variant (large is the default size actually used here), which is what
// silently ate the border regardless of the outline status's own
// `button-outline-border` color. Rather than touch that shared mapping
// (used by every Button in the app, including ones that intentionally want
// a borderless outline look), this adds an explicit local borderWidth/
// borderColor override on just this button's own style -- same "local
// override, don't touch the shared token" approach already used for
// Login/SignupThirdStep's input fields right next to this.
//
// LOGO: no Google/LinkedIn brand asset was bundled anywhere in this app.
// Reuses the exact geticon.dev lookup this session's AddFromEmail.tsx
// connector-card redesign already established for Gmail/Outlook (free, no
// API key, serves the real brand SVG for a known domain) instead of a
// third different logo-fetch mechanism. onError falls back to the
// screen's original generic icon so a network hiccup degrades to
// "some icon" rather than a broken image.
const LOGO_URL: Record<'google' | 'linkedin', string> = {
  google: 'https://geticon.dev/?url=google.com',
  linkedin: 'https://geticon.dev/?url=linkedin.com',
};

const FALLBACK_ICON: Record<'google' | 'linkedin', string> = {
  google: 'globe-2-outline',
  linkedin: 'briefcase-outline',
};

interface SocialAuthButtonProps {
  provider: 'google' | 'linkedin';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}

const SocialAuthButton = memo(({provider, label, disabled, onPress}: SocialAuthButtonProps) => {
  const styles = useStyleSheet(themedStyles);
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <Button
      appearance="outline"
      status="basic"
      style={styles.button}
      disabled={disabled}
      onPress={onPress}
      accessoryLeft={() =>
        logoFailed ? (
          <Icon pack="eva" name={FALLBACK_ICON[provider]} style={styles.icon} />
        ) : (
          <Image
            source={{uri: LOGO_URL[provider]}}
            // StyleService.create's return type is the broad ViewStyle |
            // TextStyle | ImageStyle union, which doesn't narrow to
            // ImageStyle on its own for RN's <Image style> prop -- same cast
            // ActionCard.tsx's iconImage already uses for the identical
            // reason.
            style={styles.icon as ImageStyle}
            resizeMode="contain"
            onError={() => setLogoFailed(true)}
          />
        )
      }
      children={<Text category="h8" bold>{label}</Text>}
    />
  );
});

export default SocialAuthButton;

const themedStyles = StyleService.create({
  button: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'border-card-default',
    borderRadius: 14,
    backgroundColor: 'background-basic-color-2',
    justifyContent: 'center',
  },
  icon: {
    width: 20,
    height: 20,
  },
});
