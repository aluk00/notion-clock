#!/usr/bin/env python3
"""
Make.com Scenario Module Builder
================================
This script automates adding modules to a Make.com scenario via the API.

It adds 4 modules to each of 6 routes:
1. Create Edit Task (Notion)
2. Create Thumbnail Task (Notion)
3. Sync Edit to Firebase (HTTP)
4. Sync Thumbnail to Firebase (HTTP)

Usage:
    1. Fill in the CONFIGURATION section below
    2. Run with --dry-run first to preview: python make_scenario_builder.py --dry-run
    3. Run without flag to execute: python make_scenario_builder.py
"""

import argparse
import json
import os
import sys
import time
from typing import Any

import requests

# =============================================================================
# CONFIGURATION
# =============================================================================

# Make.com API token
API_TOKEN = os.environ.get("MAKE_API_TOKEN", "c0b114a4-034d-417f-ac80-46b6e89f2f82")

# Scenario ID (from URL: https://us1.make.com/scenarios/4205682)
SCENARIO_ID = os.environ.get("MAKE_SCENARIO_ID", "4205682")

# Notion Connection ID (found in existing Notion modules)
NOTION_CONNECTION_ID = os.environ.get("MAKE_NOTION_CONNECTION_ID", "4706454")

# HTTP connection (not needed for HTTP modules)
HTTP_CONNECTION_ID = os.environ.get("MAKE_HTTP_CONNECTION_ID", "")

# Notion Data Source ID (DMG New Media | Master Projects & Production Data Ledger)
NOTION_DATA_SOURCE_ID = os.environ.get("MAKE_NOTION_DATA_SOURCE_ID", "2eb950e6-ee58-81c7-953c-000b6ae77c74")

# =============================================================================
# ROUTE CONFIGURATION
# =============================================================================

ROUTES = {
    "MAIN": {
        "episode_module_id": 3,
        "insert_after_module_id": 4,  # Update Daily Rundown module
    },
    "SPORT": {
        "episode_module_id": 5,
        "insert_after_module_id": 6,
    },
    "RESPAWN": {
        "episode_module_id": 7,
        "insert_after_module_id": 8,
    },
    "MONEY": {
        "episode_module_id": 9,
        "insert_after_module_id": 10,
    },
    "SPOTLIGHT": {
        "episode_module_id": 11,
        "insert_after_module_id": 12,
    },
    "UK": {
        "episode_module_id": 16,
        "insert_after_module_id": 17,
    },
}

# =============================================================================
# API CONFIGURATION
# =============================================================================

BASE_URL = "https://eu1.make.com/api/v2"


class MakeComClient:
    """Client for interacting with Make.com API."""

    def __init__(self, api_token: str, dry_run: bool = True):
        self.api_token = api_token
        self.dry_run = dry_run
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Token {api_token}",
            "Content-Type": "application/json",
        })
        self._next_mock_id = 101  # For dry-run mode

    def _request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        retries: int = 4,
    ) -> dict[str, Any]:
        """Make an API request with retry logic."""
        url = f"{BASE_URL}{endpoint}"

        for attempt in range(retries):
            try:
                if method == "GET":
                    response = self.session.get(url, timeout=30)
                elif method == "POST":
                    response = self.session.post(url, json=data, timeout=30)
                elif method == "PATCH":
                    response = self.session.patch(url, json=data, timeout=30)
                else:
                    raise ValueError(f"Unsupported method: {method}")

                response.raise_for_status()
                return response.json()

            except requests.exceptions.RequestException as e:
                if attempt < retries - 1:
                    wait_time = 2 ** (attempt + 1)  # 2, 4, 8, 16 seconds
                    print(f"  ⚠️  Request failed, retrying in {wait_time}s... ({e})")
                    time.sleep(wait_time)
                else:
                    raise

        return {}

    def get_scenario(self, scenario_id: str) -> dict[str, Any]:
        """Get the current scenario structure."""
        print(f"\n📋 Fetching scenario {scenario_id}...")

        if self.dry_run:
            print("  [DRY-RUN] Would fetch scenario structure")
            return {"scenario": {"id": scenario_id, "name": "Mock Scenario"}}

        return self._request("GET", f"/scenarios/{scenario_id}")

    def get_scenario_blueprint(self, scenario_id: str) -> dict[str, Any]:
        """Get the scenario blueprint (detailed module structure)."""
        print(f"\n📋 Fetching scenario blueprint...")

        if self.dry_run:
            print("  [DRY-RUN] Would fetch scenario blueprint")
            return {}

        return self._request("GET", f"/scenarios/{scenario_id}/blueprint")

    def create_module(
        self,
        scenario_id: str,
        module_config: dict[str, Any],
        description: str,
    ) -> dict[str, Any]:
        """Create a new module in the scenario."""
        if self.dry_run:
            mock_id = self._next_mock_id
            self._next_mock_id += 1
            print(f"  [DRY-RUN] Would create: {description}")
            print(f"            Mock ID: {mock_id}")
            print(f"            Config: {json.dumps(module_config, indent=2)[:200]}...")
            return {"module": {"id": mock_id}}

        print(f"  Creating: {description}")
        result = self._request(
            "POST",
            f"/scenarios/{scenario_id}/modules",
            data=module_config,
        )
        print(f"  ✓ Created with ID: {result.get('module', {}).get('id')}")
        return result

    def update_scenario_blueprint(
        self,
        scenario_id: str,
        blueprint: dict[str, Any],
    ) -> dict[str, Any]:
        """Update the entire scenario blueprint."""
        if self.dry_run:
            print("  [DRY-RUN] Would update scenario blueprint")
            return {"scenario": {"id": scenario_id}}

        print("  Updating scenario blueprint...")
        return self._request(
            "PATCH",
            f"/scenarios/{scenario_id}/blueprint",
            data={"blueprint": blueprint},
        )


