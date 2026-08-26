/** The clean first-paint example shown in the Kiyora editor. */
export const STARTER_SOURCE = `architecture
title Request pipeline
direction right
icons: badge

group Clients {
  Browser [document, blue, rounded]
  Mobile [card, teal]
}

group Edge {
  CDN [cloud, gray, outline]
  Load Balancer [db, green, bold]
}

group Backend {
  API [component, orange, bold]
  Cache [cylinder, red]
  Database [db, yellow]
  Queue [queue, violet]
}

Browser -> CDN: request
Mobile -> CDN: request
CDN --> Load Balancer: cache miss
Load Balancer -> API -> Cache: read
Cache -.-> Database: miss
API -> Queue: enqueue
`;
