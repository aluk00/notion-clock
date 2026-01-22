#!/usr/bin/env python3
"""
Deal Agreed Automation Script

When a deal reaches "Deal Agreed" status (or Won + In Progress),
this script parses the AGREED CONTENT DELIVERABLES and creates:
- Layer 2 Episodes (linked to the deal via PARENT ITEM)
- Layer 3 Tasks (Edit + Thumbnail, linked to each episode)

Run with: python deal_agreed_automation.py
Schedule with cron for automatic processing every 10-15 minutes.
"""

import os
import re
import json
import requests
from datetime import datetime

# Configuration - Set NOTION_API_KEY environment variable before running
NOTION_API_KEY = os.environ.get('NOTION_API_KEY')
MASTER_LEDGER_DB = '2eb950e6-ee58-81c7-953c-000b6ae77c74'

if not NOTION_API_KEY:
    print("ERROR: NOTION_API_KEY environment variable not set!")
    print("Run with: NOTION_API_KEY=your_key python deal_agreed_automation.py")
    exit(1)

# Notion API base URL
NOTION_API_BASE = 'https://api.notion.com/v1'
NOTION_VERSION = '2022-06-28'

# Headers for Notion API
headers = {
    'Authorization': f'Bearer {NOTION_API_KEY}',
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION
}

# Track processed items to avoid duplicates
PROCESSED_FILE = 'processed_deals.json'


def load_processed_deals():
    """Load list of already processed deal IDs."""
    if os.path.exists(PROCESSED_FILE):
        with open(PROCESSED_FILE, 'r') as f:
            return json.load(f)
    return []


def save_processed_deals(processed):
    """Save list of processed deal IDs."""
    with open(PROCESSED_FILE, 'w') as f:
        json.dump(processed, f, indent=2)


def get_property_value(properties, prop_name):
    """Extract value from a Notion property."""
    prop = properties.get(prop_name)
    if not prop:
        return None

    prop_type = prop.get('type')

    if prop_type == 'title':
        return prop['title'][0]['plain_text'] if prop['title'] else ''
    elif prop_type == 'rich_text':
        return prop['rich_text'][0]['plain_text'] if prop['rich_text'] else ''
    elif prop_type == 'select':
        return prop['select']['name'] if prop['select'] else None
    elif prop_type == 'status':
        return prop['status']['name'] if prop['status'] else None
    elif prop_type == 'number':
        return prop['number']
    elif prop_type == 'relation':
        return [r['id'] for r in prop['relation']] if prop['relation'] else []
    elif prop_type == 'date':
        return prop['date']['start'] if prop['date'] else None

    return None


def query_deals_needing_episodes():
    """Query Master Ledger for deals that need episodes created."""

    # Build filter: (DEAL STAGE = "Deal Agreed") OR (PROJECT OUTCOME = "Won" AND PROJECT STATUS = "In progress")
    # AND AGREED CONTENT DELIVERABLES is not empty

    filter_payload = {
        "and": [
            {
                "or": [
                    {
                        "property": "DEAL STAGE",
                        "select": {"equals": "Deal Agreed"}
                    },
                    {
                        "and": [
                            {
                                "property": "PROJECT OUTCOME",
                                "select": {"equals": "Won"}
                            },
                            {
                                "property": "PROJECT STATUS",
                                "status": {"equals": "In progress"}
                            }
                        ]
                    }
                ]
            },
            {
                "property": "AGREED CONTENT DELIVERABLES (FOR AI)",
                "rich_text": {"is_not_empty": True}
            }
        ]
    }

    url = f'{NOTION_API_BASE}/databases/{MASTER_LEDGER_DB}/query'

    response = requests.post(url, headers=headers, json={"filter": filter_payload})

    if response.status_code != 200:
        print(f"Error querying database: {response.status_code}")
        print(response.text)
        return []

    return response.json().get('results', [])


