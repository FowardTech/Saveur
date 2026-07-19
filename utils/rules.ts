export const RulePassword = {
  required: {value: true, message: 'Password is required'},
  pattern: {
    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,
    message:
      'Password must be at least one uppercase letter,one lowercase letter, and a number.',
  },
  minLength: {
    value: 8,
    message: 'Password must be at least 8-16 characters.',
  },
  maxLength: {
    value: 16,
    message: 'Password must be at least 8-16 characters.',
  },
};
export const RuleName = {
  require: {value: true, message: ''},
  pattern: {
    value: /^[a-zA-Z]{2,40}( [a-zA-Z]{2,40})+$/,
    message: '',
  },
};
export const RuleConfirmPassword = {
  required: {value: true, message: 'Confirm Password not correct.'},
  minLength: {
    value: 8,
    message: 'Confirm password not correct',
  },
};
export const RuleEmail = {
  required: {value: true, message: 'Email is required'},
  pattern: {
    value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/i,
    message: 'Please enter a valid email address',
  },
};
export const RuleResetCode = {
  required: {value: true, message: 'Code is required'},
  maxLength: {
    value: 6,
    message: 'Code is six digits',
  },
  minLength: {
    value: 6,
    message: 'Code is six digits',
  },
};
export const RuleOnlyNumber = {
  required: {value: true, message: 'Value is required'},
  pattern: {
    value: /^[0-9]+$/,
    message: 'Please enter a number',
  },
  maxLength: {
    value: 3,
    message: 'Please enter a number',
  },
};
