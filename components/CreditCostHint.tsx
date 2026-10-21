import React, {memo} from 'react';
import {useTranslation} from 'react-i18next';
import Text from 'components/Text';
import {useCredits} from 'services/creditsService';

/** Small "Uses N credits" hint to sit under the button that starts an AI
 * action. Renders nothing when the action is free or credits are off. */
const CreditCostHint = memo(({action, mt = 8}: {action: string; mt?: number}) => {
  const {t} = useTranslation(['common']);
  const {costOf} = useCredits();
  const n = costOf(action);
  if (!n) return null;
  return (
    <Text category="h10" status="placeholder" center mt={mt}>
      {t('common:credits_uses', {defaultValue: 'Uses {{count}} credits', count: n})}
    </Text>
  );
});

export default CreditCostHint;