def build_edit_task_module(
    route_name: str,
    episode_module_id: int,
    connection_id: str,
    data_source_id: str,
) -> dict[str, Any]:
    """Build configuration for a 'Create Edit Task' Notion module."""
    return {
        "module": "notion:createDatabaseItem",
        "version": 3,
        "metadata": {
            "designer": {
                "name": f"Create Edit Task - {route_name}",
            },
        },
        "parameters": {
            "__IMTCONN__": connection_id,
        },
        "mapper": {
            "database": data_source_id,
            "NAME": f"📹 Edit – {{{{{{{1}}}.properties_value.TITLE[].text.content}}}}",
            "PARENT_ITEM": f"{{{{{{{episode_module_id}}}.id}}}}",
            "DUE_DATE_START": "{{1.properties_value.PLANNED LIVE DATE.start}}",
            "DUE_DATE_INCLUDE_TIME": False,
            "STATUS": "Not Started",
            "DISCIPLINE": "Editor",
        },
    }


def build_thumbnail_task_module(
    route_name: str,
    episode_module_id: int,
    connection_id: str,
    data_source_id: str,
) -> dict[str, Any]:
    """Build configuration for a 'Create Thumbnail Task' Notion module."""
    return {
        "module": "notion:createDatabaseItem",
        "version": 3,
        "metadata": {
            "designer": {
                "name": f"Create Thumbnail Task - {route_name}",
            },
        },
        "parameters": {
            "__IMTCONN__": connection_id,
        },
        "mapper": {
            "database": data_source_id,
            "NAME": f"🎨 Thumbnail – {{{{{{{1}}}.properties_value.TITLE[].text.content}}}}",
            "PARENT_ITEM": f"{{{{{{{episode_module_id}}}.id}}}}",
            "DUE_DATE_START": "{{1.properties_value.PLANNED LIVE DATE.start}}",
            "DUE_DATE_INCLUDE_TIME": False,
            "STATUS": "Not Started",
            "DISCIPLINE": "Design",
        },
    }


def build_sync_edit_module(
    route_name: str,
    episode_module_id: int,
    edit_module_id: int | str,
) -> dict[str, Any]:
    """Build configuration for a 'Sync Edit to Firebase' HTTP module."""
    # Use placeholder if we don't have the actual ID yet
    edit_ref = f"{{{{{{{edit_module_id}}}}}}}" if isinstance(edit_module_id, int) else edit_module_id

    body = {
        "notionId": f"{edit_ref}.id",
        "type": "edit",
        "episodeId": f"{{{{{{{episode_module_id}}}.id}}}}",
        "title": f"📹 Edit – {{{{{{{1}}}.properties_value.TITLE[].text.content}}}}",
        "discipline": "Editor",
        "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
        "vertical": route_name,
        "status": "Not Started",
        "notionUrl": f"{edit_ref}.url",
        "createdAt": "{{now}}",
    }

    return {
        "module": "http:ActionSendData",
        "version": 3,
        "metadata": {
            "designer": {
                "name": f"Sync Edit to Firebase - {route_name}",
            },
        },
        "parameters": {},
        "mapper": {
            "url": "https://createnotionproject-223535956454.us-central1.run.app/sync-to-firebase",
            "method": "POST",
            "headers": [
                {"name": "Content-Type", "value": "application/json"},
            ],
            "qs": [],
            "bodyType": "raw",
            "contentType": "application/json",
            "body": json.dumps(body),
            "followAllRedirects": True,
            "followRedirect": True,
            "timeout": "",
            "shareCookies": False,
            "rejectUnauthorized": True,
        },
    }


