import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { AuthContext } from '../AuthContext';
import * as documentsService from 'services/documentsService';
import * as onboardingAssessmentService from 'services/onboardingAssessmentService';

// "Coach readiness" — product report: "when users login for the first time
// the app dont really tell them what is the first thing they should do ...
// something that is necessary for the users to do in order for the AI career
// coach to give the maximum help". These four inputs are exactly what the
// backend coach (Saveur-Backend app/api/coach.py) builds its context from:
// the uploaded resume text/ATS score, desired roles + preferred countries,
// the career goal, and the Career DNA personality assessment. Shared by the
// Home readiness card and the first-login popup so both always agree on
// what is "done". Mirrors the web app's lib/coachReadiness.ts.

export type ReadinessRoute = 'MyDocuments' | 'JobPreferences' | 'ChangeCareType' | 'CareerAssessment';

export interface ReadinessStep {
  key: 'resume' | 'roles' | 'goal' | 'assessment';
  icon: string;
  label: string;
  why: string;
  route: ReadinessRoute;
  done: boolean;
}

export interface CoachReadiness {
  loading: boolean;
  steps: ReadinessStep[];
  doneCount: number;
  total: number;
  percent: number;
  allDone: boolean;
  /** First incomplete step, i.e. "start here". */
  next: ReadinessStep | null;
}

export default function useCoachReadiness(): CoachReadiness {
  const { t } = useTranslation(['home']);
  const { profile } = React.useContext(AuthContext);
  const hasProfile = !!profile;
  const [hasResume, setHasResume] = React.useState<boolean | undefined>(undefined);
  const [assessmentDone, setAssessmentDone] = React.useState<boolean | undefined>(undefined);

  // Re-checked on every Home focus so finishing a step (which navigates away)
  // is reflected the moment the user comes back.
  useFocusEffect(
    React.useCallback(() => {
      // NOTE: gate on `profile` itself, not `profile.uid` — the mobile profile's
      // `uid` is never populated (the backend sends `id`, authService only maps
      // `uid`), so waiting on it would leave this card stuck loading forever.
      if (!hasProfile) return undefined;
      let cancelled = false;
      documentsService
        .listDocuments()
        .then(docs => !cancelled && setHasResume(docs.some(d => d.kind === 'resume')))
        .catch(() => !cancelled && setHasResume(prev => prev ?? false));
      onboardingAssessmentService
        .getStatus()
        .then(s => !cancelled && setAssessmentDone(s.personalityCompleted))
        .catch(() => !cancelled && setAssessmentDone(prev => prev ?? true)); // fail open: don't nag on a failed check
      return () => {
        cancelled = true;
      };
    }, [hasProfile]),
  );

  return React.useMemo(() => {
    const steps: ReadinessStep[] = [
      {
        key: 'resume',
        icon: 'file-text-outline',
        label: t('home:coach_readiness_resume_label', { defaultValue: 'Upload your resume' }),
        why: t('home:coach_readiness_resume_why', {
          defaultValue: 'Your coach reads it to tailor advice to your real experience and ATS score.',
        }),
        route: 'MyDocuments',
        done: !!hasResume,
      },
      {
        key: 'roles',
        icon: 'briefcase-outline',
        label: t('home:coach_readiness_roles_label', { defaultValue: 'Choose your target roles & countries' }),
        why: t('home:coach_readiness_roles_why', {
          defaultValue: 'Powers job matches, your roadmap and role-specific interview practice.',
        }),
        route: 'JobPreferences',
        done: (profile?.desiredRoles?.length ?? 0) > 0 && (profile?.preferredCountries?.length ?? 0) > 0,
      },
      {
        key: 'goal',
        icon: 'flag-outline',
        label: t('home:coach_readiness_goal_label', { defaultValue: 'Pick your career goal' }),
        why: t('home:coach_readiness_goal_why', {
          defaultValue: 'Shapes your coaching, daily tips and the plan we build for you.',
        }),
        route: 'ChangeCareType',
        done: (profile?.goals?.length ?? 0) > 0,
      },
      {
        key: 'assessment',
        icon: 'activity-outline',
        label: t('home:coach_readiness_assessment_label', { defaultValue: 'Take the career assessment' }),
        why: t('home:coach_readiness_assessment_why', {
          defaultValue: 'Builds your Career DNA so advice fits your strengths and work style.',
        }),
        route: 'CareerAssessment',
        done: !!assessmentDone,
      },
    ];
    const doneCount = steps.filter(s => s.done).length;
    return {
      loading: !profile || hasResume === undefined || assessmentDone === undefined,
      steps,
      doneCount,
      total: steps.length,
      percent: Math.round((doneCount / steps.length) * 100),
      allDone: doneCount === steps.length,
      next: steps.find(s => !s.done) ?? null,
    };
  }, [t, profile, hasResume, assessmentDone]);
}
