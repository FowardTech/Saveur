import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Icon} from '@ui-kitten/components';
import {NavigationProp, useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen} from './Scaffold';

// Entry point for the "after you land the job" features.
const LifetimeHub = () => {
  const {t} = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<any>>();
  const [o, setO] = React.useState<svc.Overview | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      svc.getOverview().then(setO).catch(() => {});
    }, []),
  );

  const cards: {route: string; title: string; body: string; icon: string; color: string; badge?: string}[] = [
    {
      route: 'WeeklyCheckin',
      icon: 'checkmark-circle-2',
      color: '#7C5CFF',
      title: t('more:lt_weekly_title', {defaultValue: 'Weekly Check-in'}),
      body: o?.weekly_next_step ?? t('more:lt_weekly_card', {defaultValue: 'Review your week and get one concrete next step.'}),
      badge: o && !o.weekly_checkin_done ? t('more:lt_badge_due', {defaultValue: 'Due'}) : undefined,
    },
    {
      route: 'BragDocument',
      icon: 'award-outline',
      color: '#19B87A',
      title: t('more:lt_brag_title', {defaultValue: 'Brag Document'}),
      body: t('more:lt_brag_card', {defaultValue: 'Turn diary entries into promotion-ready achievements.'}),
      badge: o?.brag_count ? String(o.brag_count) : undefined,
    },
    {
      route: 'ReviewPrep',
      icon: 'file-text-outline',
      color: '#FF8A3D',
      title: t('more:lt_review_title', {defaultValue: 'Review & Promotion Prep'}),
      body: t('more:lt_review_card', {defaultValue: 'Self-review draft, evidence and a manager rehearsal.'}),
    },
    {
      route: 'PayWatch',
      icon: 'trending-up-outline',
      color: '#2F6BFF',
      title: t('more:lt_pay_title', {defaultValue: 'Pay & Market Alerts'}),
      body: t('more:lt_pay_card', {defaultValue: 'A yearly benchmark and a nudge when pay falls behind.'}),
      badge: o?.pay_behind ? t('more:lt_badge_behind', {defaultValue: 'Behind'}) : undefined,
    },
    {
      route: 'MarketWatch',
      icon: 'globe-outline',
      color: '#00A6D6',
      title: t('more:lt_market_title', {defaultValue: 'Job-market Watch'}),
      body: t('more:lt_market_card', {defaultValue: 'A quiet monthly list of roles that could be a step up.'}),
    },
    {
      route: 'LeadershipTrack',
      icon: 'people-outline',
      color: '#FF5FA2',
      title: t('more:lt_leadership_title', {defaultValue: 'Leadership Track'}),
      body: t('more:lt_leadership_card', {defaultValue: '1:1 prep, feedback scripts and difficult conversations.'}),
    },
    {
      route: 'SkillsPlan',
      icon: 'book-open-outline',
      color: '#F5B000',
      title: t('more:lt_skills_title', {defaultValue: 'Skills & Certifications'}),
      body: t('more:lt_skills_card', {defaultValue: 'A roadmap to your next role, with reminders.'}),
      badge: o?.skill_milestones_open ? String(o.skill_milestones_open) : undefined,
    },
    {
      route: 'CareerTimeline',
      icon: 'clock-outline',
      color: '#EF5350',
      title: t('more:lt_timeline_title', {defaultValue: 'Career Timeline'}),
      body: t('more:lt_timeline_card', {defaultValue: 'Your wins, raises, roles and certificates in one place.'}),
      badge: o?.timeline_count ? String(o.timeline_count) : undefined,
    },
  ];

  return (
    <LifetimeScreen title={t('more:lt_hub_title', {defaultValue: 'Career for Life'})}>
      <Text category="h9-s" status="placeholder" mb={14}>
        {t('more:lt_hub_intro', {defaultValue: 'Tools for every stage, long after you land the job.'})}
      </Text>
      {cards.map(c => (
        <TouchableOpacity
          key={c.route}
          activeOpacity={0.85}
          onPress={() => navigation.navigate(c.route)}
          style={{backgroundColor: c.color, borderRadius: 24, padding: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'center'}}>
          <View style={{width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center'}}>
            <Icon pack="eva" name={c.icon} style={[globalStyle.icon24, {tintColor: '#FFFFFF'}]} />
          </View>
          <View style={{flex: 1, marginLeft: 14}}>
            <Text category="h7" bold style={{color: '#FFFFFF'}}>
              {c.title}
            </Text>
            <Text category="h9-s" mt={2} style={{color: 'rgba(255,255,255,0.92)'}} numberOfLines={2}>
              {c.body}
            </Text>
          </View>
          {c.badge ? (
            <View style={{backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8}}>
              <Text category="h10" bold style={{color: '#FFFFFF'}}>
                {c.badge}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </LifetimeScreen>
  );
};

export default LifetimeHub;
