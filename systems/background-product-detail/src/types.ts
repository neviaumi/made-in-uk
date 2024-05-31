export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  title: string;
  type: string;
  url: string;
};

export enum REPLY_DATA_TYPE {
  FETCH_PRODUCT_DETAIL_FAILURE = 'FETCH_PRODUCT_DETAIL_FAILURE',
  PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
}
