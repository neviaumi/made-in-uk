export enum FetchProductResponseType {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  FETCH_PRODUCT_DETAIL_FAILURE = 'FETCH_PRODUCT_DETAIL_FAILURE',
}

type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  price: string;
  pricePerItem: string | null;
  source: string;
  title: string;
  type: string;
  url: string;
};

export type AsyncProductError = {
  data: Pick<Product, 'id'>;
  type: FetchProductResponseType.FETCH_PRODUCT_DETAIL_FAILURE;
};

export type AsyncProductSuccess = {
  data: Product;
  type: FetchProductResponseType.FETCH_PRODUCT_DETAIL;
};

export function isFailureProductResponse(
  product: AsyncProductError | AsyncProductSuccess,
): product is AsyncProductError {
  return product.type === 'FETCH_PRODUCT_DETAIL_FAILURE';
}
function isUkCountry(country: string) {
  const ukCountries = ['United Kingdom', 'UK', 'England'];

  return ukCountries.includes(country);
}

export function isSuccessProductResponse(
  product: AsyncProductError | AsyncProductSuccess,
): product is AsyncProductSuccess {
  return product.type === 'FETCH_PRODUCT_DETAIL';
}

export function sortByCountryOfOrigin(
  productA: AsyncProductSuccess,
  productB: AsyncProductSuccess,
) {
  const countryA = productA.data.countryOfOrigin;
  const countryB = productB.data.countryOfOrigin;

  if (isUkCountry(countryA) && !isUkCountry(countryB)) return -1;
  if (!isUkCountry(countryA) && isUkCountry(countryB)) return 1;
  return 0;
}

export function sortFailureResponseToLatest(
  productA: AsyncProductError | AsyncProductSuccess,
  productB: AsyncProductError | AsyncProductSuccess,
) {
  if (isFailureProductResponse(productA) && isFailureProductResponse(productB))
    return 0;
  if (isFailureProductResponse(productA)) return 1;
  if (isFailureProductResponse(productB)) return -1;
  return 0;
}

function parsePrice(price: string) {
  return Number(price.slice(1));
}

function parseProductPricingToNumber(price: string) {
  const isPenny = price.includes('p');
  return isPenny ? Number(price.slice(0, -1)) / 100 : Number(price.slice(1));
}

export function sortByPricePerItem(
  productA: AsyncProductSuccess,
  productB: AsyncProductSuccess,
) {
  const productAPricePerItem = productA.data.pricePerItem;
  const productBPricePerItem = productB.data.pricePerItem;

  if (!productAPricePerItem || !productBPricePerItem) return 0;

  const [productAPricing, productAPricingUnit] =
    productAPricePerItem.split('/');
  const [productBPricing, productBPricingUnit] =
    productBPricePerItem.split('/');

  // Only compare if the units match
  if (productAPricingUnit !== productBPricingUnit) return 0;

  return (
    parseProductPricingToNumber(productAPricing) -
    parseProductPricingToNumber(productBPricing)
  );
}

export function sortByPrice(
  productA: AsyncProductSuccess,
  productB: AsyncProductSuccess,
) {
  const productAPricing = parsePrice(productA.data.price);
  const productBPricing = parsePrice(productB.data.price);
  return productAPricing - productBPricing;
}
