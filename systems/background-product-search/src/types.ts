export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  title: string;
  type: string;
  url: string;
};

export enum REPLY_DATA_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  PRODUCT_SEARCH_ERROR = 'PRODUCT_SEARCH_ERROR',
}
