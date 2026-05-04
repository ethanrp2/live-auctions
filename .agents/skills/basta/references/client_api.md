# Client API Reference

**Base URL:** `https://client.api.basta.app`

**Authentication:** Optional JWT bidder token for mutations
```json
{
  "Authorization": "Bearer BIDDER_TOKEN"
}
```

## Queries

### sale

Get public sale information (no auth required).

**Arguments:**
- `saleId` (ID!) - Sale ID

**Example:**
```graphql
query ViewSale {
  sale(saleId: "sale_abc123") {
    id
    title
    description
    status
    items {
      edges {
        node {
          id
          title
          description
          currentBid
          bidCount
          status
          dates {
            openDate
            closingStart
            closingEnd
          }
        }
      }
    }
  }
}
```

### item

Get individual item details.

**Arguments:**
- `saleId` (ID!) - Parent sale ID
- `itemId` (ID!) - Item ID

**Example:**
```graphql
query ViewItem {
  item(saleId: "sale_abc123", itemId: "item_xyz789") {
    id
    title
    description
    currentBid
    bidCount
    status
    myBidStatus {
      isWinning
      maxBid
      currentBid
    }
    dates {
      openDate
      closingStart
      closingEnd
    }
  }
}
```

## Mutations

### bidOnItem

Place a bid on an item. **Requires bidder token.**

**Input:**
- `saleId` (ID!) - Sale ID
- `itemId` (ID!) - Item ID
- `amount` (Int!) - Bid amount in cents
- `type` (BidType!) - MAX or NORMAL

**Returns:** Union type - BidPlacedSuccess or BidPlacedError

**Example:**
```graphql
# Headers: { "Authorization": "Bearer bidder_token_here" }
mutation PlaceBid {
  bidOnItem(
    saleId: "sale_abc123"
    itemId: "item_xyz789"
    amount: 1500000  # $15,000
    type: MAX
  ) {
    __typename
    ... on BidPlacedSuccess {
      amount
      bidStatus
      date
      bidType
    }
    ... on BidPlacedError {
      errorCode
      error
    }
  }
}
```

**Error Codes:**
- `BID_TOO_LOW` - Bid doesn't meet minimum increment
- `ITEM_CLOSED` - Item no longer accepting bids
- `INVALID_TOKEN` - Bidder token invalid or expired
- `UNAUTHORIZED` - Missing or invalid authorization

## Subscriptions

Connect to `wss://client.api.basta.app/query` using graphql-ws protocol.

### Authentication

Send bidder token in connection init:

```json
{
  "type": "connection_init",
  "payload": {
    "token": "BIDDER_TOKEN"
  }
}
```

### itemUpdates

Subscribe to real-time updates for an item.

**Arguments:**
- `saleId` (ID!) - Sale ID
- `itemId` (ID!) - Item ID

**Example:**
```graphql
subscription WatchItem {
  itemUpdates(saleId: "sale_abc123", itemId: "item_xyz789") {
    itemId
    currentBid
    bidCount
    status
    timeRemaining
    myBidStatus {
      isWinning
      maxBid
    }
  }
}
```

### saleUpdates

Subscribe to all items in a sale.

**Arguments:**
- `saleId` (ID!) - Sale ID

**Example:**
```graphql
subscription WatchSale {
  saleUpdates(saleId: "sale_abc123") {
    itemId
    title
    currentBid
    bidCount
    status
    timeRemaining
  }
}
```

## Type Definitions

### BidPlacedSuccess
- `amount` (Int!) - Bid amount placed
- `bidStatus` (String!) - "winning", "outbid", etc.
- `date` (DateTime!) - When bid was placed
- `bidType` (BidType!) - MAX or LIVE

### BidPlacedError
- `errorCode` (String!) - Error code
- `error` (String!) - Human-readable error message

### MyBidStatus
- `isWinning` (Boolean!) - Whether bidder is currently winning
- `maxBid` (Int) - Bidder's maximum bid (for MAX bids)
- `currentBid` (Int) - Current bid amount

### ItemUpdate
- `itemId` (ID!)
- `currentBid` (Int)
- `bidCount` (Int)
- `status` (ItemStatus!)
- `timeRemaining` (Int) - Seconds until closing
- `myBidStatus` (MyBidStatus)

## WebSocket Connection

**Protocol:** graphql-ws
**Ping/Pong:** Automatic keep-alive every 10 seconds

**Connection Flow:**

1. Connect to `wss://client.api.basta.app/query`

2. Send connection_init with token:
```json
{
  "type": "connection_init",
  "payload": {
    "token": "BIDDER_TOKEN"
  }
}
```

3. Subscribe to updates:
```json
{
  "id": "1",
  "type": "subscribe",
  "payload": {
    "query": "subscription { itemUpdates(saleId: \"...\", itemId: \"...\") { ... } }"
  }
}
```

4. Receive updates:
```json
{
  "id": "1",
  "type": "next",
  "payload": {
    "data": {
      "itemUpdates": { ... }
    }
  }
}
```

**JavaScript Example:**

```javascript
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'wss://client.api.basta.app/query',
  connectionParams: () => ({
    token: bidderToken
  })
});

client.subscribe({
  query: `
    subscription {
      itemUpdates(saleId: "sale_abc", itemId: "item_xyz") {
        currentBid
        bidCount
        status
      }
    }
  `
}, {
  next: (data) => console.log('Update:', data),
  error: (err) => console.error('Error:', err),
  complete: () => console.log('Complete')
});
```

## Best Practices

**Bidding:**
- Always check `__typename` to handle success/error responses
- Validate bid amounts client-side before submitting
- Show clear error messages for each error code
- Implement debouncing for rapid bid attempts

**Subscriptions:**
- Reconnect on connection loss
- Handle ping/pong timeouts
- Unsubscribe when components unmount
- Throttle UI updates for high-frequency events

**Performance:**
- Cache sale/item queries appropriately
- Use polling for less critical updates
- Batch multiple item queries when possible
- Implement optimistic UI updates for bids
