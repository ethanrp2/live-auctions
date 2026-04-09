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

# ClosingTimeCountdown

`ClosingTimeCountdown` defines the **duration (in milliseconds)** used to control how long an item stays in its **closing phase** — and how long that phase is extended when new bids are received.

* * *

### 🔧 Required When: `closingMethod = OVERLAPPING`

Any sale using the `OVERLAPPING` closing method **must set** this value.

It ensures that every item in the sale has a clear, consistent rule for how long it can stay open once it begins closing.

* * *

### 🔄 How It Works

- When an item enters `ITEM_CLOSING`, its `closingEnd` is initialized as:

`closingEnd = closingStart + closingTimeCountdown`

- If a bid is placed **after**`closingStart` **but before**`closingEnd`, the countdown is **reset**:

`closingEnd = now() + closingTimeCountdown`

> 🧠 This creates an anti-sniping mechanism — every valid bid placed in the final moments of an auction resets the clock, giving other bidders a fair chance to respond.

* * *

### 🧪 Example

If `closingTimeCountdown = 120000` (2 minutes):

- At 10:00:00 → item enters closing

→ `closingEnd = 10:02:00`

- A bid is placed at 10:01:15

→ `closingEnd = 10:03:15`

- Another bid comes at 10:02:45

→ `closingEnd = 10:04:45`

⏳ The auction keeps extending — but **never more than 2 minutes ahead of the current time**.

[ClosingMethod](https://docs.basta.app/glossary/closingmethod)

[SDKs](https://docs.basta.app/sdks)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=ClosingTimeCountdown%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Fclosingtimecountdown)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fclosingtimecountdown)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Fclosingtimecountdown)

Content

[ClosingTimeCountdown](https://docs.basta.app/glossary/closingtimecountdown#3ffeb10b300e407fb0cdf85ba7ddcef8)

[🔧 Required When: closingMethod = OVERLAPPING](https://docs.basta.app/glossary/closingtimecountdown#242123f55f7d80cc9d38edd3f57c128e)

[🔄 How It Works](https://docs.basta.app/glossary/closingtimecountdown#242123f55f7d80cebea0f0c87398a87c)

[🧪 Example](https://docs.basta.app/glossary/closingtimecountdown#242123f55f7d801dbf89f6fe7bc6dbb0)