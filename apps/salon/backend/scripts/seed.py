#!/usr/bin/env python3
"""
Seed script to populate the database with test data.

Usage:
    python scripts/seed.py

This creates:
- 1 salon (Demo Salon)
- 1 admin user (admin@demo.com / password123)
- 4 staff members
- 2 service categories with 6 services
- 5 test clients
"""

import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import get_password_hash


MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "salon_booking")


async def seed_database():
    """Seed the database with test data."""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DATABASE]

    print(f"Connected to MongoDB: {MONGODB_URL}/{MONGODB_DATABASE}")

    # Check if already seeded
    existing_salon = await db.salons.find_one({"slug": "demo-salon"})
    if existing_salon:
        print("\n⚠️  Database already seeded!")
        print(f"   Salon ID: {existing_salon['_id']}")
        print("   Login: admin@demo.com / password123")
        print("\n   To reset, run: python scripts/seed.py --reset")

        if len(sys.argv) > 1 and sys.argv[1] == "--reset":
            print("\n🗑️  Resetting database...")
            await db.salons.delete_many({})
            await db.users.delete_many({})
            await db.staff.delete_many({})
            await db.services.delete_many({})
            await db.service_categories.delete_many({})
            await db.clients.delete_many({})
            await db.appointments.delete_many({})
            print("   Done! Run again without --reset to seed.")

        client.close()
        return

    now = datetime.now(timezone.utc)

    # ============================================
    # 1. Create Salon
    # ============================================
    print("\n📍 Creating salon...")

    salon_id = ObjectId()
    salon = {
        "_id": salon_id,
        "name": "Demo Salon & Spa",
        "slug": "demo-salon",
        "email": "hello@demosalon.com",
        "phone": "(555) 123-4567",
        "address": "123 Main Street",
        "city": "New York",
        "state": "NY",
        "zip_code": "10001",
        "timezone": "America/New_York",
        "stripe_account_id": None,
        "stripe_onboarding_complete": False,
        "settings": {
            "slot_duration_minutes": 15,
            "min_booking_notice_hours": 1,
            "max_booking_advance_days": 60,
            "require_deposit": True,
            "deposit_percent": 50,
            "business_hours": {
                "0": {"open": "09:00", "close": "18:00", "is_closed": False},
                "1": {"open": "09:00", "close": "18:00", "is_closed": False},
                "2": {"open": "09:00", "close": "18:00", "is_closed": False},
                "3": {"open": "09:00", "close": "18:00", "is_closed": False},
                "4": {"open": "09:00", "close": "18:00", "is_closed": False},
                "5": {"open": "09:00", "close": "17:00", "is_closed": False},
                "6": {"open": "", "close": "", "is_closed": True},
            },
            "cancellation_policy": {
                "free_cancellation_hours": 24,
                "late_cancellation_fee_percent": 50,
                "no_show_fee_percent": 100,
                "no_show_window_minutes": 15,
            },
        },
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.salons.insert_one(salon)
    print(f"   ✓ Created: {salon['name']} (ID: {salon_id})")

    # ============================================
    # 2. Create Admin User
    # ============================================
    print("\n👤 Creating admin user...")

    user_id = ObjectId()
    user = {
        "_id": user_id,
        "salon_id": salon_id,
        "email": "admin@demo.com",
        "password_hash": get_password_hash("password123"),
        "first_name": "Admin",
        "last_name": "User",
        "role": "owner",
        "staff_id": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user)
    print(f"   ✓ Created: {user['email']} (password: password123)")

    # ============================================
    # 3. Create Staff Members
    # ============================================
    print("\n💇 Creating staff members...")

    staff_data = [
        {"first_name": "Sarah", "last_name": "Johnson", "color": "#D4A5A5", "email": "sarah@demosalon.com"},
        {"first_name": "Michael", "last_name": "Chen", "color": "#C9A86C", "email": "michael@demosalon.com"},
        {"first_name": "Emma", "last_name": "Williams", "color": "#A8C5A8", "email": "emma@demosalon.com"},
        {"first_name": "James", "last_name": "Brown", "color": "#8BB8D0", "email": "james@demosalon.com"},
    ]

    staff_ids = []
    for i, s in enumerate(staff_data):
        staff_id = ObjectId()
        staff_ids.append(staff_id)
        staff = {
            "_id": staff_id,
            "salon_id": salon_id,
            "first_name": s["first_name"],
            "last_name": s["last_name"],
            "email": s["email"],
            "phone": f"(555) 100-{1000 + i}",
            "display_name": s["first_name"],
            "color": s["color"],
            "avatar_url": None,
            "working_hours": {
                "schedule": {
                    "0": {"is_working": True, "slots": [{"start": "09:00", "end": "17:00"}]},
                    "1": {"is_working": True, "slots": [{"start": "09:00", "end": "17:00"}]},
                    "2": {"is_working": True, "slots": [{"start": "09:00", "end": "17:00"}]},
                    "3": {"is_working": True, "slots": [{"start": "09:00", "end": "17:00"}]},
                    "4": {"is_working": True, "slots": [{"start": "09:00", "end": "17:00"}]},
                    "5": {"is_working": i % 2 == 0, "slots": [{"start": "09:00", "end": "14:00"}] if i % 2 == 0 else []},
                    "6": {"is_working": False, "slots": []},
                }
            },
            "is_active": True,
            "service_ids": [],  # Will update after services created
            "sort_order": i,
            "created_at": now,
            "updated_at": now,
        }
        await db.staff.insert_one(staff)
        print(f"   ✓ Created: {s['first_name']} {s['last_name']}")

    # ============================================
    # 4. Create Service Categories & Services
    # ============================================
    print("\n✂️  Creating services...")

    # Categories
    cat_hair_id = ObjectId()
    cat_spa_id = ObjectId()

    categories = [
        {"_id": cat_hair_id, "salon_id": salon_id, "name": "Hair Services", "description": "Cuts, color, and styling", "sort_order": 0, "is_active": True, "created_at": now, "updated_at": now},
        {"_id": cat_spa_id, "salon_id": salon_id, "name": "Spa Services", "description": "Relaxation and wellness", "sort_order": 1, "is_active": True, "created_at": now, "updated_at": now},
    ]
    await db.service_categories.insert_many(categories)

    # Services
    services_data = [
        {"name": "Haircut", "category_id": cat_hair_id, "duration": 30, "price": 4500, "description": "Professional haircut and style"},
        {"name": "Color", "category_id": cat_hair_id, "duration": 90, "price": 12000, "description": "Full color treatment"},
        {"name": "Highlights", "category_id": cat_hair_id, "duration": 120, "price": 15000, "description": "Partial or full highlights"},
        {"name": "Blowout", "category_id": cat_hair_id, "duration": 45, "price": 5500, "description": "Wash and blow dry styling"},
        {"name": "Facial", "category_id": cat_spa_id, "duration": 60, "price": 8500, "description": "Deep cleansing facial treatment"},
        {"name": "Massage", "category_id": cat_spa_id, "duration": 60, "price": 9500, "description": "Relaxing full body massage"},
    ]

    service_ids = []
    for i, s in enumerate(services_data):
        service_id = ObjectId()
        service_ids.append(service_id)
        service = {
            "_id": service_id,
            "salon_id": salon_id,
            "category_id": s["category_id"],
            "name": s["name"],
            "description": s["description"],
            "duration_minutes": s["duration"],
            "buffer_minutes": 10,
            "price": s["price"],
            "deposit_override": None,
            "color": None,
            "sort_order": i,
            "is_active": True,
            "eligible_staff_ids": staff_ids,  # All staff can do all services
            "created_at": now,
            "updated_at": now,
        }
        await db.services.insert_one(service)
        print(f"   ✓ Created: {s['name']} (${s['price']/100:.2f})")

    # Update staff with service IDs
    await db.staff.update_many(
        {"salon_id": salon_id},
        {"$set": {"service_ids": service_ids}}
    )

    # ============================================
    # 5. Create Test Clients
    # ============================================
    print("\n👥 Creating test clients...")

    clients_data = [
        {"first_name": "Alice", "last_name": "Martinez", "phone": "(555) 200-1001", "email": "alice@example.com"},
        {"first_name": "Bob", "last_name": "Thompson", "phone": "(555) 200-1002", "email": "bob@example.com"},
        {"first_name": "Carol", "last_name": "Davis", "phone": "(555) 200-1003", "email": None},
        {"first_name": "David", "last_name": "Wilson", "phone": "(555) 200-1004", "email": "david@example.com"},
        {"first_name": "Eva", "last_name": "Garcia", "phone": "(555) 200-1005", "email": "eva@example.com"},
    ]

    for c in clients_data:
        client = {
            "_id": ObjectId(),
            "salon_id": salon_id,
            "first_name": c["first_name"],
            "last_name": c["last_name"],
            "email": c["email"],
            "phone": c["phone"],
            "notes": None,
            "preferences": None,
            "tags": [],
            "stats": {
                "total_appointments": 0,
                "completed_appointments": 0,
                "cancelled_appointments": 0,
                "no_shows": 0,
                "total_spent": 0,
                "last_visit": None,
            },
            "stripe_customer_id": None,
            "created_at": now,
            "updated_at": now,
        }
        await db.clients.insert_one(client)
        print(f"   ✓ Created: {c['first_name']} {c['last_name']}")

    # ============================================
    # Done!
    # ============================================
    print("\n" + "=" * 50)
    print("✅ Database seeded successfully!")
    print("=" * 50)
    print(f"\n🔐 Login credentials:")
    print(f"   Email:    admin@demo.com")
    print(f"   Password: password123")
    print(f"\n🌐 URLs:")
    print(f"   Frontend: http://localhost:5173")
    print(f"   Backend:  http://localhost:8000")
    print(f"   API Docs: http://localhost:8000/docs")
    print()

    client.close()


if __name__ == "__main__":
    asyncio.run(seed_database())
