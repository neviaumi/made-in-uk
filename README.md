# Made in UK

Project aim to crawling UK main grocery website
for display their price and country of origin.

## Overview Architecture

Diagram below show the high level architecture of the system

```mermaid
C4Component
title Grocery crawling system
Person(user, "User")
Container_Boundary(frontend, "Frontend") {
Component(
    web, "Web Server", 
    "Remix", "Entry point for user interaction")
}
Container_Boundary(backend, "Backend") {
    Component(
        api, "GraphQL Server", 
"GraphQL Yoga", "Gateway to handle all data requests")
    Container(
        database, "Firestore",
        "Document DB", "Persistent storage for product data")
    Container_Boundary(backgroundService, "Background") {
        Container_Boundary(ProductSearchService, "Product Search Service") {
            Container(
                productSearchTaskQueue, "Cloud Task",
                "Product search tasks", "buffer to queuing search product request") 
            Component(
    productSearchAPI, "HTTP Server",
    "Product search HTTP API", "API to handle product search")
        }
        Container_Boundary(ProductDetailService, "Product Detail Service") {
            Container(
                productDetailTaskQueue, "Cloud Task",
                "Product detail tasks", "buffer to queuing fetching product detail request")
            Container(
                productDetailLowPriorityTaskQueue, "Cloud Task",
                "Product detail low priority tasks", "buffer to queuing product detail request that have cached result")
            Component(
                productDetailAPI, "HTTP Server",
                "Product detail HTTP API", "API to handle product detail")
        }
    }
    System_Ext(groceryWebsite, "Grocery Website", "Grocery website contain product data")
}
Rel(user, web, "Uses", "Browser")
Rel(web, api, "forward data request", "HTTPS/GraphQL")
Rel(api, database, "subscribe background reply stream", "HTTPS")
Rel(api, productSearchTaskQueue, "queue api request to product search", "HTTPS")
Rel(productSearchTaskQueue, productSearchAPI, "forward task to product search API", "HTTPS")
Rel(productSearchAPI, groceryWebsite, "list product that matching given filter", "HTTPS")
Rel(productSearchAPI, productDetailTaskQueue, "queue api request to product search", "HTTPS")
Rel(productSearchAPI, productDetailLowPriorityTaskQueue, "queue api request to product search for update cached data", "HTTPS")
Rel(productDetailTaskQueue, productDetailAPI, "queue api request to fetch product detail", "HTTPS")
Rel(productDetailLowPriorityTaskQueue, productDetailAPI, "queue api request to fetch product detail", "HTTPS")
Rel(productDetailAPI, groceryWebsite, "fetch product detail", "HTTPS")
Rel(productDetailAPI, database, "response to reply stream with product data", "HTTPS")
```

## Working Copy

[Deployed website](https://made-in-uk-development-web-e955251-dxbhtl4gza-nw.a.run.app/)

### Working video

#### Search for noodle (No cache)

![Fresh search - Search for noodle](./docs/search-for-noodle-fast-forward.gif)

#### Search for beer (Cached before)

![Cached search - Search for beer](./docs/search-for-beer-fast-forward.gif)

## Development

[Install docker compose](https://docs.docker.com/compose/install/)

### Start development server

```sh
bash ./scripts/dev.sh

Open http://localhost:5333 for dev
```

## Deployment

[Setup GCloud](https://cloud.google.com/sdk/docs/authorizing)

### Init GCP

Before deploy, you need to init GCP project

```sh
cd systems/infrastructure
# or production
bash ./scripts/init.sh development
```

After init, you can deploy though that script

```sh
# or production
bash ./scripts/deploy.sh development
```
