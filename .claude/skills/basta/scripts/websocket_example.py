#!/usr/bin/env python3
"""
Basta WebSocket Subscription Example

Demonstrates how to connect to Basta's GraphQL subscriptions
for real-time auction updates using websockets.
"""

import asyncio
import json
from typing import Optional, Callable
try:
    from websockets.client import connect
except ImportError:
    print("This script requires websockets library: pip install websockets --break-system-packages")
    exit(1)


class BastaSubscriptionClient:
    """WebSocket client for Basta real-time subscriptions."""
    
    WS_URL = "wss://client.api.basta.app/query"
    
    def __init__(self, bidder_token: Optional[str] = None):
        """
        Initialize subscription client.
        
        Args:
            bidder_token: Optional JWT token for authenticated subscriptions
        """
        self.bidder_token = bidder_token
        self.ws = None
        self.subscription_id = 0
    
    async def connect(self):
        """Establish WebSocket connection."""
        self.ws = await connect(self.WS_URL, subprotocols=["graphql-ws"])
        
        # Send connection init
        init_payload = {}
        if self.bidder_token:
            init_payload["token"] = self.bidder_token
        
        await self.ws.send(json.dumps({
            "type": "connection_init",
            "payload": init_payload
        }))
        
        # Wait for connection ack
        response = await self.ws.recv()
        message = json.loads(response)
        
        if message["type"] != "connection_ack":
            raise Exception(f"Connection failed: {message}")
        
        print("✓ WebSocket connected")
    
    async def subscribe_to_item(self, sale_id: str, item_id: str, 
                                callback: Callable[[dict], None]):
        """
        Subscribe to real-time updates for a specific item.
        
        Args:
            sale_id: Sale ID
            item_id: Item ID
            callback: Function to call with each update
        """
        if not self.ws:
            await self.connect()
        
        self.subscription_id += 1
        sub_id = str(self.subscription_id)
        
        subscription_query = """
        subscription ItemUpdates($saleId: ID!, $itemId: ID!) {
          itemUpdates(saleId: $saleId, itemId: $itemId) {
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
        """
        
        await self.ws.send(json.dumps({
            "id": sub_id,
            "type": "subscribe",
            "payload": {
                "query": subscription_query,
                "variables": {
                    "saleId": sale_id,
                    "itemId": item_id
                }
            }
        }))
        
        print(f"✓ Subscribed to item {item_id}")
        
        # Listen for updates
        try:
            async for message in self.ws:
                data = json.loads(message)
                
                if data.get("type") == "next" and data.get("id") == sub_id:
                    update = data["payload"]["data"]["itemUpdates"]
                    callback(update)
                elif data.get("type") == "error":
                    print(f"✗ Subscription error: {data}")
                    break
                elif data.get("type") == "complete":
                    print(f"✓ Subscription {sub_id} complete")
                    break
        except Exception as e:
            print(f"✗ Error receiving updates: {e}")
    
    async def subscribe_to_sale(self, sale_id: str, 
                               callback: Callable[[dict], None]):
        """
        Subscribe to real-time updates for all items in a sale.
        
        Args:
            sale_id: Sale ID
            callback: Function to call with each update
        """
        if not self.ws:
            await self.connect()
        
        self.subscription_id += 1
        sub_id = str(self.subscription_id)
        
        subscription_query = """
        subscription SaleUpdates($saleId: ID!) {
          saleUpdates(saleId: $saleId) {
            itemId
            title
            currentBid
            bidCount
            status
            timeRemaining
          }
        }
        """
        
        await self.ws.send(json.dumps({
            "id": sub_id,
            "type": "subscribe",
            "payload": {
                "query": subscription_query,
                "variables": {"saleId": sale_id}
            }
        }))
        
        print(f"✓ Subscribed to sale {sale_id}")
        
        # Listen for updates
        try:
            async for message in self.ws:
                data = json.loads(message)
                
                if data.get("type") == "next" and data.get("id") == sub_id:
                    update = data["payload"]["data"]["saleUpdates"]
                    callback(update)
                elif data.get("type") == "error":
                    print(f"✗ Subscription error: {data}")
                    break
                elif data.get("type") == "complete":
                    print(f"✓ Subscription {sub_id} complete")
                    break
        except Exception as e:
            print(f"✗ Error receiving updates: {e}")
    
    async def close(self):
        """Close WebSocket connection."""
        if self.ws:
            await self.ws.close()
            print("✓ WebSocket closed")


# Example usage
async def example_item_subscription():
    """Example: Subscribe to a specific item."""
    
    def handle_update(update):
        """Handle item updates."""
        print(f"\n📢 Item Update:")
        print(f"   Current Bid: ${update['currentBid'] / 100:.2f}")
        print(f"   Bid Count: {update['bidCount']}")
        print(f"   Status: {update['status']}")
        if update.get('timeRemaining'):
            print(f"   Time Remaining: {update['timeRemaining']}s")
        
        if update.get('myBidStatus'):
            status = update['myBidStatus']
            print(f"   Your Status: {'WINNING' if status['isWinning'] else 'OUTBID'}")
            if status.get('maxBid'):
                print(f"   Your Max Bid: ${status['maxBid'] / 100:.2f}")
    
    # Initialize client (with or without bidder token)
    client = BastaSubscriptionClient(bidder_token=None)  # Add token if needed
    
    try:
        # Subscribe to item updates
        await client.subscribe_to_item(
            sale_id="your_sale_id",
            item_id="your_item_id",
            callback=handle_update
        )
    finally:
        await client.close()


async def example_sale_subscription():
    """Example: Subscribe to all items in a sale."""
    
    def handle_update(update):
        """Handle sale-wide updates."""
        print(f"\n📢 Sale Update:")
        print(f"   Item: {update['title']} ({update['itemId']})")
        print(f"   Current Bid: ${update['currentBid'] / 100:.2f}")
        print(f"   Bids: {update['bidCount']}")
        print(f"   Status: {update['status']}")
    
    client = BastaSubscriptionClient()
    
    try:
        await client.subscribe_to_sale(
            sale_id="your_sale_id",
            callback=handle_update
        )
    finally:
        await client.close()


if __name__ == "__main__":
    # Run example
    # Uncomment the subscription you want to test:
    
    # asyncio.run(example_item_subscription())
    # asyncio.run(example_sale_subscription())
    
    print("Edit this file to add your sale_id and item_id, then uncomment one of the examples above.")
