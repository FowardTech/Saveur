import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// Email-code 2FA — thin wrapper around saveur-backend's
// app/api/two_factor.py. Two distinct "purposes":
//   - "login": gates a fresh sign-in (see AuthContext's twoFactorPending).
//   - "enable": confirms the user really owns their inbox before flipping
//     twoFactorEnabled on from Settings (see src/more/TwoFactorSettings.tsx).
// Both share the same send/verify shape — purpose is just a param.
// ---------------------------------------------------------------------------

export type TwoFactorPurpose = 'login' | 'enable';

export async function getStatus(): Promise<boolean> {
  const {data} = await apiClient.get<{enabled: boolean}>('/api/v1/auth/2fa/status');
  return data.enabled;
}

export async function sendCode(purpose: TwoFactorPurpose = 'login'): Promise<string> {
  const {data} = await apiClient.post<{sent: boolean; email_hint: string}>('/api/v1/auth/2fa/send', {purpose});
  return data.email_hint;
}

export async function verifyCode(code: string, purpose: TwoFactorPurpose = 'login'): Promise<boolean> {
  const {data} = await apiClient.post<{verified: boolean; two_factor_enabled: boolean}>(
    '/api/v1/auth/2fa/verify',
    {code, purpose},
  );
  return data.two_factor_enabled;
}

export async function disable(): Promise<void> {
  await apiClient.post('/api/v1/auth/2fa/disable', {});
}
