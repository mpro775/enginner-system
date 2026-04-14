#!/usr/bin/env python3
"""
Create historical scheduled tasks for PM requests in Feb 2026.

This script links each preventive request (PM-202602-xxxx) to one
completed scheduled task so Scheduled Tasks screens are populated.

Idempotent behavior:
- If a task already has completedRequestId = request._id, it is updated.
- Otherwise, a new task is created.
"""

from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path
import time

from dotenv import load_dotenv
from pymongo import MongoClient


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"

ENGINEER_EMAIL = "eng.khader.babtat@restored.local"


def clean_title(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        return "مهمة وقائية مسترجعة"
    return text[:140]


def next_task_code(tasks_collection) -> str:
    prefix = "TASK-202602-"
    last = tasks_collection.find_one(
        {"taskCode": {"$regex": r"^TASK-202602-"}},
        sort=[("taskCode", -1)],
        projection={"taskCode": 1},
    )
    seq = 1
    if last and isinstance(last.get("taskCode"), str):
        parts = last["taskCode"].split("-")
        if len(parts) == 3 and parts[2].isdigit():
            seq = int(parts[2]) + 1
    return f"{prefix}{str(seq).zfill(4)}"


def main() -> int:
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(ROOT / ".env")

    mongodb_uri = os.getenv("MONGODB_URI")
    if not mongodb_uri:
        print("ERROR: MONGODB_URI is not set")
        return 1

    client = None
    last_error = None
    for attempt in range(1, 13):
        try:
            client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=20000)
            db = client.get_default_database()
            db.command("ping")
            break
        except Exception as err:  # noqa: BLE001
            last_error = err
            print(f"MongoDB connection attempt {attempt}/12 failed: {err}")
            if attempt < 12:
                time.sleep(10)
    else:
        print(f"ERROR: could not connect to MongoDB after retries: {last_error}")
        return 1

    users = db["users"]
    requests = db["maintenancerequests"]
    tasks = db["scheduledtasks"]

    engineer = users.find_one({"email": ENGINEER_EMAIL.lower()}, {"_id": 1})
    if not engineer:
        print(f"ERROR: engineer user not found: {ENGINEER_EMAIL}")
        client.close()
        return 1

    pm_requests = list(
        requests.find(
            {
                "requestCode": {"$regex": r"^PM-202602-"},
                "maintenanceType": "preventive",
                "deletedAt": None,
            },
            {
                "requestCode": 1,
                "engineerId": 1,
                "locationId": 1,
                "departmentId": 1,
                "systemId": 1,
                "machineId": 1,
                "reasonText": 1,
                "openedAt": 1,
                "closedAt": 1,
                "maintainAllComponents": 1,
                "selectedComponents": 1,
            },
            sort=[("requestCode", 1)],
        )
    )

    if not pm_requests:
        print("ERROR: no PM-202602 requests found")
        client.close()
        return 1

    created = 0
    updated = 0

    for req in pm_requests:
        opened_at = req.get("openedAt") or datetime(2026, 2, 1, 8, 0, 0)
        closed_at = req.get("closedAt") or opened_at
        scheduled_day = opened_at.day if isinstance(opened_at, datetime) else 1

        payload = {
            "title": clean_title(req.get("reasonText") or f"مهمة وقائية {req.get('requestCode') or ''}"),
            "engineerId": req.get("engineerId") or engineer["_id"],
            "locationId": req.get("locationId"),
            "departmentId": req.get("departmentId"),
            "systemId": req.get("systemId"),
            "machineId": req.get("machineId"),
            "maintainAllComponents": req.get("maintainAllComponents", True),
            "selectedComponents": req.get("selectedComponents") or [],
            "scheduledMonth": 2,
            "scheduledYear": 2026,
            "scheduledDay": int(scheduled_day),
            "description": req.get("reasonText") or "مهمة وقائية مسترجعة من تقارير شهر فبراير",
            "status": "completed",
            "completedRequestId": req["_id"],
            "completedAt": closed_at,
            "createdBy": engineer["_id"],
            "deletedAt": None,
            "deletedBy": None,
            "updatedAt": datetime.utcnow(),
        }

        existing = tasks.find_one({"completedRequestId": req["_id"]}, {"_id": 1, "taskCode": 1})
        if existing:
            tasks.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": payload,
                    "$setOnInsert": {"createdAt": opened_at},
                },
            )
            updated += 1
        else:
            payload["taskCode"] = next_task_code(tasks)
            payload["createdAt"] = opened_at
            tasks.insert_one(payload)
            created += 1

    client.close()

    print("Historical scheduled tasks sync completed")
    print(f"- PM requests found: {len(pm_requests)}")
    print(f"- Scheduled tasks created: {created}")
    print(f"- Scheduled tasks updated: {updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
