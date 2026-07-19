import React from "react";
import { Layout, LayoutProps } from "@ui-kitten/components";
import useLayout from "hooks/useLayout";

interface ContainerProps extends LayoutProps {
  useSafeArea?: boolean;
}

const Container: React.FC<ContainerProps> = ({
  children,
  style,
  useSafeArea = true,
  ...props
}) => {
  const { top, bottom } = useLayout();
  return (
    <Layout
      {...props}
      style={[
        { flex: 1 },
        useSafeArea && { paddingTop: top, paddingBottom: bottom },
        style,
      ]}
    >
      {children}
    </Layout>
  );
};

export default Container;
