export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  title: string;
  type: string;
  url: string;
};

export enum REPLY_DATA_TYPE {
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  PRODUCT_SEARCH_ERROR = 'PRODUCT_SEARCH_ERROR',
  PRODUCT_SEARCH_LOCK = 'PRODUCT_SEARCH_LOCK',
}
