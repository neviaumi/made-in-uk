import type React from 'react';

import type { AsyncProductSuccess } from '@/product.ts';

export function ProductListItem({
  product,
}: {
  product: AsyncProductSuccess['data'];
}) {
  return (
    <li>
      <a
        className={
          'tw-box-border tw-flex tw-flex-col tw-items-center tw-border tw-border-solid tw-border-transparent hover:tw-border-primary-user-action'
        }
        href={product.url}
        rel="noreferrer"
        target={'_blank'}
      >
        <img
          alt={product.title}
          className={'tw-h-16 tw-object-contain'}
          src={product.image}
        />
        <h1 className={'tw-text-center tw-text-xl tw-font-semibold'}>
          {product.title}
        </h1>
        <p className={'tw-py-0.5 tw-text-lg tw-font-semibold'}>
          {product.price}
        </p>
        <p className={'tw-text-base tw-font-semibold tw-text-placeholder'}>
          {product.pricePerItem}
        </p>
        <p className={'tw-text-center tw-text-lg tw-font-medium'}>
          {product.countryOfOrigin}
        </p>
      </a>
    </li>
  );
}
