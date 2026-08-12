// ---------------------------------------------------------------------------
// BUG FIX (full-app translation sweep, product report ahead of launch: "There
// are a lot of things in the app thats not being translated"): every rule
// below used to be a plain module-scope const object with a raw English
// `message` string baked in at import time — so no matter what language the
// user had selected, every validation error on Login/Signup/ForgetPassword/
// NewPassword/EditProfile always rendered in English. Same root cause
// authErrors.ts already fixed once for Firebase auth errors; this file had
// the identical anti-pattern for react-hook-form validation messages.
//
// Each export is now a function (call it fresh, e.g. `rules={RulePassword()}`)
// that builds its rule object via i18n.t(...) on every call, so it always
// reflects whatever language is active *at render time*, not whatever was
// active when the app first loaded.
// ---------------------------------------------------------------------------
import i18n from 'i18next';

export function RulePassword() {
  return {
    required: {value: true, message: i18n.t('auth:err_password_required', {defaultValue: 'Password is required'})},
    // Was `[a-zA-Z\d]{8,}` — that character class only ever allowed letters
    // and digits (alphanumeric), so a password with a symbol in it didn't
    // just skip getting "credit" for one, it failed the pattern outright.
    // Now requires a lowercase letter, an uppercase letter, a digit, AND at
    // least one non-alphanumeric, non-whitespace character (the last
    // lookahead), and the overall allowed character set is opened up to
    // include symbols (still no whitespace, via \S).
    pattern: {
      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/,
      message: i18n.t('auth:err_password_pattern', {
        defaultValue:
          'Password must include an uppercase letter, a lowercase letter, a number, and a special character (e.g. ! @ # $ %).',
      }),
    },
    minLength: {
      value: 8,
      message: i18n.t('auth:err_password_length', {defaultValue: 'Password must be at least 8-16 characters.'}),
    },
    maxLength: {
      value: 16,
      message: i18n.t('auth:err_password_length', {defaultValue: 'Password must be at least 8-16 characters.'}),
    },
  };
}

export function RuleName() {
  return {
    // Messages here were already empty strings before this fix (not
    // hardcoded English, just never surfaced) — left as-is, no translation
    // needed for an empty caption.
    require: {value: true, message: ''},
    pattern: {
      value: /^[a-zA-Z]{2,40}( [a-zA-Z]{2,40})+$/,
      message: '',
    },
  };
}

export function RuleConfirmPassword() {
  return {
    required: {
      value: true,
      message: i18n.t('auth:err_confirm_password_mismatch', {defaultValue: 'Confirm Password not correct.'}),
    },
    minLength: {
      value: 8,
      message: i18n.t('auth:err_confirm_password_mismatch', {defaultValue: 'Confirm password not correct'}),
    },
  };
}

export function RuleEmail() {
  return {
    required: {value: true, message: i18n.t('auth:err_email_required', {defaultValue: 'Email is required'})},
    pattern: {
      value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/i,
      message: i18n.t('auth:err_email_pattern', {defaultValue: 'Please enter a valid email address'}),
    },
  };
}

export function RuleResetCode() {
  return {
    required: {value: true, message: i18n.t('auth:err_reset_code_required', {defaultValue: 'Code is required'})},
    maxLength: {
      value: 6,
      message: i18n.t('auth:err_reset_code_length', {defaultValue: 'Code is six digits'}),
    },
    minLength: {
      value: 6,
      message: i18n.t('auth:err_reset_code_length', {defaultValue: 'Code is six digits'}),
    },
  };
}

export function RuleOnlyNumber() {
  return {
    required: {value: true, message: i18n.t('auth:err_value_required', {defaultValue: 'Value is required'})},
    pattern: {
      value: /^[0-9]+$/,
      message: i18n.t('auth:err_value_not_number', {defaultValue: 'Please enter a number'}),
    },
    maxLength: {
      value: 3,
      message: i18n.t('auth:err_value_not_number', {defaultValue: 'Please enter a number'}),
    },
  };
}
