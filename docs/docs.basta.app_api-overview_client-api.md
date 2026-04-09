---
url: "https://docs.basta.app/api-overview/client-api"
title: "Client API"
---

[![logo](https://image-forwarder.notaku.so/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL25vdGFrdS11c2VyLWltYWdlcy8yZmIxMTM4Mi1mNWU0LTRiYzgtODVhZi01ZTdkYWJiOGI2MjBCYXN0YSUyNTIwRmlsbGVkJTI1NDAzeC5wbmc=)](https://docs.basta.app/)

[Home Page](https://basta.app/)

Search

CtrlK

[👋 Welcome](https://docs.basta.app/)

[🚀\\
\\
Getting Started with Basta](https://docs.basta.app/getting-started-with-basta)

[🔓\\
\\
API Access](https://docs.basta.app/api-access)

[☁️\\
\\
API Overview](https://docs.basta.app/api-overview)

[🔧\\
\\
Management API](https://docs.basta.app/api-overview/management-api)

[🌐\\
\\
Client API](https://docs.basta.app/api-overview/client-api)

[⚡\\
\\
GraphQL Subscriptions (WebSockets)](https://docs.basta.app/api-overview/graphql-subscriptions-(websockets))

[👣\\
\\
Walkthroughs](https://docs.basta.app/walkthroughs)

[📝\\
\\
Glossary](https://docs.basta.app/glossary)

[![](https://image-forwarder.notaku.so/aHR0cHM6Ly93d3cubm90aW9uLnNvL2ltYWdlL2h0dHBzJTNBJTJGJTJGcHJvZC1maWxlcy1zZWN1cmUuczMudXMtd2VzdC0yLmFtYXpvbmF3cy5jb20lMkY0ZmMxNzUzYy0yYWVlLTRiYzEtYmNhMC1hN2JlZGJiZmU5NWUlMkZmYmIwZTQzMy00ZjY4LTRiYmYtODI4Zi0xYzAyMzUxNzViODclMkZCYXN0YS1wYWNrYWdlLWxvZ28xLnN2Zz90YWJsZT1ibG9jayZpZD0xMWU4OGE0MC1mODU0LTQ0ZDctYTIxMy00MTdhYzRjOTNjMGUmY2FjaGU9djImd2lkdGg9MjAw)\\
\\
SDKs](https://docs.basta.app/sdks)

[🪝\\
\\
Webhooks](https://docs.basta.app/webhooks)

[👋 Welcome](https://docs.basta.app/)

/

[API Overview](https://docs.basta.app/api-overview)

# Client API

The **Client API** is designed for use in client-side environments such as web or mobile apps. It powers user-facing auction interactions and supports both **public reads** and **authenticated user actions**.

### 🧭 Access Modes

|     |     |     |
| --- | --- | --- |
| Mode | Use Case | Auth Mechanism |
| **Public** | Unauthenticated reads on auction objects. | No auth required |
| **Authenticated (User)** | Placing bids, receiving user-scoped subscriptions | JWT in `Authorization` header |

* * *

### 🔑 Bidder Tokens (JWT)

Since Basta does not manage users for integrating businesses, businesses generate their own **bidder tokens** via the **Management API**.

These JWT tokens:

- Contain a `userId` and `ttl`

- Give user permissions to make bids

- Are added to the `Authorization` header on Client API requests

### Example Header:

```
json

"Authorization": "Bearer <BIDDER_JWT>"
```

> 📌 The userId embedded in the token is used to resolve bids and subscriptions in the user's context.

* * *

### 💡 Capabilities

- **Unauthenticated Queries**

Retrieve auction listings, timing details, bid history, etc.

- **Authenticated Mutations**

Place bids via `BidOnItem` using a bidder token

- **User-Scoped Subscriptions (websockets)**

Subscribe to auction events in real-time, filtered by `userId` in token

🔗 **GraphQL Explorer**: [client.api.basta.app](https://client.api.basta.app/)

* * *

### ✅ Summary

The **Client API** offers full auction interactivity while keeping your users’ identity management under your control. Basta provides a secure and flexible token-based mechanism that fits well with existing auth stacks.

[Management API](https://docs.basta.app/api-overview/management-api)

[GraphQL Subscriptions (WebSockets)](https://docs.basta.app/api-overview/graphql-subscriptions-(websockets))

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=Client+API%0Ahttps%3A%2F%2Fdocs.basta.app%2Fapi-overview%2Fclient-api)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fapi-overview%2Fclient-api)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fapi-overview%2Fclient-api)

Content

[Client API](https://docs.basta.app/api-overview/client-api#3e911f5679cf439f8cc2ac46f0b760a1)

[🧭 Access Modes](https://docs.basta.app/api-overview/client-api#241123f55f7d8074abdbffd9d8617b08)

[🔑 Bidder Tokens (JWT)](https://docs.basta.app/api-overview/client-api#241123f55f7d8043aecdcd090b7e8447)

[Example Header:](https://docs.basta.app/api-overview/client-api#241123f55f7d80809e9ef7c76fee592e)

[💡 Capabilities](https://docs.basta.app/api-overview/client-api#241123f55f7d80cb8542fce78b6a654d)

[✅ Summary](https://docs.basta.app/api-overview/client-api#241123f55f7d8000b8bbea465cb44e69)