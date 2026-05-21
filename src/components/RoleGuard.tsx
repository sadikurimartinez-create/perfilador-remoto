import React from 'react';

interface Props {

  allowed: boolean;

  children: React.ReactNode;

}

const RoleGuard: React.FC<Props> = ({
  allowed,
  children,
}) => {

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
};

export default RoleGuard;