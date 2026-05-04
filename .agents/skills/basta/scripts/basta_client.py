#!/usr/bin/env python3
"""
Basta API Helper

Utilities for interacting with Basta's GraphQL APIs.
Provides helper functions for common operations.
"""

import json
import os
from typing import Dict, Any, Optional
import requests


class BastaClient:
    """Client for Basta Management and Client APIs."""
    
    MANAGEMENT_URL = "https://management.api.basta.app/query"
    CLIENT_URL = "https://client.api.basta.app/query"
    
    def __init__(self, account_id: str, api_key: str):
        """
        Initialize Basta client.
        
        Args:
            account_id: Your Basta account ID
            api_key: Your API key from Basta dashboard
        """
        self.account_id = account_id
        self.api_key = api_key
    
    def _management_request(self, query: str, variables: Optional[Dict] = None) -> Dict[str, Any]:
        """Execute a GraphQL request to the Management API."""
        headers = {
            "Content-Type": "application/json",
            "x-account-id": self.account_id,
            "x-api-key": self.api_key
        }
        
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        response = requests.post(self.MANAGEMENT_URL, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    
    def _client_request(self, query: str, variables: Optional[Dict] = None, 
                       bidder_token: Optional[str] = None) -> Dict[str, Any]:
        """Execute a GraphQL request to the Client API."""
        headers = {"Content-Type": "application/json"}
        if bidder_token:
            headers["Authorization"] = f"Bearer {bidder_token}"
        
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        response = requests.post(self.CLIENT_URL, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    
    def create_sale(self, title: str, description: str = "", 
                    bid_increment_rules: Optional[list] = None,
                    closing_time_countdown: int = 60000) -> Dict[str, Any]:
        """
        Create a new sale.
        
        Args:
            title: Sale title
            description: Sale description
            bid_increment_rules: List of dicts with lowRange, highRange, step
            closing_time_countdown: Time extension in milliseconds (default 60s)
        
        Returns:
            Sale data including id and status
        """
        if bid_increment_rules is None:
            bid_increment_rules = [
                {"lowRange": 0, "highRange": 100000, "step": 1000}
            ]
        
        query = """
        mutation CreateSale($accountId: String!, $input: CreateSaleInput!) {
          createSale(accountId: $accountId, input: $input) {
            id
            status
            title
          }
        }
        """
        
        variables = {
            "accountId": self.account_id,
            "input": {
                "title": title,
                "description": description,
                "currency": "USD",
                "bidIncrementTable": {"rules": bid_increment_rules},
                "closingMethod": "OVERLAPPING",
                "closingTimeCountdown": closing_time_countdown
            }
        }
        
        result = self._management_request(query, variables)
        return result["data"]["createSale"]
    
    def create_item(self, title: str, description: str,
                    starting_bid: int, reserve: Optional[int] = None) -> Dict[str, Any]:
        """
        Create a standalone item that can be added to sales later.
        
        Args:
            title: Item title
            description: Item description
            starting_bid: Starting bid in cents
            reserve: Reserve price in cents (optional)
        
        Returns:
            Item data including id, title, and status
        """
        query = """
        mutation CreateItem($accountId: String!, $input: CreateItemInput!) {
          createItem(accountId: $accountId, input: $input) {
            id
            title
            status
          }
        }
        """
        
        item_input = {
            "title": title,
            "description": description,
            "startingBid": starting_bid
        }
        
        if reserve:
            item_input["reserve"] = reserve
        
        variables = {
            "accountId": self.account_id,
            "input": item_input
        }
        
        result = self._management_request(query, variables)
        return result["data"]["createItem"]
    
    def add_item_to_sale(self, sale_id: str, item_id: str,
                         open_date: str, closing_date: str,
                         allowed_bid_types: Optional[list] = None) -> Dict[str, Any]:
        """
        Add an existing item to a sale.
        
        Args:
            sale_id: Parent sale ID
            item_id: Existing item ID (from create_item)
            open_date: ISO 8601 timestamp for when bidding opens
            closing_date: ISO 8601 timestamp for when closing begins
            allowed_bid_types: List of allowed bid types (default: ["MAX"])
        
        Returns:
            Sale item data including id, status, and dates
        """
        query = """
        mutation AddItemToSale($accountId: String!, $input: AddItemToSaleInput!) {
          addItemToSale(accountId: $accountId, input: $input) {
            id
            status
            dates {
              openDate
              closingStart
              closingEnd
            }
          }
        }
        """
        
        if allowed_bid_types is None:
            allowed_bid_types = ["MAX"]
        
        item_input = {
            "saleId": sale_id,
            "itemId": item_id,
            "allowedBidTypes": allowed_bid_types,
            "openDate": open_date,
            "closingDate": closing_date
        }
        
        variables = {
            "accountId": self.account_id,
            "input": item_input
        }
        
        result = self._management_request(query, variables)
        return result["data"]["addItemToSale"]
    
    def create_item_for_sale(self, sale_id: str, title: str, description: str,
                             starting_bid: int, reserve: Optional[int] = None,
                             open_date: str = None, closing_date: str = None) -> Dict[str, Any]:
        """
        Create an item and add it to a sale in one operation.
        
        Args:
            sale_id: Parent sale ID
            title: Item title
            description: Item description
            starting_bid: Starting bid in cents
            reserve: Reserve price in cents (optional)
            open_date: ISO 8601 timestamp for when bidding opens
            closing_date: ISO 8601 timestamp for when closing begins
        
        Returns:
            Item data including id, status, and dates
        """
        query = """
        mutation CreateItemForSale($accountId: String!, $input: SaleItemInput!) {
          createItemForSale(accountId: $accountId, input: $input) {
            id
            title
            status
            dates {
              openDate
              closingStart
              closingEnd
            }
          }
        }
        """
        
        item_input = {
            "saleId": sale_id,
            "title": title,
            "description": description,
            "startingBid": starting_bid,
            "allowedBidTypes": ["MAX"]
        }
        
        if reserve:
            item_input["reserve"] = reserve
        if open_date:
            item_input["openDate"] = open_date
        if closing_date:
            item_input["closingDate"] = closing_date
        
        variables = {
            "accountId": self.account_id,
            "input": item_input
        }
        
        result = self._management_request(query, variables)
        return result["data"]["createItemForSale"]
    
    def add_item(self, sale_id: str, title: str, description: str,
                 starting_bid: int, reserve: Optional[int] = None,
                 open_date: str = None, closing_date: str = None) -> Dict[str, Any]:
        """
        DEPRECATED: Use create_item_for_sale instead.
        
        Add an item to a sale (creates item and adds to sale in one operation).
        
        Args:
            sale_id: Parent sale ID
            title: Item title
            description: Item description
            starting_bid: Starting bid in cents
            reserve: Reserve price in cents (optional)
            open_date: ISO 8601 timestamp for when bidding opens
            closing_date: ISO 8601 timestamp for when closing begins
        
        Returns:
            Item data including id, status, and dates
        """
        return self.create_item_for_sale(
            sale_id=sale_id,
            title=title,
            description=description,
            starting_bid=starting_bid,
            reserve=reserve,
            open_date=open_date,
            closing_date=closing_date
        )
    
    def publish_sale(self, sale_id: str) -> Dict[str, Any]:
        """
        Publish a sale to make it live.
        
        Args:
            sale_id: Sale ID to publish
        
        Returns:
            Sale data with updated status
        """
        query = """
        mutation PublishSale($accountId: String!, $input: PublishSaleInput!) {
          publishSale(accountId: $accountId, input: $input) {
            id
            status
          }
        }
        """
        
        variables = {
            "accountId": self.account_id,
            "input": {"saleId": sale_id}
        }
        
        result = self._management_request(query, variables)
        return result["data"]["publishSale"]
    
    def create_bidder_token(self, user_id: str, ttl_minutes: int = 60) -> Dict[str, Any]:
        """
        Generate a bidder token.
        
        Args:
            user_id: User identifier
            ttl_minutes: Token validity in minutes
        
        Returns:
            Dict with 'token' and 'expiration'
        """
        query = """
        mutation CreateToken($accountId: String!, $input: CreateBidderTokenInput!) {
          createBidderToken(accountId: $accountId, input: $input) {
            token
            expiration
          }
        }
        """
        
        variables = {
            "accountId": self.account_id,
            "input": {
                "metadata": {
                    "userId": user_id,
                    "ttl": ttl_minutes
                }
            }
        }
        
        result = self._management_request(query, variables)
        return result["data"]["createBidderToken"]
    
    def get_sale(self, sale_id: str, include_items: bool = True) -> Dict[str, Any]:
        """
        Get sale details.
        
        Args:
            sale_id: Sale ID
            include_items: Whether to include item details
        
        Returns:
            Sale data
        """
        items_fragment = """
        items {
          edges {
            node {
              id
              title
              status
              currentBid
              bidCount
            }
          }
        }
        """ if include_items else ""
        
        query = f"""
        query GetSale($accountId: String!, $id: ID!) {{
          sale(accountId: $accountId, id: $id) {{
            id
            title
            status
            {items_fragment}
          }}
        }}
        """
        
        variables = {
            "accountId": self.account_id,
            "id": sale_id
        }
        
        result = self._management_request(query, variables)
        return result["data"]["sale"]
    
    def place_bid(self, sale_id: str, item_id: str, amount: int, 
                  bidder_token: str, bid_type: str = "MAX") -> Dict[str, Any]:
        """
        Place a bid on an item (Client API).
        
        Args:
            sale_id: Sale ID
            item_id: Item ID
            amount: Bid amount in cents
            bidder_token: Valid bidder JWT token
            bid_type: "MAX" (proxy bidding) or "NORMAL" (direct bid)
        
        Returns:
            Bid result (success or error)
        """
        query = """
        mutation PlaceBid($saleId: ID!, $itemId: ID!, $amount: Int!, $type: BidType!) {
          bidOnItem(saleId: $saleId, itemId: $itemId, amount: $amount, type: $type) {
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
        """
        
        variables = {
            "saleId": sale_id,
            "itemId": item_id,
            "amount": amount,
            "type": bid_type
        }
        
        result = self._client_request(query, variables, bidder_token)
        return result["data"]["bidOnItem"]


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = BastaClient(
        account_id=os.getenv("BASTA_ACCOUNT_ID"),
        api_key=os.getenv("BASTA_API_KEY")
    )
    
    # Create a sale
    sale = client.create_sale(
        title="Test Auction",
        description="Testing Basta API"
    )
    print(f"Created sale: {sale['id']}")
    
    # Add an item
    item = client.add_item(
        sale_id=sale["id"],
        title="Test Item",
        description="A test item",
        starting_bid=1000,  # $10
        reserve=5000  # $50
    )
    print(f"Added item: {item['id']}")
    
    # Publish the sale
    published = client.publish_sale(sale["id"])
    print(f"Published sale, status: {published['status']}")
    
    # Generate bidder token
    token_data = client.create_bidder_token("user_123", ttl_minutes=30)
    print(f"Created bidder token (expires: {token_data['expiration']})")