def build_sync_thumbnail_module(
    route_name: str,
    episode_module_id: int,
    thumbnail_module_id: int | str,
) -> dict[str, Any]:
    """Build configuration for a 'Sync Thumbnail to Firebase' HTTP module."""
    # Use placeholder if we don't have the actual ID yet
    thumb_ref = f"{{{{{{{thumbnail_module_id}}}}}}}" if isinstance(thumbnail_module_id, int) else thumbnail_module_id

    body = {
        "notionId": f"{thumb_ref}.id",
        "type": "design",
        "episodeId": f"{{{{{{{episode_module_id}}}.id}}}}",
        "title": f"🎨 Thumbnail – {{{{{{{1}}}.properties_value.TITLE[].text.content}}}}",
        "discipline": "Design",
        "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
        "vertical": route_name,
        "status": "Not Started",
        "notionUrl": f"{thumb_ref}.url",
        "createdAt": "{{now}}",
    }

    return {
        "module": "http:ActionSendData",
        "version": 3,
        "metadata": {
            "designer": {
                "name": f"Sync Thumbnail to Firebase - {route_name}",
            },
        },
        "parameters": {},
        "mapper": {
            "url": "https://createnotionproject-223535956454.us-central1.run.app/sync-to-firebase",
            "method": "POST",
            "headers": [
                {"name": "Content-Type", "value": "application/json"},
            ],
            "qs": [],
            "bodyType": "raw",
            "contentType": "application/json",
            "body": json.dumps(body),
            "followAllRedirects": True,
            "followRedirect": True,
            "timeout": "",
            "shareCookies": False,
            "rejectUnauthorized": True,
        },
    }


def process_route(
    client: MakeComClient,
    scenario_id: str,
    route_name: str,
    route_config: dict[str, Any],
) -> list[int]:
    """Process a single route, adding all 4 modules."""
    print(f"\n{'='*60}")
    print(f"🛤️  Processing route: {route_name}")
    print(f"{'='*60}")

    episode_id = route_config["episode_module_id"]
    created_ids = []

    # Module 1: Create Edit Task
    edit_config = build_edit_task_module(
        route_name=route_name,
        episode_module_id=episode_id,
        connection_id=NOTION_CONNECTION_ID,
        data_source_id=NOTION_DATA_SOURCE_ID,
    )
    result = client.create_module(
        scenario_id,
        edit_config,
        f"Create Edit Task ({route_name})",
    )
    edit_module_id = result.get("module", {}).get("id", f"EDIT_{route_name}")
    created_ids.append(edit_module_id)

    # Module 2: Create Thumbnail Task
    thumb_config = build_thumbnail_task_module(
        route_name=route_name,
        episode_module_id=episode_id,
        connection_id=NOTION_CONNECTION_ID,
        data_source_id=NOTION_DATA_SOURCE_ID,
    )
    result = client.create_module(
        scenario_id,
        thumb_config,
        f"Create Thumbnail Task ({route_name})",
    )
    thumb_module_id = result.get("module", {}).get("id", f"THUMB_{route_name}")
    created_ids.append(thumb_module_id)

    # Module 3: Sync Edit to Firebase
    sync_edit_config = build_sync_edit_module(
        route_name=route_name,
        episode_module_id=episode_id,
        edit_module_id=edit_module_id,
    )
    result = client.create_module(
        scenario_id,
        sync_edit_config,
        f"Sync Edit to Firebase ({route_name})",
    )
    created_ids.append(result.get("module", {}).get("id", f"SYNC_EDIT_{route_name}"))

    # Module 4: Sync Thumbnail to Firebase
    sync_thumb_config = build_sync_thumbnail_module(
        route_name=route_name,
        episode_module_id=episode_id,
        thumbnail_module_id=thumb_module_id,
    )
    result = client.create_module(
        scenario_id,
        sync_thumb_config,
        f"Sync Thumbnail to Firebase ({route_name})",
    )
    created_ids.append(result.get("module", {}).get("id", f"SYNC_THUMB_{route_name}"))

    return created_ids


def validate_config() -> list[str]:
    """Validate that all required configuration is set."""
    errors = []

    if API_TOKEN == "YOUR_API_TOKEN_HERE" or not API_TOKEN:
        errors.append("API_TOKEN is not configured")

    if SCENARIO_ID == "YOUR_SCENARIO_ID_HERE" or not SCENARIO_ID:
        errors.append("SCENARIO_ID is not configured")

    if NOTION_CONNECTION_ID == "YOUR_NOTION_CONNECTION_ID_HERE" or not NOTION_CONNECTION_ID:
        errors.append("NOTION_CONNECTION_ID is not configured")

    if NOTION_DATA_SOURCE_ID == "YOUR_NOTION_DATA_SOURCE_ID_HERE" or not NOTION_DATA_SOURCE_ID:
        errors.append("NOTION_DATA_SOURCE_ID is not configured")

    return errors