def parse_deliverables(deliverables_text):
    """
    Parse deliverables text like:
    3x Love Notes episodes
    2x Trailer cuts
    1x Event recap video

    Returns list of tuples: [(count, description), ...]
    """
    if not deliverables_text:
        return []

    deliverables = []
    lines = deliverables_text.strip().split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Match pattern: "Nx description" or "N x description"
        match = re.match(r'^(\d+)\s*x\s+(.+)$', line, re.IGNORECASE)
        if match:
            count = int(match.group(1))
            description = match.group(2).strip()
            deliverables.append((count, description))
        else:
            # If no pattern match, treat as 1x item
            deliverables.append((1, line))

    return deliverables


def create_notion_page(database_id, properties):
    """Create a new page in a Notion database."""
    url = f'{NOTION_API_BASE}/pages'

    payload = {
        "parent": {"database_id": database_id},
        "properties": properties
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        print(f"Error creating page: {response.status_code}")
        print(response.text)
        return None

    return response.json()


def create_episode(deal_id, deal_name, episode_name, episode_number):
    """Create a Layer 2 Episode linked to the deal."""

    # Episode name format: "Deal Name - Episode Description #N"
    full_name = f"{deal_name} - {episode_name} #{episode_number}"

    properties = {
        "NAME": {
            "title": [{"text": {"content": full_name}}]
        },
        "PARENT ITEM": {
            "relation": [{"id": deal_id}]
        },
        "STATUS": {
            "status": {"name": "Not started"}
        }
    }

    print(f"  Creating Episode: {full_name}")
    result = create_notion_page(MASTER_LEDGER_DB, properties)

    if result:
        return result['id']
    return None


def create_task(episode_id, deal_name, episode_name, episode_number, discipline):
    """Create a Layer 3 Task (Edit or Thumbnail) linked to the episode."""

    # Task name format: "Deal Name - Episode Description #N - Discipline"
    full_name = f"{deal_name} - {episode_name} #{episode_number} - {discipline}"

    properties = {
        "NAME": {
            "title": [{"text": {"content": full_name}}]
        },
        "PARENT ITEM": {
            "relation": [{"id": episode_id}]
        },
        "DISCIPLINE": {
            "select": {"name": discipline}
        },
        "STATUS": {
            "status": {"name": "Not started"}
        }
    }

    print(f"    Creating Task: {full_name}")
    result = create_notion_page(MASTER_LEDGER_DB, properties)

    return result


def process_deal(deal):
    """Process a single deal - create episodes and tasks."""

    deal_id = deal['id']
    properties = deal['properties']

    deal_name = get_property_value(properties, 'NAME')
    deliverables_text = get_property_value(properties, 'AGREED CONTENT DELIVERABLES (FOR AI)')

    print(f"\nProcessing Deal: {deal_name}")
    print(f"  Deliverables: {deliverables_text}")

    # Parse deliverables
    deliverables = parse_deliverables(deliverables_text)

    if not deliverables:
        print("  No deliverables to process")
        return

    # Create episodes and tasks for each deliverable
    for count, description in deliverables:
        print(f"\n  Creating {count}x {description}")

        for i in range(1, count + 1):
            # Create Layer 2 Episode
            episode_id = create_episode(deal_id, deal_name, description, i)

            if episode_id:
                # Create Layer 3 Edit Task
                create_task(episode_id, deal_name, description, i, "Editor")

                # Create Layer 3 Thumbnail Task
                create_task(episode_id, deal_name, description, i, "Design")


def main():
    """Main function - query deals and process them."""

    print("=" * 60)
    print("Deal Agreed Automation")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Load already processed deals
    processed = load_processed_deals()
    print(f"Already processed: {len(processed)} deals")

    # Query deals needing episodes
    print("\nQuerying Master Ledger for deals...")
    deals = query_deals_needing_episodes()
    print(f"Found {len(deals)} deals matching criteria")

    # Filter out already processed deals
    new_deals = [d for d in deals if d['id'] not in processed]
    print(f"New deals to process: {len(new_deals)}")

    if not new_deals:
        print("\nNo new deals to process. Done!")
        return

    # Process each new deal
    for deal in new_deals:
        try:
            process_deal(deal)
            processed.append(deal['id'])
            save_processed_deals(processed)
        except Exception as e:
            print(f"Error processing deal {deal['id']}: {e}")

    print("\n" + "=" * 60)
    print("Automation complete!")
    print("=" * 60)


if __name__ == '__main__':
    main()
