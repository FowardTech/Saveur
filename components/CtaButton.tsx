import React from 'react';
import {Button, ButtonProps, Spinner, Text as KittenText, useTheme} from '@ui-kitten/components';

// Primary call-to-action button (product request item — explicit
// ZipRecruiter reference for the overall redesign: bordered cards, no box
// shadows, clean layout). Fully rounded, completely flat (no shadow/
// elevation — see styles/globalStyle.ts's shadowBtn, now an intentional
// no-op) but keeps Saveur's own established brand blue fill + white text —
// an earlier pass tried a mint-green fill to mirror the reference's
// "Quick Apply" color too, but that was reverted per explicit follow-up
// ("i did not ask you to change the color of buttons to green, revert
// back to the blue color they were before"). Since every primary button
// app-wide now renders through this one component, this file is the
// single place that color lives — no other file needed touching to
// revert it.
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

const CtaButton: React.FC<CtaButtonProps> = ({loading, disabled, style, accessoryLeft, children, ...rest}) => {
  const theme = useTheme();
  return (
    <Button
      {...rest}
      disabled={disabled || loading}
      accessoryLeft={loading ? renderLoadingSpinner : accessoryLeft}
      style={[
        {
          // Saveur's established brand blue (matches the shadowColor the
          // old globalStyle.shadowBtn used to glow with, #2574FF -- same
          // blue, just without the glow now) -- NOT theme['color-primary-
          // 500'], which resolves to Eva's own default blue (#3366FF) and
          // would be a subtly different shade than what buttons actually
          // looked like before this whole redesign pass started.
          backgroundColor: theme['color-primary-100'],
          borderColor: theme['color-primary-100'],
          borderRadius: 14,
        },
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
        const labelStyle = [evaProps?.style, {color: theme['text-primary-color'], fontWeight: '700' as const}];
        return typeof children === 'function'
          ? (children as (props: {style?: unknown}) => React.ReactElement)({style: labelStyle})
          : <KittenText {...evaProps} style={labelStyle}>{children as React.ReactNode}</KittenText>;
      }}
    </Button>
  );
};

export default CtaButton;
