"""Notification service for handling all types of notifications."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId

from ..core.database import get_collection
from .sms_service import sms_service


class NotificationService:
    """Service for managing and sending notifications."""

    async def get_salon_settings(self, salon_id: str) -> dict:
        """Get salon notification settings."""
        salons_collection = get_collection("salons")
        salon = await salons_collection.find_one({"_id": ObjectId(salon_id)})
        if not salon:
            return {}
        return salon.get("settings", {}).get("notifications", {})

    async def schedule_appointment_reminders(self, appointment_id: str):
        """Schedule reminders for an appointment."""
        appointments_collection = get_collection("appointments")
        scheduled_notifications = get_collection("scheduled_notifications")

        appointment = await appointments_collection.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            return

        settings = await self.get_salon_settings(appointment["salon_id"])
        if not settings.get("send_reminders", True):
            return

        reminder_hours = settings.get("reminder_hours_before", [24, 2])
        appointment_time = appointment["start_time"]

        for hours in reminder_hours:
            send_at = appointment_time - timedelta(hours=hours)

            # Don't schedule if it's in the past
            if send_at < datetime.now(timezone.utc):
                continue

            await scheduled_notifications.insert_one({
                "type": "appointment_reminder",
                "appointment_id": appointment["_id"],
                "salon_id": appointment["salon_id"],
                "client_id": appointment["client_id"],
                "scheduled_for": send_at,
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
            })

    async def schedule_review_request(self, appointment_id: str):
        """Schedule a review request after appointment completion."""
        appointments_collection = get_collection("appointments")
        scheduled_notifications = get_collection("scheduled_notifications")

        appointment = await appointments_collection.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            return

        settings = await self.get_salon_settings(appointment["salon_id"])
        if not settings.get("request_reviews", True):
            return

        # Only schedule if there's a review URL configured
        review_url = settings.get("google_review_url") or settings.get("yelp_review_url")
        if not review_url:
            return

        delay_hours = settings.get("review_delay_hours", 2)
        send_at = datetime.now(timezone.utc) + timedelta(hours=delay_hours)

        await scheduled_notifications.insert_one({
            "type": "review_request",
            "appointment_id": appointment["_id"],
            "salon_id": appointment["salon_id"],
            "client_id": appointment["client_id"],
            "review_url": review_url,
            "scheduled_for": send_at,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        })

    async def cancel_appointment_notifications(self, appointment_id: str):
        """Cancel all pending notifications for an appointment."""
        scheduled_notifications = get_collection("scheduled_notifications")

        await scheduled_notifications.update_many(
            {
                "appointment_id": ObjectId(appointment_id),
                "status": "pending",
            },
            {
                "$set": {
                    "status": "cancelled",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def process_pending_notifications(self):
        """Process all pending notifications that are due.

        This should be called periodically by a background task.
        """
        scheduled_notifications = get_collection("scheduled_notifications")
        appointments_collection = get_collection("appointments")
        clients_collection = get_collection("clients")
        services_collection = get_collection("services")
        staff_collection = get_collection("staff")
        salons_collection = get_collection("salons")

        now = datetime.now(timezone.utc)

        # Find pending notifications that are due
        cursor = scheduled_notifications.find({
            "status": "pending",
            "scheduled_for": {"$lte": now},
        })

        notifications = await cursor.to_list(length=100)

        for notification in notifications:
            try:
                # Get related data
                appointment = await appointments_collection.find_one(
                    {"_id": notification["appointment_id"]}
                )
                if not appointment:
                    await self._mark_notification_failed(notification["_id"], "Appointment not found")
                    continue

                # Skip if appointment was cancelled
                if appointment["status"] in ["cancelled", "no_show"]:
                    await self._mark_notification_cancelled(notification["_id"])
                    continue

                client = await clients_collection.find_one({"_id": appointment["client_id"]})
                if not client or not client.get("phone"):
                    await self._mark_notification_failed(notification["_id"], "Client phone not found")
                    continue

                salon = await salons_collection.find_one({"_id": ObjectId(appointment["salon_id"])})
                service = await services_collection.find_one({"_id": appointment["service_id"]})
                staff = await staff_collection.find_one({"_id": appointment["staff_id"]})

                salon_name = salon["name"] if salon else "the salon"
                service_name = service["name"] if service else "your service"
                staff_name = f"{staff['first_name']}" if staff else "your stylist"
                language = client.get("language", "en")

                if notification["type"] == "appointment_reminder":
                    result = await sms_service.send_appointment_reminder(
                        client_phone=client["phone"],
                        client_name=client["first_name"],
                        service_name=service_name,
                        staff_name=staff_name,
                        salon_name=salon_name,
                        appointment_time=appointment["start_time"],
                        language=language,
                        salon_id=appointment["salon_id"],
                    )

                elif notification["type"] == "review_request":
                    result = await sms_service.send_review_request(
                        client_phone=client["phone"],
                        client_name=client["first_name"],
                        salon_name=salon_name,
                        review_url=notification.get("review_url", ""),
                        language=language,
                        salon_id=appointment["salon_id"],
                    )

                else:
                    await self._mark_notification_failed(
                        notification["_id"],
                        f"Unknown notification type: {notification['type']}"
                    )
                    continue

                if result.get("success"):
                    await self._mark_notification_sent(notification["_id"], result.get("sid"))
                else:
                    await self._mark_notification_failed(notification["_id"], result.get("error"))

            except Exception as e:
                await self._mark_notification_failed(notification["_id"], str(e))

    async def _mark_notification_sent(self, notification_id: ObjectId, twilio_sid: Optional[str]):
        """Mark notification as sent."""
        scheduled_notifications = get_collection("scheduled_notifications")
        await scheduled_notifications.update_one(
            {"_id": notification_id},
            {
                "$set": {
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc),
                    "twilio_sid": twilio_sid,
                }
            },
        )

    async def _mark_notification_failed(self, notification_id: ObjectId, error: str):
        """Mark notification as failed."""
        scheduled_notifications = get_collection("scheduled_notifications")
        await scheduled_notifications.update_one(
            {"_id": notification_id},
            {
                "$set": {
                    "status": "failed",
                    "error": error,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def _mark_notification_cancelled(self, notification_id: ObjectId):
        """Mark notification as cancelled."""
        scheduled_notifications = get_collection("scheduled_notifications")
        await scheduled_notifications.update_one(
            {"_id": notification_id},
            {
                "$set": {
                    "status": "cancelled",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def check_and_send_birthdays(self):
        """Check for clients with birthdays today and send messages.

        Should be called once per day.
        """
        clients_collection = get_collection("clients")
        salons_collection = get_collection("salons")
        birthday_log = get_collection("birthday_notifications")

        today = datetime.now(timezone.utc).date()

        # Find clients with birthdays today
        # We need to match month and day regardless of year
        pipeline = [
            {
                "$match": {
                    "birthday": {"$exists": True, "$ne": None},
                    "phone": {"$exists": True, "$ne": None},
                }
            },
            {
                "$addFields": {
                    "birth_month": {"$month": "$birthday"},
                    "birth_day": {"$dayOfMonth": "$birthday"},
                }
            },
            {
                "$match": {
                    "birth_month": today.month,
                    "birth_day": today.day,
                }
            },
        ]

        clients = await clients_collection.aggregate(pipeline).to_list(length=None)

        for client in clients:
            # Check if we already sent a birthday message this year
            existing = await birthday_log.find_one({
                "client_id": client["_id"],
                "year": today.year,
            })
            if existing:
                continue

            # Get salon settings
            salon = await salons_collection.find_one({"_id": ObjectId(client["salon_id"])})
            if not salon:
                continue

            settings = salon.get("settings", {}).get("notifications", {})
            if not settings.get("send_birthday_messages", True):
                continue

            # Get birthday promotion discount
            promotions_collection = get_collection("promotions")
            birthday_promo = await promotions_collection.find_one({
                "salon_id": client["salon_id"],
                "promotion_type": "birthday",
                "is_active": True,
            })

            if birthday_promo:
                if birthday_promo["discount_type"] == "percentage":
                    discount = f"{birthday_promo['discount_value']}% off"
                else:
                    discount = f"${birthday_promo['discount_value'] / 100:.0f} off"
            else:
                discount = "a special treat"

            result = await sms_service.send_birthday_message(
                client_phone=client["phone"],
                client_name=client["first_name"],
                salon_name=salon["name"],
                discount=discount,
                language=client.get("language", "en"),
                custom_message=settings.get("birthday_message_template"),
                salon_id=client["salon_id"],
            )

            # Log the birthday notification
            await birthday_log.insert_one({
                "client_id": client["_id"],
                "salon_id": client["salon_id"],
                "year": today.year,
                "sent_at": datetime.now(timezone.utc),
                "success": result.get("success", False),
                "error": result.get("error"),
            })

    async def notify_staff_change(
        self,
        appointment_id: str,
        new_staff_id: str,
        old_staff_id: str,
    ):
        """Notify client about staff change for their appointment."""
        appointments_collection = get_collection("appointments")
        clients_collection = get_collection("clients")
        staff_collection = get_collection("staff")
        salons_collection = get_collection("salons")

        appointment = await appointments_collection.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            return {"success": False, "error": "Appointment not found"}

        client = await clients_collection.find_one({"_id": appointment["client_id"]})
        if not client or not client.get("phone"):
            return {"success": False, "error": "Client phone not found"}

        new_staff = await staff_collection.find_one({"_id": ObjectId(new_staff_id)})
        salon = await salons_collection.find_one({"_id": ObjectId(appointment["salon_id"])})

        return await sms_service.send_templated_sms(
            to_number=client["phone"],
            template_type="staff_change",
            params={
                "client_name": client["first_name"],
                "salon_name": salon["name"] if salon else "the salon",
                "date": appointment["start_time"].strftime("%B %d at %I:%M %p"),
                "new_staff_name": f"{new_staff['first_name']}" if new_staff else "another stylist",
            },
            language=client.get("language", "en"),
            salon_id=appointment["salon_id"],
        )

    async def notify_cancellation_needed(
        self,
        appointment_ids: list[str],
        reason: str = "schedule change",
    ):
        """Notify multiple clients that their appointments need to be rescheduled."""
        appointments_collection = get_collection("appointments")
        clients_collection = get_collection("clients")
        salons_collection = get_collection("salons")

        results = []

        for appt_id in appointment_ids:
            appointment = await appointments_collection.find_one({"_id": ObjectId(appt_id)})
            if not appointment:
                continue

            client = await clients_collection.find_one({"_id": appointment["client_id"]})
            if not client or not client.get("phone"):
                continue

            salon = await salons_collection.find_one({"_id": ObjectId(appointment["salon_id"])})

            result = await sms_service.send_templated_sms(
                to_number=client["phone"],
                template_type="cancellation_needed",
                params={
                    "client_name": client["first_name"],
                    "salon_name": salon["name"] if salon else "the salon",
                    "date": appointment["start_time"].strftime("%B %d"),
                    "phone": salon.get("phone", "us") if salon else "us",
                },
                language=client.get("language", "en"),
                salon_id=appointment["salon_id"],
            )

            results.append({
                "appointment_id": appt_id,
                "client_id": str(client["_id"]),
                "success": result.get("success", False),
            })

        return results


# Singleton instance
notification_service = NotificationService()
