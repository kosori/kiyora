'use client';

import type { ReactNode } from 'react';

type ButtonProps = {
  appName: string;
  children: ReactNode;
  className?: string;
};

export const Button = ({ children, className, appName }: ButtonProps) => {
  const handleClick = () => {
    console.log(`Hello from your ${appName} app!`);
  };

  return (
    <button className={className} onClick={handleClick} type='button'>
      {children}
    </button>
  );
};
