import WrenchScrewdriverIcon from '@heroicons/react/24/outline/WrenchScrewdriverIcon';
import React from 'react';

export function ErrorItem(
  props: React.ComponentProps<typeof WrenchScrewdriverIcon>,
) {
  return (
    <WrenchScrewdriverIcon
      {...props}
      className={
        'tw-bg-error tw-text-error group-hover:tw-bg-error-user-action group-hover:tw-text-error-user-action'
      }
    />
  );
}
