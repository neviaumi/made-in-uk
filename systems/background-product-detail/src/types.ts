export enum PRODUCT_SOURCE {
  LILYS_KITCHEN = 'LILYS_KITCHEN',
  OCADO = 'OCADO',
  PETS_AT_HOME = 'PETS_AT_HOME',
  VET_SHOP = 'VET_SHOP',
  ZOOPLUS = 'ZOOPLUS',
}

export type Product = {
  countryOfOrigin: string;
  id: string;
  image: string;
  price: string;
  pricePerItem: string | null;
  source: PRODUCT_SOURCE;
  title: string;
  type: string;
  url: string;
};

export enum REPLY_DATA_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  FETCH_PRODUCT_DETAIL_FAILURE = 'FETCH_PRODUCT_DETAIL_FAILURE',
}
