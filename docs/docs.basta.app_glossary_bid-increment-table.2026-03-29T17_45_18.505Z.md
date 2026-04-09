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

# Bid Increment Table

The `BidIncrementTable` defines how much the **next valid bid** must increase based on the **current bid amount**. It ensures that bids follow a clear, predictable progression as auction prices rise.

* * *

## 🔢 Example Table

|     |     |     |
| --- | --- | --- |
| Low Range | High Range | Step |
| 0 | 100000 | 2500 |
| 100000 | 5000000 | 10000 |

> 💵 All values are in minor currency units (e.g. cents for USD).
>
> For example, `100000` = $1,000.

* * *

## 💬 Human-Friendly Interpretation (USD)

With the table above, here's how to read it:

- From **$0 to $1,000** → bids increase by **$25**

- From **$1,000 to $50,000** → bids increase by **$100**

- If the bid exceeds the highest `HighRange` (in this case $50,000), the increment remains fixed at the last step: **$100**

* * *

## ✅ Validation Rules

To be valid, a `BidIncrementTable` must meet these requirements:

- **Each range must align**

  - `LowRange` and `HighRange` must be divisible by `Step`
  - `Step` must fit evenly within the range (`HighRange - LowRange`)

- **Rules must be continuous**

  - The first rule must start at `0`
  - Each rule’s `LowRange` must equal the previous rule’s `HighRange`

- **At least one rule is required**

* * *

## 🧠 Summary

- Controls how bid amounts increase over time

- Dynamic and price-dependent

- Keeps auction pacing smooth and scalable

> 📘 Want to see how this interacts with a StartingBid?
>
> [Check the StartingBid glossary entry →](https://docs.basta.app/glossary/startingbid)

[StartingBid](https://docs.basta.app/glossary/startingbid)

[NextAsks](https://docs.basta.app/glossary/nextasks)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=Bid+Increment+Table%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Fbid-increment-table)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fbid-increment-table)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fbid-increment-table)

Content

[Bid Increment Table](https://docs.basta.app/glossary/bid-increment-table#abffb92377a54a95ae90f9ae5c5e8fb0)

[🔢 Example Table](https://docs.basta.app/glossary/bid-increment-table#242123f55f7d80f89d09d2faea9ce303)

[💬 Human-Friendly Interpretation (USD)](https://docs.basta.app/glossary/bid-increment-table#242123f55f7d80a3ac25e8b2dd2c5882)

[✅ Validation Rules](https://docs.basta.app/glossary/bid-increment-table#242123f55f7d80cb85f1c52bb1f27362)

[🧠 Summary](https://docs.basta.app/glossary/bid-increment-table#242123f55f7d80fa9f92ef536687ebe7)