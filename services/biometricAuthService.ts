import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';

// ---------------------------------------------------------------------------
// Biometric app-lock (Face ID / Touch ID / Android fingerprint). This is a
// LOCAL device gate, not a Firebase auth method — Firebase has no biometric
// provider, and there's nothing to authenticate against a server here.
// Firebase's own native session persistence already keeps the user signed
// in across app restarts (see AuthContext.tsx); enabling this just adds a
// device-level "prove it's still you" prompt in front of that already-valid
// session on cold start, the same way a banking app's Face ID lock works.
//
// Setting is device-wide (not per-account) — a single AsyncStorage boolean,
// checked by navigation/AppContainer.tsx alongside the 2FA gate.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'biometricLockEnabled';

const rnBiometrics = new ReactNativeBiometrics({allowDeviceCredentials: true});

export interface BiometricAvailability {
  available: boolean;
  // Human-readable label for whatever the device actually has ("Face ID",
  // "Touch ID", "Fingerprint", or "Biometrics" as a generic fallback) — used
  // to phrase the Settings toggle/prompt without hardcoding "Face ID" on a
  // device that only has a fingerprint sensor.
  label: string;
}

export async function checkAvailability(): Promise<BiometricAvailability> {
  try {
    const {available, biometryType} = await rnBiometrics.isSensorAvailable();
    const label =
      biometryType === BiometryTypes.FaceID
        ? 'Face ID'
        : biometryType === BiometryTypes.TouchID
        ? 'Touch ID'
        : biometryType === BiometryTypes.Biometrics
        ? 'Fingerprint'
        : 'Biometrics';
    return {available: !!available, label};
  } catch {
    return {available: false, label: 'Biometrics'};
  }
}

export async function prompt(promptMessage: string): Promise<boolean> {
  try {
    const {success} = await rnBiometrics.simplePrompt({promptMessage});
    return success;
  } catch {
    // User cancelled, or the sensor errored — either way, treat as "not
    // unlocked" rather than throwing, so callers can just branch on the
    // boolean instead of also needing a try/catch.
    return false;
  }
}

export async function isEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}
