import type { HTMLProps } from 'react';

export function Loader(props: HTMLProps<HTMLSlotElement>) {
  return (
    <slot
      {...props}
      className={`tw-block tw-animate-pulse tw-bg-gray-400 ${props.className ?? ''}`}
    />
  );
}
