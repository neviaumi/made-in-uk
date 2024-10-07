# Made in UK

The project aims to crawl the main UK grocery websites to display their prices and country of origin.

## Overview Architecture

The diagram below shows the high-level architecture of the system.

```mermaid
C4Component
    title Grocery Crawling System
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
Container_Boundary(backgroundService, "Background Services") {
Container_Boundary(ProductSearchService, "Product Search Service") {
Container(
productSearchTaskQueue, "Cloud Task",
"Product search tasks", "Buffer to queue product search requests")
Component(
productSearchAPI, "HTTP Server",
"Product Search HTTP API", "API to handle product searches")
}
Container_Boundary(ProductDetailService, "Product Detail Service") {
Container(
productDetailTaskQueue, "Cloud Task",
"Product detail tasks", "Buffer to queue product detail requests")
Container(
productDetailLowPriorityTaskQueue, "Cloud Task",
"Product detail low priority tasks", "Buffer to queue product detail requests that have cached results")
Component(
productDetailAPI, "HTTP Server",
"Product Detail HTTP API", "API to handle product details")
}
    }
System_Ext(groceryWebsite, "Grocery Website", "Website containing product data")
}
Rel(user, web, "Uses", "Browser")
Rel(web, api, "Forwards data requests", "HTTPS/GraphQL")
Rel(api, database, "Subscribes to background reply stream", "HTTPS")
Rel(api, productSearchTaskQueue, "Queues API requests for product search", "HTTPS")
Rel(productSearchTaskQueue, productSearchAPI, "Forwards tasks to product search API", "HTTPS")
Rel(productSearchAPI, groceryWebsite, "Lists products matching given filter", "HTTPS")
Rel(productSearchAPI, productDetailTaskQueue, "Queues API requests for product search", "HTTPS")
Rel(productSearchAPI, productDetailLowPriorityTaskQueue, "Queues API requests for product search to update cached data", "HTTPS")
Rel(productDetailTaskQueue, productDetailAPI, "Queues API requests to fetch product details", "HTTPS")
Rel(productDetailLowPriorityTaskQueue, productDetailAPI, "Queues API requests to fetch product details", "HTTPS")
Rel(productDetailAPI, groceryWebsite, "Fetches product details", "HTTPS")
Rel(productDetailAPI, database, "Responds to reply stream with product data", "HTTPS")
```

## Working Copy

[Deployed Website](https://made-in-uk-development-web-e955251-dxbhtl4gza-nw.a.run.app/)

### Working Videos

#### Search for Noodles (No Cache)

<https://github.com/neviaumi/made-in-uk/assets/2247500/d2d8d33e-315d-40ab-b45d-f99a6882e4c3>

#### Search for Beer (Cached Before)

<https://github.com/neviaumi/made-in-uk/assets/2247500/1c6b6a43-46f8-47e2-8e71-0eed7256e5ef>

## Development

[Install Docker Compose](https://docs.docker.com/compose/install/)

### Start Development Server

```sh
bash ./scripts/dev.sh

# Open http://localhost:5333 for development
```

## Deployment

[Setup GCloud](https://cloud.google.com/sdk/docs/authorizing)

### Initialize GCP

It may error about you need enable project on dashboard, just follow the link and enable the project.

You need manually enable the Firebase authentication on [firebase dashboard](https://console.firebase.google.com/)

```sh
# For development
bash ./scripts/deploy.sh development
# For production
bash ./scripts/deploy.sh production
```
