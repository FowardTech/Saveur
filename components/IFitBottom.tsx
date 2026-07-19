import React from 'react';
import {
  StyleService,
  useStyleSheet,
  Layout,
  Button,
} from '@ui-kitten/components';

import {globalStyle} from 'styles/globalStyle';

interface IFitBottomProps {
  title: string;
  onPress(): void;
}

const IFitBottom = ({title, onPress}: IFitBottomProps) => {
  const styles = useStyleSheet(themedStyles);
  return (
    <Layout style={styles.container}>
      <Button
        children={title}
        onPress={onPress}
        style={globalStyle.shadowBtn}
      />
    </Layout>
  );
};

export default IFitBottom;

const themedStyles = StyleService.create({
  container: {
    marginHorizontal: 24,
    paddingVertical: 8,
  },
});
