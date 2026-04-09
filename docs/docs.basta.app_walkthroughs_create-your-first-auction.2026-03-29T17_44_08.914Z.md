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

[Create your first auction](https://docs.basta.app/walkthroughs/create-your-first-auction)

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

[Walkthroughs](https://docs.basta.app/walkthroughs)

# Create your first auction

## Management API

Here's a quick guide on how to create an auction using [Management API](https://management.api.basta.app/) and how to bid on an item using [Client API](https://client.api.basta.app/). This guide will use the GraphQL UIs in the browser.

> If you are following along, please ensure that you have either a valid cookie in the browser or the API key and account ID headers set. See [🔓API Access](https://docs.basta.app/api-access)

### Create a Sale

A sale is a grouping of 1 or more items.

Sale input properties:

- _title:_ Short title for the sale.

- _description: Some further details for the sale could be added here._

- _currency_: Only “USD” is supported.

- _[bidIncrementTable](https://docs.basta.app/glossary/bid-increment-table)_: The bid increments define the increments by which bids can increase. The bid increment table is optional, but setting it at the sale level means that it will apply to items within the sale.

- [_closingMethod_](https://docs.basta.app/glossary/closingmethod) _:_ Only ‘OVERLAPPING’ is currently supported

- [closingTimeCountdown](https://docs.basta.app/glossary/closingtimecountdown): Setting this optional value at the sale level will apply it to all items within the sale.

```
graphql
mutation CreateSale{
  createSale(accountId: "ACCOUNT_ID", input: {
    title: "Test Sale",
    description: "Description for the sale",
    currency:"USD",
    bidIncrementTable: {
      rules: [\
        { lowRange: 0, highRange: 100000, step: 10000 },\
        { lowRange: 100000, highRange: 500000, step: 25000 },\
      ]
    }
    closingMethod: OVERLAPPING,
    closingTimeCountdown: 60000
  }) {
    id
    status
  }
}
```

Mutation to create a sale

```
graphql
{
  "data": {
    "createSale": {
      "id": "GENERATED_SALE_ID",
      "status": "UNPUBLISHED"
    }
  }
}
```

Response after running createSale mutation

### Add Item to the sale

Adds an item for auction to the previously created sale

SaleItem input properties:

- _saleId:_ Previously generated saleId that item should belong to.

- _title:_ Title for the item.

- _description_: Description for the item.

- [_startingBid_](https://docs.basta.app/glossary/startingbid) _:_ Initialized as 1000 cents or $10.

- [_reserve_](https://docs.basta.app/glossary/reserve): Set as 200000000 cents or $2,000,000.

- _openDate:_ The date and time when the auction will start to accept bids.

- _closingDate:_ The date and time when the auction will be moved to status ‘CLOSING’.

```
graphql
mutation CreateItemForSale{
  createItemForSale(accountId: "ACCOUNT_ID", input: {
    saleId: "GENERATED_SALE_ID",
    title: "David Gilmour's 1969 Stratocaster",
    description: "David Gilmour purchased the guitar, a 1969 model with a maple cap fingerboard and large headstock, in 1970 from Manny's Music in New York City to replace a similar guitar his parents bought him for his 21st birthday, which had been lost while touring with Pink Floyd in the United States in 1968. The Black Strat was originally a sunburst colour, but had been repainted black at Manny's. Since then, it has undergone numerous modifications.",
    startingBid: 1000
    reserve: 200000000
    allowedBidTypes: [MAX]
    openDate: "2024-02-01T15:00:00Z",
    closingDate:"2024-02-01T16:00:00Z"
  }){
    id
    dates {
      openDate
      closingStart
      closingEnd
    }
    status
  }
}
```

Mutation to create a SaleItem

```
graphql
{
  "data": {
    "createItemForSale": {
      "id": "GENERATED_ITEM_ID",
      "dates": {
        "openDate": "2024-02-01T15:00:00Z",
        "closingStart": "2024-02-01T16:00:00Z",
        "closingEnd": "2024-02-01T16:01:00Z"
      },
		}
	}
}
```

Response after running createItemForSale mutation

### Publish Sale

After a sale is created and items have been added it is initially in status UNPUBLISHED.

If the sale should go live it needs to be published. After a sale has been published Basta will manage the lifecycle of the sale and handle opening and closing of the sale and its items.

```
graphql
mutation PublishSale{
  publishSale(accountId: "ACCOUNT_ID", input: {
    saleId: "GENERATED_SALE_ID"
  }){
    id
    status
  }
}
```

Mutation to Publish a Sale

```
graphql
{
  "data": {
    "publishSale": {
      "id": "GENERATED_SALE_ID",
      "status": "PUBLISHED"
    }
  }
}
```

Response after running publishSale mutation

### Get Sale

```
graphql
query GetSale{
  sale(accountId: "ACCOUNT_ID", id: "GENERATED_SALE_ID"){
    id
    status
    items {
      edges {
        node {
          id
          dates {
            closingStart
            closingEnd
          }
        }
      }
    }
  }
}
```

Query to get a sale created for an account

```
graphql
{
  "data": {
    "sale": {
      "id": "GENERATED_SALE_ID",
      "status": "PUBLISHED",
      "items": {
        "edges": [\
          {\
            "node": {\
              "id": "GENERATED_ITEM_ID",\
              "dates": {\
                "openDate": "2024-02-01T15:00:00Z",\
				        "closingStart": "2024-02-01T16:00:00Z",\
				        "closingEnd": "2024-02-01T16:01:00Z"\
              }\
            }\
          }\
        ]
      }
    }
  }
}
```

Response after running sale query

### CreateBidderToken

The owner of a sale must create a bidder token for each bidder, typically after bidder verification. A bid can only be executed if an authorization header with the corresponding bidder token is present.

BidderToken input parameters:

- _userID_: The userID of the bidder.

- _ttl:_ Time to live for the bidder token in minutes.

```
graphql
mutation CreateBidderToken($accountID: String!) {
  createBidderToken(accountId: $accountID, input: {
    metadata: {
      userId: "user-1",
      ttl:60
    }
  }){
    token
    expiration
  }
}
```

```
graphql
{
  "data": {
    "createBidderToken": {
      "token": "GENERATED_BIDDER_TOKEN",
      "expiration": "2023-04-19T17:20:10Z"
    }
  }
}
```

## Client API

### BidOnItem

Here's a code sample to bid on an item:

```
graphql
{
	"Authorization": "Bearer GENERATED_BIDDER_TOKEN"
}
```

To execute a bid an Authorization header must be present !

```
graphql
mutation MaxBid{
  bidOnItem(saleId: "GENERATED_SALE_ID",
  itemId: "GENERATED_ITEM_ID",
  amount: 10000,
  type: MAX) {
		__typename
    ...on BidPlacedSuccess {
      amount
			bidStatus
			date
			bidType
    }
    ...on BidPlacedError {
      errorCode
      error
    }
  }
}
```

Mutation to place a MaxBid on an item

```
graphql
{
  "data": {
    "bidOnItem": {
      "__typename": "MaxBidPlacedSuccess"
    }
  }
}
```

Response from BidOnItem mutation

[Walkthroughs](https://docs.basta.app/walkthroughs)

[Glossary](https://docs.basta.app/glossary)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=Create+your+first+auction%0Ahttps%3A%2F%2Fdocs.basta.app%2Fwalkthroughs%2Fcreate-your-first-auction)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fwalkthroughs%2Fcreate-your-first-auction)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fwalkthroughs%2Fcreate-your-first-auction)

Content

[Create your first auction](https://docs.basta.app/walkthroughs/create-your-first-auction#028a90a12a3143168b98b0439df32393)

[Management API](https://docs.basta.app/walkthroughs/create-your-first-auction#075862566b1b417597185761b5c55620)

[Create a Sale](https://docs.basta.app/walkthroughs/create-your-first-auction#0b26c8ebfdfe4327bd94d804fa13e703)

[Add Item to the sale](https://docs.basta.app/walkthroughs/create-your-first-auction#9f3c9d08d694434c9fce0acfeaec50e5)

[Publish Sale](https://docs.basta.app/walkthroughs/create-your-first-auction#f86ef6a368554026b1594470386d8acc)

[Get Sale](https://docs.basta.app/walkthroughs/create-your-first-auction#f152852196674697a033e37461d995e6)

[CreateBidderToken](https://docs.basta.app/walkthroughs/create-your-first-auction#85b7f7b199ff469ab411311c36760117)

[Client API](https://docs.basta.app/walkthroughs/create-your-first-auction#cf971653db2640df9fc310151bc09cc5)

[BidOnItem](https://docs.basta.app/walkthroughs/create-your-first-auction#f483e31a93884ba29e2bde29a1bec23c)