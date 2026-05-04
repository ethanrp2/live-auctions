# Webhooks Reference

Basta webhooks notify your application when events occur in the auction system. Configure and manage webhooks in the admin portal settings.

## Webhook Structure

All webhook events follow this structure:

```json
{
  "idempotencyKey": "UNIQUE_UUID",
  "actionType": "EVENT_TYPE",
  "data": { /* event-specific payload */ }
}
```

**Fields:**
- `idempotencyKey` - Unique UUID for this event. Use to prevent duplicate processing.
- `actionType` - Type of event: `BidOnItem`, `SaleStatusChanged`, or `ItemsStatusChanged`
- `data` - Event-specific payload (see below)

## Event Types

### BidOnItem

Triggered when a bid is successfully placed on an item.

**Payload:**
```json
{
  "idempotencyKey": "717756cc-b5d4-4715-a983-9101d39100d0",
  "actionType": "BidOnItem",
  "data": {
    "bidId": "9f1cd2a3-edb7-427f-b354-0ea8ec230c24",
    "saleId": "f574bc51-bee2-4042-bea7-031d8ba9193c",
    "itemId": "a4889f22-c43f-4562-84ef-ba2bb4913442",
    "userId": "a7c67169-3857-49ef-bdc5-11d029a20dc8",
    "amount": 500,
    "maxAmount": 500,
    "bidDate": "2024-02-27 10:23:08.181026943",
    "bidType": "MAX",
    "saleState": {
      "newLeader": "ea582aa7-e650-4352-9a05-6b6cae713cfa",
      "prevLeader": "187042af-857a-40d2-9cac-8d5a70c54662",
      "currentBid": 600,
      "currentMaxBid": 600
    },
    "reactiveBids": [
      {
        "bidId": "165bc5ab-773f-4c1f-b2d8-acc73f88d62e",
        "userId": "bea25c0c-066a-4db1-94f3-1d43bbc0239e",
        "amount": 600,
        "maxAmount": 600
      }
    ]
  }
}
```

**Data Fields:**
- `bidId` - Unique identifier for this bid
- `saleId` - Parent sale ID
- `itemId` - Item being bid on
- `userId` - User who placed the bid
- `amount` - Bid amount in cents
- `maxAmount` - For MaxBids, the maximum amount. For NormalBids, same as amount
- `bidDate` - Timestamp when bid was placed
- `bidType` - "MAX" or "NORMAL"
- `saleState` - Current auction state after this bid
  - `newLeader` - Current winning bidder ID
  - `prevLeader` - Previous winning bidder ID
  - `currentBid` - Current winning bid amount
  - `currentMaxBid` - Current maximum bid amount
- `reactiveBids` - Array of automatic bids placed in response (for MaxBid scenarios)

**Use Cases:**
- Send bid confirmation emails
- Update real-time dashboards
- Trigger notifications to outbid users
- Log bid activity for analytics
- Award loyalty points

### SaleStatusChanged

Triggered when a sale changes status (e.g., PUBLISHED → OPEN).

**Payload:**
```json
{
  "idempotencyKey": "90696215-d0f9-4878-85cf-86aa6e4d17c7",
  "actionType": "SaleStatusChanged",
  "data": {
    "saleId": "2d0bae48-8c37-4991-816f-0309745d11bd",
    "saleStatus": "OPEN"
  }
}
```

**Data Fields:**
- `saleId` - Sale that changed status
- `saleStatus` - New status: UNPUBLISHED, PUBLISHED, OPEN, or CLOSED

**Use Cases:**
- Send "auction is now live" notifications
- Update marketing campaigns
- Trigger email campaigns when auction opens
- Archive data when auction closes
- Update external listings

### ItemsStatusChanged

Triggered when one or more items change status.

**Payload:**
```json
{
  "idempotencyKey": "52254f4e-82cd-4aec-8f74-eb93ce516cc1",
  "actionType": "ItemsStatusChanged",
  "data": {
    "saleId": "ed553a36-6cb7-4fe4-af74-b554c32fb52b",
    "itemStatusChanges": [
      {
        "itemId": "a4d24150-937d-4d85-9dc8-792c99886cc7",
        "itemStatus": "CLOSING",
        "saleState": {
          "newLeader": "bidder-a",
          "prevLeader": "bidder-a",
          "currentBid": 500,
          "currentMaxBid": 500
        }
      },
      {
        "itemId": "536c9bfd-78bd-4296-96d7-4d4d78901260",
        "itemStatus": "CLOSING",
        "saleState": {
          "newLeader": "bidder-x",
          "prevLeader": "bidder-x",
          "currentBid": 25000,
          "currentMaxBid": 25000
        }
      }
    ]
  }
}
```

**Data Fields:**
- `saleId` - Parent sale ID
- `itemStatusChanges` - Array of item status changes
  - `itemId` - Item that changed status
  - `itemStatus` - New status: UNPUBLISHED, PUBLISHED, OPEN, CLOSING, or CLOSED
  - `saleState` - Current auction state for this item

**Use Cases:**
- Alert bidders when items enter closing period
- Send "last chance" notifications
- Process winning bids when items close
- Update inventory systems
- Generate invoices for closed items

## Implementation Guidelines

### Endpoint Requirements

Your webhook endpoint must:
- Accept HTTP POST requests
- Use HTTPS (required for security)
- Respond with 2xx status code within 10 seconds
- Handle duplicate events (check idempotencyKey)

### Idempotency

Always check the `idempotencyKey` before processing:

