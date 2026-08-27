import React from 'react';
import { Button, ButtonProps, Spinner, Text as KittenText, useTheme } from '@ui-kitten/components';
import { globalStyle } from 'styles/globalStyle';

// Primary call-to-action button (full reskin, product request item —
// "screenshot 3" reference: soft shadows, big rounded cards, colorful pill
// nav). Fully rounded with a soft brand-tinted lift (see styles/
// globalStyle.ts's shadowBtn) — was completely flat for the earlier
// ZipRecruiter-reference direction; that flatness is now replaced by this
// softer look.
//
// COLOR HISTORY: mint-green was tried as an app-wide primary-color rebrand
// (touching constants/theme/color-primary-*, which every icon/badge/link
// in the app also reads from, not just buttons) and reverted per explicit
// follow-up ("i did not ask you to change the color of buttons to green,
// revert back to the blue color they were before" / "dont forget to still
// maintain the default blue color"). Then tried a second time, scoped
// correctly to just submit buttons (literal #32ad84 hardcoded here only,
// not through the shared token) — and reverted again ("change the submit
// buttons back to the default blue"). Blue survives every pass; green
// keeps getting tried and un-done. Back to theme['color-primary-100'],
// same as every screen's own icon/badge/link already reads (both -100 and
// -500 resolve to the same brand blue, #0063f8 — see appTheme.json).
// globalStyle.shadowBtn (this button's own shadow tint) reverted to match.
//
// A thin wrapper around UI Kitten's own Button rather than a fully custom
// component, so every prop that already works on <Button> (accessoryLeft/
// Right, disabled, size, onPress, children, style, ...) keeps working
// completely unchanged at every call site this gets swapped into — only
// the color/shadow actually changes. `status`/`appearance` are
// deliberately NOT accepted here: this component only ever renders the one
// "primary CTA" look by design (that's the whole point of having a
// dedicated component instead of remembering the right style array at
// every call site) — a screen that needs a secondary/outline/danger button
// should keep using the plain UI Kitten <Button status="..."/appearance
// ="outline"/> directly, exactly as today.
//
// NOTE: this file renders the real UI Kitten <Button> internally (NOT
// <CtaButton> itself) — deliberately excluded from the app-wide
// Button-to-CtaButton codemod that converted every other plain <Button>
// call site, since converting THIS particular one would make CtaButton
// render itself recursively forever and crash the app.
export interface CtaButtonProps extends Omit<ButtonProps, 'status' | 'appearance'> {
  loading?: boolean;
}

const renderLoadingSpinner = () => <Spinner size="small" status="basic" />;

const CtaButton: React.FC<CtaButtonProps> = ({ loading, disabled, style, accessoryLeft, children, ...rest }) => {
  const theme = useTheme();
  return (
    <Button
      {...rest}
      disabled={disabled || loading}
      accessoryLeft={loading ? renderLoadingSpinner : accessoryLeft}
      style={[
        {
          // theme['color-primary-100'] and theme['color-primary-500'] are
          // the same value (see appTheme.json) -- either resolves to the
          // brand blue. Kept as -100 (not -500) purely for continuity with
          // every other direct color-primary-100 reference already in the
          // app (see that token's own comment history).
          backgroundColor: theme['color-primary-100'],
          borderColor: theme['color-primary-100'],
          // FULL RESKIN (product request: match a new reference app's
          // look and feel — solid pill-shaped CTA buttons). Was radius 5
          // per an earlier, since-reversed request; explicitly confirmed
          // to keep the established brand blue fill (see this file's own
          // COLOR HISTORY comment above — blue survived this pass too,
          // only the shape changed back to a full pill) rather than the
          // reference's black fill.
          borderRadius: 999,
        },
        globalStyle.shadowBtn,
        style,
      ]}>
      {/* UI Kitten's Button has no textStyle/labelColor prop — the label
          color comes entirely from the theme mapping's resolved eva style
          for the button's status/appearance/state. The library's own
          documented way to override just the label (see button.component.
          js's ButtonStyling doc example) is a render-prop children function
          receiving the already-resolved evaProps (color/fontFamily/
          fontSize/etc.) to spread onto a Text, then override color on top.
          BUG FIX: the comment here used to claim "every existing Button
          call site in this app passes plain children, never a function" —
          false. utils/buttonLabel.tsx's renderCenteredLabel(...) IS a
          render-prop function (`<Button>{renderCenteredLabel(...)}</Button>`
          is its own documented usage), and 6 call sites across the app pass
          it straight into THIS component (ProLockGate.tsx, VerifyEmailGate.
          tsx, ResumeBuilder.tsx, MyDocuments.tsx, ApplicationsTab.tsx,
          CodingInterview.tsx) expecting the same support plain <Button>
          already has. Since this branch always wrapped `children` directly
          in <KittenText>{children}</KittenText> with no function check, a
          function value ended up as literal Text children — the exact
          "Functions are not valid as a React child" crash. Now detects a
          function child and calls it with the same {style} shape
          renderCenteredLabel's own signature expects, merging in this
          button's white/bold styling first so the centered label still
          picks up CtaButton's look instead of losing it. */}
      {evaProps => {
        // BUG FIX (custom fonts not rendering on Android): this used to also
        // set `fontWeight: '700'` here, on top of evaProps.style which
        // already carries the button's mapped fontFamily (mapping.json's
        // Button "filled" appearance -> PlusJakartaSans-Medium). Android's
        // font resolver appends a "_bold" suffix to the family name when it
        // sees a bold-ish weight and looks for a file like
        // "PlusJakartaSans-Medium_bold.ttf" — that file doesn't exist, so it
        // silently fell back to the system font for every CtaButton label on
        // Android (fine on iOS, which matches the family string directly).
        // 'normal' keeps the exact filename lookup intact; the label still
        // reads as bold because PlusJakartaSans-Medium is already a heavier
        // cut than the app's Regular body text.
        const labelStyle = [evaProps?.style, { color: theme['text-primary-color'], fontWeight: 'normal' as const }];
        return typeof children === 'function'
          ? (children as (props: { style?: unknown }) => React.ReactElement)({ style: labelStyle })
          : <KittenText {...evaProps} style={labelStyle}>{children as React.ReactNode}</KittenText>;
      }}
    </Button>
  );
};

export default CtaButton;
