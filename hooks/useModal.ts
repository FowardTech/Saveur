import React from "react";

const useModal = () => {
  const [visible, setVisible] = React.useState(false);
  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return { visible, show, hide };
};

export default useModal;
