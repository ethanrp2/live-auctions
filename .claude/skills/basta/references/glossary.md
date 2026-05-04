# Basta Glossary

## Core Concepts

**Account ID**
Your unique Basta account identifier. Required for all Management API requests via the `x-account-id` header.

**API Key**
Authentication credential for Management API requests. Generated in your Basta dashboard settings and passed via the `x-api-key` header.

**Bidder Token**
A JWT (JSON Web Token) that authorizes a specific user to place bids. Generated server-side via the Management API's `createBidderToken` mutation. Contains user metadata and has a time-to-live (TTL) expiration.

## Sale Lifecycle

**Sale**
A container for one or more items being auctioned together. Has properties like title, description, currency, and bid increment rules. Can be in states: UNPUBLISHED, PUBLISHED, OPEN, or CLOSED.

**Sale Status:**
- **UNPUBLISHED** - Created but not yet published
- **PUBLISHED** - Published but bidding hasn't started (before openDate)
- **OPEN** - Currently accepting bids
- **CLOSED** - Auction has ended

**Item (SaleItem)**
An individual lot within a sale. Each item has its own opening/closing times, current bid, and status.

**Item Status:**
- **UNPUBLISHED** - Created but not yet published
- **PUBLISHED** - Published but not yet open for bidding
- **OPEN** - Currently accepting bids
- **CLOSING** - In the closing countdown period
- **CLOSED** - No longer accepting bids

## Bidding Mechanics

**Starting Bid**
The minimum initial bid amount for an item, specified in cents. For example, `startingBid: 1000` = $10.00.

**Reserve**
The minimum price an item must reach to be sold. If the auction closes below the reserve, the item doesn't sell. Optional field.

**Current Bid**
The highest active bid amount on an item at the current moment.

**Bid Increment**
The minimum amount by which a new bid must exceed the current bid. Defined by the bid increment table.

**Bid Increment Table**
A set of rules defining bid increments at different price ranges. For example:
```
0-1000: increment by $10
1000-10000: increment by $50
10000+: increment by $100
```

**Bid Type:**
- **MAX (MaxBid)** - Proxy bidding where user sets maximum willing to pay. The auction engine automatically places incremental bids on their behalf until they win, are outbid by a higher max bid, or their maximum is reached. The winning amount may be lower than the max amount. If a MaxBid leads, the engine reacts automatically when counter-bids arrive (unless max is reached).
- **NORMAL (NormalBid)** - One-time bid at a specific amount. Must align with the bid increment table and does not react to counter-bids. Once placed, it remains static.

**MaxBid Edge Cases:**
- If two users place identical MaxBids, the first bidder wins
- When a NormalBid is leading and a MaxBid is placed after, the engine will outbid it reactively (assuming MaxBid is higher)
- Even if winning, bidder must meet the reserve or no winner is declared

## Timing

**Open Date**
The timestamp when an item begins accepting bids. Before this time, the item is visible but not biddable.

**Closing Date**
The timestamp when an item enters its closing period. The actual closing time may extend based on the closing method.

**Closing Start**
The beginning of an item's closing period (typically same as closingDate).

**Closing End**
The calculated end time for an item, which may extend based on late bids and the closing time countdown.

**Closing Time Countdown**
Time extension (in milliseconds) added when bids arrive near an item's closing time. Prevents "sniping" by giving other bidders time to respond. For example, `closingTimeCountdown: 60000` adds 60 seconds whenever a bid arrives in the final period.

**Closing Method:**
- **OVERLAPPING** - Items within a sale can close at different times (currently the only supported method)

## API Structure

**GraphQL**
The query language used by both Basta APIs. Allows clients to request exactly the data they need.

**Mutation**
A GraphQL operation that modifies data (create, update, delete). Used for actions like creating sales, adding items, publishing, and placing bids.

**Query**
A GraphQL operation that reads data without modifying it. Used to retrieve sale/item information.

**Subscription**
A GraphQL operation that maintains a persistent connection and receives real-time updates. Used for live auction updates via WebSocket.

**Connection**
A pagination pattern in GraphQL. Returns `edges` (array of nodes with cursors) and `pageInfo` (pagination metadata).

**Union Type**
A GraphQL type that can be one of multiple types. Used in `bidOnItem` which returns either `BidPlacedSuccess` or `BidPlacedError`.

## Authentication

**Headers (Management API)**
```json
{
  "x-account-id": "your_account_id",
  "x-api-key": "your_api_key"
}
```

**Bearer Token (Client API)**
```json
{
  "Authorization": "Bearer bidder_token_here"
}
```

## WebSocket

**graphql-ws**
The WebSocket sub-protocol used for GraphQL subscriptions. Requires special connection initialization with optional authentication.

**connection_init**
The first message sent when establishing a WebSocket connection, optionally containing authentication credentials.

**Ping/Pong**
Keep-alive mechanism that sends periodic messages (every 10 seconds) to maintain the WebSocket connection.

## Response Handling

**__typename**
A special GraphQL field that returns the concrete type of a result. Essential for handling union types like `BidPlacedSuccess` or `BidPlacedError`.

**Error Codes**
Standardized error identifiers returned in `BidPlacedError`:
- `BID_TOO_LOW` - Bid doesn't meet minimum increment
- `ITEM_CLOSED` - Item no longer accepting bids
- `INVALID_TOKEN` - Token expired or malformed
- `UNAUTHORIZED` - Missing or invalid authorization

## Common Patterns

**Publishing Workflow**
1. Create sale (UNPUBLISHED)
2. Add items to sale
3. Publish sale (→ PUBLISHED)
4. Basta automatically opens/closes based on dates

**Bidding Workflow**
1. Generate bidder token (server-side)
2. Provide token to client
3. Client includes token in Authorization header
4. Client submits bid mutation
5. Handle success/error response

**Real-time Updates**
1. Establish WebSocket connection with token
2. Send subscription query
3. Receive updates as they occur
4. Handle connection failures and reconnection

**Webhook Integration**
1. Configure webhook URL in admin portal
2. Implement endpoint to receive POST requests
3. Verify idempotency key for duplicate prevention
4. Process event based on actionType
5. Handle BidOnItem, SaleStatusChanged, ItemsStatusChanged events

## Webhooks

**Idempotency Key**
A unique identifier for each webhook event. Use this to prevent duplicate processing of the same event.

**Action Type**
The type of event that triggered the webhook. Can be BidOnItem, SaleStatusChanged, or ItemsStatusChanged.

**Webhook Payload**
The JSON structure sent to your webhook endpoint containing the idempotency key, action type, and event-specific data.

**Reactive Bids**
When a MaxBid is active and a competing bid arrives, the auction engine may automatically place a reactive bid on behalf of the MaxBid holder. These are included in the BidOnItem webhook payload.

**Sale State**
Current auction state included in webhook payloads, showing the new leader, previous leader, current bid, and current max bid amounts.
