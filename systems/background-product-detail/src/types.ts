export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  price: string;
  pricePerItem: string | null;
  title: string;
  type: string;
  url: string;
};

export enum REPLY_DATA_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  FETCH_PRODUCT_DETAIL_FAILURE = 'FETCH_PRODUCT_DETAIL_FAILURE',
}
