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

# Bid Types

In Basta, every bid is either a **MaxBid** or a **NormalBid**. These types define how the auction engine responds when bids are placed — either reactively (MaxBid) or directly (NormalBid).

* * *

## 📈 MaxBid

A **MaxBid** allows a user to define the **maximum amount** they're willing to pay. The auction engine will automatically place incremental bids on their behalf until:

- They win the item

- They are outbid by a higher max bid

- Or their maximum amount is reached

* * *

### ⚙️ MaxBid Highlights

- Bids follow the [Bid Increment Table](https://www.notion.so/Bid-Increment-Table-abffb92377a54a95ae90f9ae5c5e8fb0?pvs=21)

- The **winning amount may be lower** than the max amount

- If outbid, the engine reacts automatically (unless max is reached)

* * *

### 📘 Example: MaxBid Behavior

### Bid Increment Table

|     |     |     |
| --- | --- | --- |
| LowRange | HighRange | Step |
| 0 | 200000 | 1000 |

- `startingBid`: 1000

### Bid Flow

1. **User-1** places MaxBid of `5000`

2. **User-2** places MaxBid of `3000`

3. System places a **reactive bid** for **User-1** at `4000`

### Resulting State

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| UserID | MaxBid Amount | Winning Amount | Active MaxBid | Bid Accepted |
| User-1 | 5000 | 1000 | 5000 | ✅ |
| User-2 | 3000 | 3000 | 3000 | ✅ |
| User-1 | — | 4000 | 5000 | ✅ _(reactive)_ |

💬

**Explanation**

Although **User-2** places a valid MaxBid of `3000` they are **never the leading bidder**.

As soon as their bid is placed, the system automatically places a **reactive bid** for **User-1**

at `4000`. This means User-2 is **immediately outbid**, and their MaxBid is recorded as **losing**.

* * *

## 🧾 NormalBid

A **NormalBid** is a one-time bid at a specified amount. It must align with the bid increment table and **does not react to counter-bids**.

* * *

### 📘 Example: NormalBid Behavior

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| UserID | NormalBid Amount | Winning Amount | Active MaxBid | Bid Accepted |
| User-1 | 5000 | 5000 | 0 | ✅ |
| User-2 | 3000 | — | 0 | ❌ _(too low)_ |
| User-2 | 8000 | 8000 | 0 | ✅ |

* * *

## ⚠️ Edge Cases to Know

### 🟰 **Equal MaxBids**

- If two users place **identical MaxBids**, the **first bidder wins**

- The second bid is accepted but marked as **losing**

### 🔄 **MaxBid overtakes NormalBid**

- If a NormalBid leads and a MaxBid is placed after, the engine will **outbid it reactively**, assuming the MaxBid is higher

### 🚫 **MaxBid below Reserve**

- Even if a user is winning, they must meet the item's [Reserve](https://www.notion.so/Reserve-a6a3b386d4394b52b79443105cb3bd37?pvs=21) or no winner is declared

[Reserve](https://docs.basta.app/glossary/reserve)

[ClosingMethod](https://docs.basta.app/glossary/closingmethod)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=Bid+Types%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Fbid-types)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fbid-types)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fbid-types)

Content

[Bid Types](https://docs.basta.app/glossary/bid-types#aa73a9c3c0e04f30a6fa3734f1b8fa9f)

[📈 MaxBid](https://docs.basta.app/glossary/bid-types#242123f55f7d805d84d4ea82a7373de1)

[⚙️ MaxBid Highlights](https://docs.basta.app/glossary/bid-types#242123f55f7d8045b2a9f6d8d75633c2)

[📘 Example: MaxBid Behavior](https://docs.basta.app/glossary/bid-types#242123f55f7d8041b775c1c406ad6808)

[Bid Increment Table](https://docs.basta.app/glossary/bid-types#242123f55f7d80ca8280e0727d2c33fd)

[Bid Flow](https://docs.basta.app/glossary/bid-types#242123f55f7d800a8bbef43b28be0d80)

[Resulting State](https://docs.basta.app/glossary/bid-types#242123f55f7d80d39b08d616d0da8477)

[🧾 NormalBid](https://docs.basta.app/glossary/bid-types#242123f55f7d8033beeecec0c5b9b1b3)

[📘 Example: NormalBid Behavior](https://docs.basta.app/glossary/bid-types#242123f55f7d804fb162d1d0edbbac75)

[⚠️ Edge Cases to Know](https://docs.basta.app/glossary/bid-types#242123f55f7d807aa5bdff57ee1e78d2)

[🟰 Equal MaxBids](https://docs.basta.app/glossary/bid-types#242123f55f7d8084be55c8afaa49c5f4)

[🔄 MaxBid overtakes NormalBid](https://docs.basta.app/glossary/bid-types#242123f55f7d801f8271d7171315e6a3)

[🚫 MaxBid below Reserve](https://docs.basta.app/glossary/bid-types#242123f55f7d802c91eccae624db17c4)