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

# StartingBid

The `StartingBid` is the **minimum amount required** for the first valid bid on an item. Any bid **below this value** will be automatically rejected

When no bids exist on an item, the starting bid is the first value found in the [nextAsks](https://docs.basta.app/glossary/nextasks).

## 🔄 Off-Increment Behavior

The starting bid **does not need to align with the increment table** (i.e., it can be off-increment). However, if it is off-increment, the **next valid ask** (minimum accepted bid after that) will be calculated based on the nearest valid increment _above_ the starting bid.

### 💡 Off-Increment Example

> 📦 Scenario: You define a starting bid of 1,170, which is off-increment based on the increment table.

* * *

### 🔢 Increment Table:

|     |     |
| --- | --- |
| Bid Range | Increment |
| 0–1,000 | 10 |
| 1,000–2,000 | 50 |
| 2,000 and up | 100 |

* * *

### 🧠 Behavior

- `1,170` is within the **1,000–2,000** range → increment is **50**

- Since `1,170` is **off-increment**, it is accepted **only** as the **first valid bid**

- The next bid must align with the increment grid: `1,200`, not `1,220`

* * *

### ✅ Resulting NextAsks Progression

|     |     |
| --- | --- |
| Ask Number | Value |
| 1st Ask | `1,170` _(startingBid)_ |
| 2nd Ask | `1,200` _(aligned to increment grid)_ |
| 3rd Ask | `1,250` |
| 4th Ask | `1,300` |
| ... | ... |

> 🔄 The increment “resets” to align with the defined step from the second bid onward, maintaining a consistent and predictable ask ladder.

[Glossary](https://docs.basta.app/glossary)

[Bid Increment Table](https://docs.basta.app/glossary/bid-increment-table)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=StartingBid%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Fstartingbid)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fstartingbid)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fstartingbid)

Content

[StartingBid](https://docs.basta.app/glossary/startingbid#087000a692ca4a54b041773ebd7af75d)

[🔄 Off-Increment Behavior](https://docs.basta.app/glossary/startingbid#242123f55f7d80f6a3f0f9de67f3f606)

[💡 Off-Increment Example](https://docs.basta.app/glossary/startingbid#242123f55f7d80e4b9d5cb6f94ee8732)

[🔢 Increment Table:](https://docs.basta.app/glossary/startingbid#242123f55f7d807890b1d192d6994bd3)

[🧠 Behavior](https://docs.basta.app/glossary/startingbid#242123f55f7d8081874ac4710729a03e)

[✅ Resulting NextAsks Progression](https://docs.basta.app/glossary/startingbid#242123f55f7d80e2975dedd6ec6199ac)