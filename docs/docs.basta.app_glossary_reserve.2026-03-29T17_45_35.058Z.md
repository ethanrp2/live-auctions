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

# Reserve

The `reserve` is the minimum price that must be met for an auctioned item to have a valid winning bid when it closes.

If the highest bid does **not meet or exceed** the reserve price by the time the item reaches [status:](https://www.notion.so/Statuses-805c67bb759b436c88ea9dc5ba61f1c5?pvs=21)`CLOSED`, **no winner is declared**.

🎯

**Purpose**

- Protects sellers from selling below a minimum acceptable value

- Ensures auctions can start at a low `startingBid` while still enforcing a threshold for winning

* * *

## 🧠 Behavior

- If the final bid is **below the reserve**, the auction **closes without a winner**

- The reserve is **not visible** to other bidders (unless revealed by the client)

* * *

## 🧰 Example: Standard Reserve Logic

- `startingBid`: $5,000

- `reserve`: $10,000

- Highest bid when the item closes: $9,500 → ❌ No winner

- If someone bids $10,000 or more → ✅ Winning bid

* * *

# ⚙️ `reserveAutoBidMethod`

This setting determines how **max bids** interact with the `reserve`.

* * *

## 🔧 Modes

|     |     |
| --- | --- |
| Mode | Description |
| `STANDARD` _(default)_ | Bids must explicitly **meet or exceed** the reserve to be valid |
| `MAX_BID_BELOW_RESERVE_IS_MET` | If a bidder places a **max bid** that reaches or exceeds the reserve, the system may **raise their bid automatically** to meet the reserve (or their max) — even if they initially bid below it |

* * *

## 🧪 Example: `MAX_BID_BELOW_RESERVE_IS_MET`

- `reserve`: $10,000

- User places a **max bid** of $12,000

- Current bid is $7,500

- ➡️ System **raises the user’s bid to $10,000** automatically to meet the reserve

- ✅ Reserve is now considered met

If the user's max bid is below the reserve (e.g. $9,500), and no higher bids exist, the system may still raise the bid to **$9,500** to reflect the user's full willingness — even if the reserve isn't met.

* * *

## 🚫 Important Notes

- `reserveAutoBidMethod` is **set once when the sale is created** and cannot be changed afterward

- The feature is only triggered through **max bids** (`BidType = MAX`)

- There is **no impact** on regular bidding behavior

[NextAsks](https://docs.basta.app/glossary/nextasks)

[Bid Types](https://docs.basta.app/glossary/bid-types)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=Reserve%0Ahttps%3A%2F%2Fdocs.basta.app%2Fglossary%2Freserve)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Freserve)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fglossary%2Freserve)

Content

[Reserve](https://docs.basta.app/glossary/reserve#a6a3b386d4394b52b79443105cb3bd37)

[🧠 Behavior](https://docs.basta.app/glossary/reserve#242123f55f7d808497b0c63093d5034f)

[🧰 Example: Standard Reserve Logic](https://docs.basta.app/glossary/reserve#242123f55f7d80c79c99d859313b8dc6)

[⚙️ reserveAutoBidMethod](https://docs.basta.app/glossary/reserve#242123f55f7d8024bd4fe69f703017f9)

[🔧 Modes](https://docs.basta.app/glossary/reserve#242123f55f7d8019914eefecc4a95d4d)

[🧪 Example: MAX\_BID\_BELOW\_RESERVE\_IS\_MET](https://docs.basta.app/glossary/reserve#242123f55f7d807ea9cbfcf4c9ae2758)

[🚫 Important Notes](https://docs.basta.app/glossary/reserve#242123f55f7d80889ebfca8320525d76)