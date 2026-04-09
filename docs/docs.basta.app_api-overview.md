---
url: "https://docs.basta.app/api-overview"
title: "API Overview"
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

# API Overview

Basta provides two GraphQL APIs, each serving distinct roles within your integration:

|     |     |     |
| --- | --- | --- |
| API | Description | Access Type |
| **Management API** | Administrative API for managing auctions, inventory, pricing, … | **Server-side, Authenticated** |
| **Client API** | Public-facing API for surfacing auctions and enabling client-side interactions (read and write) | **Public + JWT Auth** |

> 🔐 Authentication:
>
> - The **Management API** requires static API credentials (see [API Access →](https://www.notion.so/API-Access-ca1c0b6df9d9444f98e922248866f517?pvs=21))
>
> - The **Client API** accepts either **unauthenticated requests** or **bidder-scoped JWT tokens** in the `Authorization` header

Explore each API in detail:

[🔧Management API](https://docs.basta.app/api-overview/management-api) [🌐Client API](https://docs.basta.app/api-overview/client-api) [⚡GraphQL Subscriptions (WebSockets)](https://docs.basta.app/api-overview/graphql-subscriptions-(websockets))

[API Access](https://docs.basta.app/api-access)

[Management API](https://docs.basta.app/api-overview/management-api)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=API+Overview%0Ahttps%3A%2F%2Fdocs.basta.app%2Fapi-overview)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fapi-overview)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fapi-overview)