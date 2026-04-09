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

# NextAsks

The `nextAsks` property defines the **upcoming valid bid amounts** for an auctioned item. It helps clients display what the next acceptable bids will be, based on the current state of the auction.

* * *

## What Influences `nextAsks`?

`nextAsks` is calculated from:

- The **current highest bid**, or the `startingBid` if no bids have been placed

- The calculation also considers the user context when a user has an active bid on the item.

- The rules in the `bidIncrementTable`

The system rounds the current amount down to the nearest valid increment and then applies the increment rule to generate the upcoming asks.

* * *

## How It Works

- If no bids exist yet, the `startingBid` is used as the base

- The first value in `nextAsks` is always the **minimum next valid bid**

- Each subsequent ask increases by the applicable **step** from the `bidIncrementTable`

- If the `startingBid` is **off-increment**, the first ask is the `startingBid`, and the **second ask snaps to the increment grid**

* * *

### 📘 Example A: Starting Bid Aligned to Increment

- `startingBid`: 1100

- Increment: 50

**Resulting**`nextAsks` **:**

```
json
[1100, 1150, 1200, 1250, ...]
```

All values align with the increment rule.

* * *

### 📘 Example B: Starting Bid Off-Increment

- `startingBid`: 1170

- Increment: 50

**Resulting**`nextAsks` **:**

```
json
[1170, 1200, 1250, 1300, ...]
```

- `1170` is accepted as-is for the first ask

- `1200` is the first value that aligns with the increment rule

- All following asks increase from `1200` in steps of 50

* * *

## 💡 Why It Matters

- `nextAsks` helps you **render bid buttons, sliders, or preset options** in the UI

- It ensures clients always show **valid and enforceable bid amounts**

- It reflects **dynamic increments** based on bid ranges — no hardcoding required

[Bid Increment Table](https://docs.basta.app/glossary/bid-increment-table)

[Reserve](https://docs.basta.app/glossary/reserve)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=NextAsks%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Fnextasks)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fnextasks)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fnextasks)

Content

[NextAsks](https://docs.basta.app/glossary/nextasks#242123f55f7d8082a457d6207ac39247)

[What Influences nextAsks?](https://docs.basta.app/glossary/nextasks#242123f55f7d8003817ee011919aa53c)

[How It Works](https://docs.basta.app/glossary/nextasks#242123f55f7d8078a0d6ce08f30696b4)

[📘 Example A: Starting Bid Aligned to Increment](https://docs.basta.app/glossary/nextasks#242123f55f7d80c4903aec0f0fce44ef)

[📘 Example B: Starting Bid Off-Increment](https://docs.basta.app/glossary/nextasks#242123f55f7d80f99121e05979cabe7e)

[💡 Why It Matters](https://docs.basta.app/glossary/nextasks#242123f55f7d8009b500dc3396d14404)