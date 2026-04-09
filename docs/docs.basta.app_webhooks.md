---
url: "https://docs.basta.app/webhooks"
title: "Webhooks"
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

[Authenticating Webhook Payloads](https://docs.basta.app/webhooks/authenticating-webhook-payloads)

[👋 Welcome](https://docs.basta.app/)

# Webhooks

This page is currently under construction 🚧

You can subscribe and manage webhooks in the settings section in the admin portal.

Webhook messages can be used to trigger workflows that you might want to run as part of the basta integration. An example of a workflow is sending an email confirmation when a “BidOnItem” webhook is received.

## Webhook Types

Each webhook event has the following template

```
javascript
{
  "idempotencyKey": "{UNIQUE_STRING}",
  "actionType": "{BASTA_ACTION}",
  "data": "{PAYLOAD}"
}
```

ActionType can be one of the following

- BidOnItem

- SaleStatusChanged

- ItemsStatusChanged

### BidOnItem

The BidOnItem event(ActionType) is sent whenever a successful bid is placed on an auction.

```
javascript
{
  "idempotencyKey": "717756cc-b5d4-4715-a983-9101d39100d0",
  "actionType": "BidOnItem",
  "data": {
    "bidId": "9f1cd2a3-edb7-427f-b354-0ea8ec230c24",
    "saleId": "f574bc51-bee2-4042-bea7-031d8ba9193c",
    "itemId": "a4889f22-c43f-4562-84ef-ba2bb4913442",
    "userId": "a7c67169-3857-49ef-bdc5-11d029a20dc8",
    "amount": 500,
    "maxAmount": 500,
    "bidDate": "2024-02-27 10:23:08.181026943",
    "bidType": "",
    "saleState": {
      "newLeader": "ea582aa7-e650-4352-9a05-6b6cae713cfa",
      "prevLeader": "187042af-857a-40d2-9cac-8d5a70c54662",
      "currentBid": 600,
      "currentMaxBid": 600
    },
    "reactiveBids": [\
      {\
        "bidId": "165bc5ab-773f-4c1f-b2d8-acc73f88d62e",\
        "userId": "bea25c0c-066a-4db1-94f3-1d43bbc0239e",\
        "amount": 600,\
        "maxAmount": 600\
      }\
    ]
  }
}
```

BidOnItem payload example

### SaleStatusChanged

The SaleStatusChanged event(ActionType) is sent whenever a sale changes its status. For example when sale moves from being “PUBLISHED” to status “OPEN”

```
javascript
{
  "idempotencyKey": "90696215-d0f9-4878-85cf-86aa6e4d17c7",
  "actionType": "SaleStatusChanged",
  "data": {
    "saleId": "2d0bae48-8c37-4991-816f-0309745d11bd",
    "saleStatus": "OPEN"
  }
}
```

SaleStatusChanged payload example

### ItemsStatusChanged

The ItemsStatusChanged event(ActionType) is sent whenever items in a sale change their status.

```
javascript
{
  "idempotencyKey": "52254f4e-82cd-4aec-8f74-eb93ce516cc1",
  "actionType": "ItemsStatusChanged",
  "data": {
    "saleId": "ed553a36-6cb7-4fe4-af74-b554c32fb52b",
    "itemStatusChanges": [\
      {\
        "itemId": "a4d24150-937d-4d85-9dc8-792c99886cc7",\
        "itemStatus": "CLOSING",\
        "saleState": {\
          "newLeader": "bidder-a",\
          "prevLeader": "bidder-a",\
          "currentBid": 500,\
          "currentMaxBid": 500\
        }\
      },\
      {\
        "itemId": "536c9bfd-78bd-4296-96d7-4d4d78901260",\
        "itemStatus": "CLOSING",\
        "saleState": {\
          "newLeader": "bidder-x",\
          "prevLeader": "bidder-x",\
          "currentBid": 25000,\
          "currentMaxBid": 25000\
        }\
      }\
    ]
  }
}
```

ItemsStatusChanged payload example

[Authenticating Webhook Payloads](https://docs.basta.app/webhooks/authenticating-webhook-payloads)

[SDKs](https://docs.basta.app/sdks)

[Authenticating Webhook Payloads](https://docs.basta.app/webhooks/authenticating-webhook-payloads)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=Webhooks%0Ahttps%3A%2F%2Fdocs.basta.app%2Fwebhooks)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fwebhooks)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fwebhooks)

Content

[Webhooks](https://docs.basta.app/webhooks#6f31f71df346419080e1127d9bacf727)

[Webhook Types](https://docs.basta.app/webhooks#72e1215197e142f78b6e78350be8c587)

[BidOnItem](https://docs.basta.app/webhooks#45ecbe9d11f4443491c438bf78288092)

[SaleStatusChanged](https://docs.basta.app/webhooks#2cd36bff3d184f99bb43165a7dd0eb2c)

[ItemsStatusChanged](https://docs.basta.app/webhooks#c92dc2563b134089bb865bdd491b8697)