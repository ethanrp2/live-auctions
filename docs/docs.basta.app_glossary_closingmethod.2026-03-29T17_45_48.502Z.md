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

[StartingBid](https://docs.basta.app/glossary/startingbid)

[Bid Increment Table](https://docs.basta.app/glossary/bid-increment-table)

[NextAsks](https://docs.basta.app/glossary/nextasks)

[Reserve](https://docs.basta.app/glossary/reserve)

[Bid Types](https://docs.basta.app/glossary/bid-types)

[ClosingMethod](https://docs.basta.app/glossary/closingmethod)

[ClosingTimeCountdown](https://docs.basta.app/glossary/closingtimecountdown)

[![](https://image-forwarder.notaku.so/aHR0cHM6Ly93d3cubm90aW9uLnNvL2ltYWdlL2h0dHBzJTNBJTJGJTJGcHJvZC1maWxlcy1zZWN1cmUuczMudXMtd2VzdC0yLmFtYXpvbmF3cy5jb20lMkY0ZmMxNzUzYy0yYWVlLTRiYzEtYmNhMC1hN2JlZGJiZmU5NWUlMkZmYmIwZTQzMy00ZjY4LTRiYmYtODI4Zi0xYzAyMzUxNzViODclMkZCYXN0YS1wYWNrYWdlLWxvZ28xLnN2Zz90YWJsZT1ibG9jayZpZD0xMWU4OGE0MC1mODU0LTQ0ZDctYTIxMy00MTdhYzRjOTNjMGUmY2FjaGU9djImd2lkdGg9MjAw)\\
\\
SDKs](https://docs.basta.app/sdks)

[🪝\\
\\
Webhooks](https://docs.basta.app/webhooks)

[👋 Welcome](https://docs.basta.app/)

/

[Glossary](https://docs.basta.app/glossary)

# ClosingMethod

The `ClosingMethod` defines **how and when items in a sale transition to the closing phase**.

This determines whether items close **individually**, **in sequence**, or **in parallel.**

* * *

## `OVERLAPPING`

This is the current active closing method used in Basta.

- Each item has:

  - A `closingStart` timestamp (defined manually)
  - A `closingEnd` timestamp (calculated automatically)

- The `closingEnd` is initially computed as:

`closingEnd = closingStart +``[closingTimeCountdown]`

- If a bid is placed between `closingStart` and `closingEnd`, the countdown restarts, extending the `closingEnd`

> 🔄 This behavior is called anti-sniping — it gives bidders time to react to last-second bids and prevents unfair last-moment wins.

* * *

### 🕓 Closing Strategies with `OVERLAPPING`

You can configure how items begin closing:

|     |     |
| --- | --- |
| Strategy | Description |
| **Simultaneous** | All items share the same `closingStart` timestamp and close in parallel |
| **Stacked Intervals** | Each item starts closing a few seconds or minutes after the previous one, using staggered `closingStart` values |

> 🛠️ This flexibility enables auctions to feel fast-paced or staggered based on your business needs.

* * *

## 📦 `ONE_BY_ONE` _(Coming Soon)_

This method allows **only one item to enter closing at a time**. Items **do not overlap** — each must fully close before the next begins.

> 🚧 This feature is on the roadmap and not currently available.
>
> If you'd like to use or test `ONE_BY_ONE`, please contact the Basta development team for updates.

[Bid Types](https://docs.basta.app/glossary/bid-types)

[ClosingTimeCountdown](https://docs.basta.app/glossary/closingtimecountdown)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=ClosingMethod%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Fclosingmethod)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fclosingmethod)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fclosingmethod)

Content

[ClosingMethod](https://docs.basta.app/glossary/closingmethod#b2350594e9ac4df59efb8a2268fc9155)

[OVERLAPPING](https://docs.basta.app/glossary/closingmethod#242123f55f7d80408f4ff3e8eea6a48a)

[🕓 Closing Strategies with OVERLAPPING](https://docs.basta.app/glossary/closingmethod#242123f55f7d8095a004ed1df70a6db5)

[📦 ONE\_BY\_ONE (Coming Soon)](https://docs.basta.app/glossary/closingmethod#242123f55f7d80869afcce28e87bf953)