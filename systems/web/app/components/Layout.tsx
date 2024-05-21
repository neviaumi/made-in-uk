import type { HTMLProps, PropsWithChildren } from 'react';

export const Page = Object.assign(
  function Page({
    children,
    className = '',
    ...rest
  }: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return (
      <div
        className={`tw-container ${className}`}
        role={'document'}
        tabIndex={0}
        {...rest}
      >
        {children}
      </div>
    );
  },
  {
    Footer({ children, ...rest }: PropsWithChildren<HTMLProps<HTMLElement>>) {
      return <footer {...rest}>{children}</footer>;
    },
    Header({ children, ...rest }: PropsWithChildren<HTMLProps<HTMLElement>>) {
      return <header {...rest}>{children}</header>;
    },
    Main({ children, ...rest }: PropsWithChildren<HTMLProps<HTMLElement>>) {
      return <main {...rest}>{children}</main>;
    },
    Side({ children, ...rest }: PropsWithChildren<HTMLProps<HTMLElement>>) {
      return <aside {...rest}>{children}</aside>;
    },
  },
);