```python
def handle_webhook(payload):
    idempotency_key = payload['idempotencyKey']
    
    # Check if already processed
    if is_already_processed(idempotency_key):
        return 200  # Acknowledge duplicate
    
    # Process event
    process_event(payload)
    
    # Mark as processed
    mark_as_processed(idempotency_key)
    
    return 200
```

### Error Handling

Return appropriate status codes:
- `200` - Successfully processed
- `500` - Server error (Basta will retry)
- `401/403` - Authentication error (no retry)
- `400` - Bad request (no retry)

### Security

**Verify webhook authenticity:**
- Check source IP if possible
- Validate payload structure
- Use HTTPS only
- Implement rate limiting

**Authenticate payloads:**
See the authenticating webhook payloads documentation for signature verification details.

### Processing Best Practices

**Async Processing:**
```python
@app.post("/webhooks/basta")
async def receive_webhook(payload: dict):
    # Acknowledge immediately
    await queue.enqueue(process_webhook, payload)
    return {"status": "received"}

async def process_webhook(payload):
    # Process asynchronously
    action_type = payload['actionType']
    
    if action_type == 'BidOnItem':
        await handle_bid(payload['data'])
    elif action_type == 'SaleStatusChanged':
        await handle_sale_status(payload['data'])
    elif action_type == 'ItemsStatusChanged':
        await handle_items_status(payload['data'])
```

**Event Routing:**
```python
HANDLERS = {
    'BidOnItem': handle_bid_event,
    'SaleStatusChanged': handle_sale_status_event,
    'ItemsStatusChanged': handle_items_status_event
}

def process_webhook(payload):
    action_type = payload['actionType']
    handler = HANDLERS.get(action_type)
    
    if handler:
        handler(payload['data'])
    else:
        log_unknown_event(action_type)
```

## Example Implementations

### Node.js/Express

```javascript
const express = require('express');
const app = express();

app.use(express.json());

const processedEvents = new Set();

app.post('/webhooks/basta', (req, res) => {
  const { idempotencyKey, actionType, data } = req.body;
  
  // Check idempotency
  if (processedEvents.has(idempotencyKey)) {
    return res.status(200).send('Already processed');
  }
  
  // Route event
  switch (actionType) {
    case 'BidOnItem':
      handleBid(data);
      break;
    case 'SaleStatusChanged':
      handleSaleStatus(data);
      break;
    case 'ItemsStatusChanged':
      handleItemsStatus(data);
      break;
    default:
      console.log('Unknown event type:', actionType);
  }
  
  // Mark as processed
  processedEvents.add(idempotencyKey);
  
  res.status(200).send('OK');
});

function handleBid(data) {
  console.log(`Bid placed: ${data.amount} on item ${data.itemId}`);
  // Send email, update dashboard, etc.
}
```

### Python/FastAPI

```python
from fastapi import FastAPI, Request
from typing import Set

app = FastAPI()
processed_events: Set[str] = set()

@app.post("/webhooks/basta")
async def webhook_handler(request: Request):
    payload = await request.json()
    idempotency_key = payload['idempotencyKey']
    
    # Check idempotency
    if idempotency_key in processed_events:
        return {"status": "already_processed"}
    
    # Process event
    action_type = payload['actionType']
    data = payload['data']
    
    if action_type == 'BidOnItem':
        await handle_bid(data)
    elif action_type == 'SaleStatusChanged':
        await handle_sale_status(data)
    elif action_type == 'ItemsStatusChanged':
        await handle_items_status(data)
    
    # Mark as processed
    processed_events.add(idempotency_key)
    
    return {"status": "ok"}

async def handle_bid(data: dict):
    print(f"Bid: {data['amount']} on {data['itemId']}")
    # Process bid event
```

## Testing Webhooks

**Use webhook testing tools:**
- [webhook.site](https://webhook.site) - Inspect webhook payloads
- [ngrok](https://ngrok.com) - Expose local server for testing
- [RequestBin](https://requestbin.com) - Capture and inspect webhooks

**Manual testing:**
```bash
curl -X POST https://your-domain.com/webhooks/basta \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "test-123",
    "actionType": "BidOnItem",
    "data": {
      "bidId": "test-bid",
      "saleId": "test-sale",
      "itemId": "test-item",
      "userId": "test-user",
      "amount": 1000,
      "maxAmount": 1000,
      "bidType": "NORMAL",
      "saleState": {
        "newLeader": "test-user",
        "currentBid": 1000,
        "currentMaxBid": 1000
      },
      "reactiveBids": []
    }
  }'
```

## Monitoring

**Key metrics to track:**
- Webhook delivery success rate
- Processing time
- Failed deliveries
- Duplicate event rate
- Event type distribution

**Logging:**
```python
import logging

logger = logging.getLogger('webhooks')

def log_webhook_event(payload):
    logger.info(
        "Webhook received",
        extra={
            'idempotency_key': payload['idempotencyKey'],
            'action_type': payload['actionType'],
            'sale_id': payload['data'].get('saleId'),
            'item_id': payload['data'].get('itemId')
        }
    )
```

## Common Issues

**Duplicate Events:**
Always implement idempotency checking. Basta may send the same event multiple times.

**Timeout Errors:**
If processing takes >10 seconds, acknowledge immediately and process asynchronously.

**Missing Events:**
Check your webhook URL is correctly configured in the admin portal and is publicly accessible.

**Authentication Failures:**
Ensure your endpoint is HTTPS and properly configured to accept POST requests.
