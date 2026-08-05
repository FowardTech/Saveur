import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';

// Local-only weekly targets for the Goals screen (src/more/GoalsScreen.tsx)
// — "3 of 5 practice sessions this week" style progress rows. Deliberately
// plain AsyncStorage rather than a new backend model/endpoint: these are
// personal targets the learner sets for their own glance-value, not
// something the admin dashboard or any other part of the product needs to
// read or enforce.
export interface WeeklyTargets {
  practiceSessions: number;
  applications: number;
}

const DEFAULT_TARGETS: WeeklyTargets = {
  practiceSessions: 3,
  applications: 5,
};

export async function getWeeklyTargets(): Promise<WeeklyTargets> {
  try {
    const raw = await AsyncStorage.getItem(EKeyAsyncStorage.goalsWeeklyTargets);
    if (!raw) return DEFAULT_TARGETS;
    const parsed = JSON.parse(raw);
    return {
      practiceSessions: Number(parsed?.practiceSessions) || DEFAULT_TARGETS.practiceSessions,
      applications: Number(parsed?.applications) || DEFAULT_TARGETS.applications,
    };
  } catch {
    return DEFAULT_TARGETS;
  }
}

export async function setWeeklyTargets(targets: WeeklyTargets): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.goalsWeeklyTargets, JSON.stringify(targets));
}