def fetch_and_display_scenario_info(client: MakeComClient, scenario_id: str) -> None:
    """Fetch scenario info and display connection IDs to help user configure."""
    print("\n" + "="*60)
    print("📋 SCENARIO INSPECTION MODE")
    print("="*60)
    print("\nFetching your scenario to find connection IDs...")

    try:
        # Get scenario details
        scenario = client._request("GET", f"/scenarios/{scenario_id}")
        print(f"\n✓ Scenario: {scenario.get('scenario', {}).get('name', 'Unknown')}")

        # Get blueprint for module details
        blueprint = client._request("GET", f"/scenarios/{scenario_id}/blueprint")

        if blueprint:
            print("\n📦 Found modules in scenario:")
            print("-" * 40)

            modules = blueprint.get("blueprint", {}).get("flow", [])

            for module in modules:
                if isinstance(module, dict):
                    mod_id = module.get("id", "?")
                    mod_name = module.get("module", "?")
                    mod_label = module.get("metadata", {}).get("designer", {}).get("name", "")

                    print(f"  ID: {mod_id:4} | {mod_name}")
                    if mod_label:
                        print(f"         └─ {mod_label}")

                    # Check for connection info
                    params = module.get("parameters", {})
                    if "__IMTCONN__" in params:
                        print(f"         └─ Connection ID: {params['__IMTCONN__']}")

            print("-" * 40)
            print("\n💡 Use the connection IDs above to configure this script.")
            print("   Look for existing Notion modules to find NOTION_CONNECTION_ID")

    except Exception as e:
        print(f"\n❌ Error fetching scenario: {e}")
        print("\nMake sure your API_TOKEN and SCENARIO_ID are correct.")


def main():
    parser = argparse.ArgumentParser(
        description="Add modules to Make.com scenario via API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python make_scenario_builder.py --dry-run     Preview changes without executing
  python make_scenario_builder.py               Execute and create modules
  python make_scenario_builder.py --inspect     Fetch scenario info to find connection IDs
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be created without making API calls",
    )
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Fetch and display scenario structure to help find connection IDs",
    )
    args = parser.parse_args()

    print("="*60)
    print("🔧 Make.com Scenario Module Builder")
    print("="*60)

    # For inspect mode, we only need API token and scenario ID
    if args.inspect:
        if API_TOKEN == "YOUR_API_TOKEN_HERE" or SCENARIO_ID == "YOUR_SCENARIO_ID_HERE":
            print("\n❌ Configuration Error:")
            print("   Set API_TOKEN and SCENARIO_ID before using --inspect mode")
            sys.exit(1)

        client = MakeComClient(API_TOKEN, dry_run=False)
        fetch_and_display_scenario_info(client, SCENARIO_ID)
        sys.exit(0)

    # Validate configuration
    errors = validate_config()
    if errors and not args.dry_run:
        print("\n❌ Configuration Errors:")
        for error in errors:
            print(f"   - {error}")
        print("\n💡 Tip: Run with --inspect to fetch your scenario and find connection IDs")
        print("   Or run with --dry-run to preview the module configurations")
        sys.exit(1)

    if args.dry_run:
        print("\n🔍 DRY-RUN MODE - No API calls will be made")
        print("   This will show you what would be created.\n")
    else:
        print("\n⚡ LIVE MODE - Modules will be created!")
        confirm = input("   Type 'yes' to continue: ")
        if confirm.lower() != "yes":
            print("   Aborted.")
            sys.exit(0)

    # Initialize client
    client = MakeComClient(API_TOKEN, dry_run=args.dry_run)

    # Get current scenario structure
    client.get_scenario(SCENARIO_ID)

    # Process each route
    results = {}
    total_created = 0

    for route_name, route_config in ROUTES.items():
        try:
            created_ids = process_route(client, SCENARIO_ID, route_name, route_config)
            results[route_name] = created_ids
            total_created += len(created_ids)
            print(f"\n✅ {route_name} route: Created modules {', '.join(map(str, created_ids))}")
        except Exception as e:
            print(f"\n❌ {route_name} route: Failed - {e}")
            results[route_name] = []

    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)

    for route_name, module_ids in results.items():
        if module_ids:
            print(f"✅ {route_name:12} → Modules: {', '.join(map(str, module_ids))}")
        else:
            print(f"❌ {route_name:12} → Failed")

    print(f"\n🎉 Total modules {'would be ' if args.dry_run else ''}created: {total_created}")

    if args.dry_run:
        print("\n💡 Run without --dry-run to execute these changes.")


if __name__ == "__main__":
    main()
