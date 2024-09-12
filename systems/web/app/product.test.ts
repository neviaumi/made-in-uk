import { describe, expect, it } from 'vitest';

import {
  type AsyncProductSuccess,
  FetchProductResponseType,
  sortByCountryOfOrigin,
  sortByPrice,
  sortByPricePerItem,
} from './product.ts';

function generateMockProduct(
  data?: Partial<AsyncProductSuccess['data']>,
): AsyncProductSuccess {
  return {
    data: Object.assign(
      {
        countryOfOrigin: 'UK',
        id: crypto.randomUUID(),
        image: 'https://example.com/image.png',
        price: '£1.00',
        pricePerItem: '£0.50/item',
        source: 'EXAMPLE',
        title: 'Example Product',
        type: 'PRODUCT',
        url: '/product/1',
      },
      data,
    ),
    type: FetchProductResponseType.FETCH_PRODUCT_DETAIL,
  };
}

describe('product', () => {
  describe('sorting', () => {
    [
      {
        products: [
          generateMockProduct({
            countryOfOrigin: 'Spain',
            id: '1',
            price: '£1.00',
            pricePerItem: '£0.50 per kg',
          }),
          generateMockProduct({
            countryOfOrigin: 'Spain',
            id: '2',
            price: '£1.00',
            pricePerItem: '£0.50 per kg',
          }),
          generateMockProduct({
            countryOfOrigin: 'UK',
            id: '3',
            price: '£4.00',
            pricePerItem: '£0.25 per kg',
          }),
          generateMockProduct({
            countryOfOrigin: 'Spain',
            id: '4',
            price: '£5.00',
            pricePerItem: '£0.50 per kg',
          }),
          generateMockProduct({
            countryOfOrigin: 'Unknown',
            id: '5',
            price: '£10.00',
            pricePerItem: '£0.50 per kg',
          }),
          generateMockProduct({
            countryOfOrigin: 'UK',
            id: '6',
            price: '£2.00',
            pricePerItem: '£0.50 per kg',
          }),
        ],
        sortedProductIds: ['3', '6', '1', '2', '4', '5'],
      },
    ].forEach(({ products, sortedProductIds }) =>
      it('sort by country origin, price per item and price', () => {
        const sortedProducts = products.toSorted((productA, productB) => {
          const countrySortResult = sortByCountryOfOrigin(productA, productB);
          if (countrySortResult !== 0) return countrySortResult;

          const pricePerItemSortResult = sortByPricePerItem(productA, productB);
          if (pricePerItemSortResult !== 0) return pricePerItemSortResult;

          return sortByPrice(productA, productB);
        });
        expect(sortedProducts.map(({ data }) => data.id)).toEqual(
          sortedProductIds,
        );
      }),
    );
  });
});
