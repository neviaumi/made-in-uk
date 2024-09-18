export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  title: string;
  type: string;
  url: string;
};

export enum PRODUCT_SOURCE {
  OCADO = 'OCADO',
  SAINSBURY = 'SAINSBURY',
}

export enum SUBTASK_RELY_DATA_TYPE {
  SEARCH_PRODUCT = 'SEARCH_PRODUCT',
  SEARCH_PRODUCT_ERROR = 'SEARCH_PRODUCT_ERROR',
}

export enum REPLY_DATA_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  SEARCH_PRODUCT = 'SEARCH_PRODUCT',
  SEARCH_PRODUCT_ERROR = 'SEARCH_PRODUCT_ERROR',
}
