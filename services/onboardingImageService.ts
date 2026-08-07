import i18n from 'i18next';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// onboardingImageService — GET /api/v1/content/onboarding-image/<key>
// (saveur-backend's app/api/content.py), backing the admin-uploadable,
// per-language onboarding illustrations (product request: "we need to also
// create the upload option for uploading for the remaining 11 languages
// just like you did for Home banner... so that admin can upload all these
// for the 12 languages too. So that admin can upload all these for the 12
// languages too. So when users switch to their preferred language they see
// the... onboarding content in that specific language").
//
// Both src/more/JobAlertsOnboarding.tsx and
// src/more/LearningCoursesOnboarding.tsx used to always render a single
// bundled local image asset (assets/images/img_job_alerts_onboarding.png /
// img_learning_onboarding.png) with marketing text baked into the pixels —
// no way to localize it without a new app release. This resolves an
// admin-uploaded override for the current app language if one exists;
// returns null if the admin hasn't uploaded anything for this key/locale
// yet, so both screens can fall back to their bundled asset exactly like
// before this existed — safe to call with zero admin setup.
// ---------------------------------------------------------------------------

export type OnboardingImageKey = 'job_alerts' | 'learning_courses';

interface OnboardingImageWire {
  image_url?: string | null;
}

export async function getOnboardingImage(key: OnboardingImageKey): Promise<string | null> {
  try {
    const {data} = await apiClient.get<OnboardingImageWire>(
      `/api/v1/content/onboarding-image/${key}`,
      {params: {language: i18n.language || 'en'}},
    );
    return data.image_url || null;
  } catch {
    // Network hiccup or nothing configured — both call sites already have a
    // bundled local asset to fall back to, so this fails silently rather
    // than blocking the onboarding screen from rendering at all.
    return null;
  }
}
