"""Enhanced tracking service for real-time GPS tracking, geofences, and ETA calculation."""
import math
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.models.geofence import (
    Geofence, GeofenceEvent, GeofenceTrigger, TrackingLink, PODCapture
)
from app.models.tracking import TrackingEvent, TrackingEventType
from app.models.shipment import ShipmentStatus


class TrackingService:
    """Service for tracking operations."""

    # Average truck speed for ETA calculations (mph)
    AVG_TRUCK_SPEED_MPH = 55

    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in miles using Haversine formula."""
        R = 3959  # Earth's radius in miles

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    @staticmethod
    def calculate_eta(
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        avg_speed_mph: float = None
    ) -> Tuple[datetime, float]:
        """
        Calculate estimated time of arrival.
        Returns (eta_datetime, distance_miles).
        """
        if avg_speed_mph is None:
            avg_speed_mph = TrackingService.AVG_TRUCK_SPEED_MPH

        distance = TrackingService.calculate_distance(
            current_lat, current_lon, dest_lat, dest_lon
        )

        # Add 15% buffer for stops, traffic, etc.
        adjusted_distance = distance * 1.15

        hours = adjusted_distance / avg_speed_mph
        eta = utc_now() + timedelta(hours=hours)

        return eta, distance

    @staticmethod
    async def update_shipment_location(
        shipment_id: str,
        latitude: float,
        longitude: float,
        city: Optional[str] = None,
        state: Optional[str] = None,
        source: str = "gps"
    ) -> dict:
        """
        Update shipment location and check geofences.
        Returns dict with location update and any triggered alerts.
        """
        db = get_database()
        shipment_oid = ObjectId(shipment_id)

        # Get shipment
        shipment = await db.shipments.find_one({"_id": shipment_oid})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        # Create tracking event
        event = TrackingEvent(
            shipment_id=shipment_oid,
            event_type=TrackingEventType.IN_TRANSIT,
            event_timestamp=utc_now(),
            reported_at=utc_now(),
            latitude=latitude,
            longitude=longitude,
            location_city=city,
            location_state=state,
            source=source,
        )
        await db.tracking_events.insert_one(event.model_dump_mongo())

        # Update shipment location
        location_str = f"{city}, {state}" if city and state else None
        update_data = {
            "last_check_call": utc_now(),
            "updated_at": utc_now(),
        }
        if location_str:
            update_data["last_known_location"] = location_str

        await db.shipments.update_one(
            {"_id": shipment_oid},
            {"$set": update_data}
        )

        # Check geofences
        triggered_geofences = await TrackingService.check_geofences(
            shipment_id, latitude, longitude
        )

        # Calculate ETA if we have destination coordinates
        eta_info = None
        if shipment.get("stops"):
            # Find delivery stop
            delivery_stop = next(
                (s for s in shipment["stops"] if s.get("stop_type") == "delivery"),
                None
            )
            if delivery_stop:
                # Would need geocoding in real implementation
                # For now, we'll skip ETA if no coords
                pass

        return {
            "tracking_event_id": str(event.id),
            "location": location_str,
            "latitude": latitude,
            "longitude": longitude,
            "triggered_geofences": triggered_geofences,
            "eta": eta_info,
        }

    @staticmethod
    async def check_geofences(
        shipment_id: str,
        latitude: float,
        longitude: float
    ) -> List[dict]:
        """Check if location triggers any geofences for this shipment."""
        db = get_database()
        shipment_oid = ObjectId(shipment_id)

        # Get active geofences for this shipment
        geofences = await db.geofences.find({
            "$or": [
                {"shipment_id": shipment_oid},
                {"shipment_id": None}  # Global geofences
            ],
            "is_active": True
        }).to_list(100)

        triggered = []

        for gf_doc in geofences:
            gf = Geofence(**gf_doc)

            # Calculate distance from geofence center
            distance_meters = TrackingService.calculate_distance(
                latitude, longitude, gf.latitude, gf.longitude
            ) * 1609.34  # Convert miles to meters

            is_inside = distance_meters <= gf.radius_meters

            # Check if we have a previous event to determine enter/exit
            last_event = await db.geofence_events.find_one(
                {
                    "geofence_id": gf.id,
                    "shipment_id": shipment_oid
                },
                sort=[("event_timestamp", -1)]
            )

            was_inside = last_event and last_event.get("event_type") == "enter"

            # Determine if trigger should fire
            trigger_event = None
            if is_inside and not was_inside:
                if gf.trigger in [GeofenceTrigger.ENTER, GeofenceTrigger.BOTH]:
                    trigger_event = GeofenceTrigger.ENTER
            elif not is_inside and was_inside:
                if gf.trigger in [GeofenceTrigger.EXIT, GeofenceTrigger.BOTH]:
                    trigger_event = GeofenceTrigger.EXIT

            if trigger_event:
                # Create geofence event
                gf_event = GeofenceEvent(
                    geofence_id=gf.id,
                    shipment_id=shipment_oid,
                    event_type=trigger_event,
                    event_timestamp=utc_now(),
                    latitude=latitude,
                    longitude=longitude,
                )
                await db.geofence_events.insert_one(gf_event.model_dump_mongo())

                triggered.append({
                    "geofence_id": str(gf.id),
                    "geofence_name": gf.name,
                    "geofence_type": gf.geofence_type,
                    "trigger_type": trigger_event,
                    "event_id": str(gf_event.id),
                })

                # TODO: Send alerts (email, push, webhook)

        return triggered

    @staticmethod
    async def create_tracking_link(
        shipment_id: str,
        customer_id: Optional[str] = None,
        expires_in_days: int = 30,
        **options
    ) -> TrackingLink:
        """Create a shareable tracking link for a shipment."""
        db = get_database()

        # Generate secure token
        token = secrets.token_urlsafe(32)

        # Get customer info if available
        customer_name = None
        customer_email = None
        if customer_id:
            customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
            if customer:
                customer_name = customer.get("name")
                # Get primary contact email
                contacts = customer.get("contacts", [])
                primary = next((c for c in contacts if c.get("is_primary")), None)
                if primary:
                    customer_email = primary.get("email")

        link = TrackingLink(
            shipment_id=ObjectId(shipment_id),
            customer_id=ObjectId(customer_id) if customer_id else None,
            token=token,
            expires_at=utc_now() + timedelta(days=expires_in_days),
            customer_name=customer_name,
            customer_email=customer_email,
            allow_pod_view=options.get("allow_pod_view", True),
            allow_document_view=options.get("allow_document_view", False),
            show_carrier_info=options.get("show_carrier_info", False),
            show_pricing=options.get("show_pricing", False),
        )

        await db.tracking_links.insert_one(link.model_dump_mongo())
        return link

    @staticmethod
    async def get_tracking_by_token(token: str) -> Optional[dict]:
        """Get tracking info by public token."""
        db = get_database()

        link = await db.tracking_links.find_one({
            "token": token,
            "is_active": True
        })

        if not link:
            return None

        # Check expiration
        if link.get("expires_at") and link["expires_at"] < utc_now():
            return None

        # Update view count
        await db.tracking_links.update_one(
            {"_id": link["_id"]},
            {
                "$inc": {"view_count": 1},
                "$set": {"last_viewed_at": utc_now()}
            }
        )

        # Get shipment
        shipment = await db.shipments.find_one({"_id": link["shipment_id"]})
        if not shipment:
            return None

        # Get tracking events
        events = await db.tracking_events.find(
            {"shipment_id": link["shipment_id"]}
        ).sort("event_timestamp", -1).to_list(50)

        # Get POD if available and allowed
        pod = None
        if link.get("allow_pod_view"):
            pod = await db.pod_captures.find_one({"shipment_id": link["shipment_id"]})

        # Get documents if allowed
        documents = []
        if link.get("allow_document_view"):
            docs = await db.documents.find(
                {"shipment_id": link["shipment_id"]}
            ).to_list(20)
            documents = docs

        # Build response based on permissions
        response = {
            "shipment_number": shipment.get("shipment_number"),
            "status": shipment.get("status"),
            "origin": None,
            "destination": None,
            "pickup_date": shipment.get("pickup_date"),
            "delivery_date": shipment.get("delivery_date"),
            "eta": shipment.get("eta"),
            "last_location": shipment.get("last_known_location"),
            "last_update": shipment.get("last_check_call"),
            "tracking_events": [
                {
                    "event_type": e.get("event_type"),
                    "timestamp": e.get("event_timestamp"),
                    "location": f"{e.get('location_city', '')}, {e.get('location_state', '')}".strip(", "),
                    "notes": e.get("notes"),
                }
                for e in events
            ],
        }

        # Add stops info
        stops = shipment.get("stops", [])
        for stop in stops:
            if stop.get("stop_type") == "pickup":
                response["origin"] = f"{stop.get('city')}, {stop.get('state')}"
            elif stop.get("stop_type") == "delivery":
                response["destination"] = f"{stop.get('city')}, {stop.get('state')}"

        if link.get("show_carrier_info") and shipment.get("carrier_id"):
            carrier = await db.carriers.find_one({"_id": shipment["carrier_id"]})
            if carrier:
                response["carrier"] = {
                    "name": carrier.get("name"),
                    "mc_number": carrier.get("mc_number"),
                }

        if link.get("show_pricing"):
            response["customer_price"] = shipment.get("customer_price")

        if pod:
            response["pod"] = {
                "captured_at": pod.get("captured_at"),
                "received_by": pod.get("received_by"),
                "has_signature": bool(pod.get("signature_data")),
                "photo_count": pod.get("photo_count", 0),
            }

        if documents:
            response["documents"] = [
                {
                    "id": str(d["_id"]),
                    "type": d.get("document_type"),
                    "filename": d.get("original_filename"),
                }
                for d in documents
            ]

        return response

    @staticmethod
    async def capture_pod(
        shipment_id: str,
        signature_data: Optional[str] = None,
        signer_name: Optional[str] = None,
        signer_title: Optional[str] = None,
        photo_urls: Optional[List[str]] = None,
        received_by: Optional[str] = None,
        delivery_notes: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> PODCapture:
        """Capture proof of delivery."""
        db = get_database()
        shipment_oid = ObjectId(shipment_id)

        capture_type = "signature"
        if signature_data and photo_urls:
            capture_type = "both"
        elif photo_urls:
            capture_type = "photo"

        pod = PODCapture(
            shipment_id=shipment_oid,
            capture_type=capture_type,
            signature_data=signature_data,
            signer_name=signer_name,
            signer_title=signer_title,
            photo_urls=photo_urls or [],
            photo_count=len(photo_urls) if photo_urls else 0,
            received_by=received_by,
            delivery_notes=delivery_notes,
            latitude=latitude,
            longitude=longitude,
        )

        result = await db.pod_captures.insert_one(pod.model_dump_mongo())

        # Create tracking event for POD received
        event = TrackingEvent(
            shipment_id=shipment_oid,
            event_type=TrackingEventType.POD_RECEIVED,
            event_timestamp=utc_now(),
            reported_at=utc_now(),
            latitude=latitude,
            longitude=longitude,
            description=f"POD captured. Received by: {received_by or 'Unknown'}",
            source="pod_capture",
        )
        await db.tracking_events.insert_one(event.model_dump_mongo())

        # Update shipment status to delivered if not already
        shipment = await db.shipments.find_one({"_id": shipment_oid})
        if shipment and shipment.get("status") != "delivered":
            await db.shipments.update_one(
                {"_id": shipment_oid},
                {
                    "$set": {
                        "status": "delivered",
                        "actual_delivery_date": utc_now(),
                        "updated_at": utc_now(),
                    }
                }
            )

        # Auto-generate invoice from POD (Feature: e07899c0)
        try:
            from app.services.invoice_automation_service import InvoiceAutomationService
            await InvoiceAutomationService.trigger_invoice_from_pod(shipment_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"Auto-invoice from POD failed for shipment {shipment_id}: {e}"
            )

        return pod

    @staticmethod
    async def detect_exceptions(shipment_id: str) -> List[dict]:
        """
        Detect potential exceptions for a shipment.
        Returns list of detected issues.
        """
        db = get_database()
        shipment_oid = ObjectId(shipment_id)

        shipment = await db.shipments.find_one({"_id": shipment_oid})
        if not shipment:
            return []

        exceptions = []
        now = utc_now()

        # Check 1: No carrier assigned close to pickup
        if not shipment.get("carrier_id"):
            pickup_date = shipment.get("pickup_date")
            if pickup_date:
                hours_until_pickup = (pickup_date - now).total_seconds() / 3600
                if hours_until_pickup < 24:
                    exceptions.append({
                        "type": "no_carrier",
                        "severity": "high" if hours_until_pickup < 12 else "medium",
                        "message": f"No carrier assigned. Pickup in {int(hours_until_pickup)} hours.",
                        "hours_until_pickup": hours_until_pickup,
                    })

        # Check 2: No check call while in transit
        if shipment.get("status") == "in_transit":
            last_check = shipment.get("last_check_call")
            if last_check:
                hours_since_check = (now - last_check).total_seconds() / 3600
                if hours_since_check > 4:
                    exceptions.append({
                        "type": "overdue_check_call",
                        "severity": "medium" if hours_since_check < 8 else "high",
                        "message": f"No check call in {int(hours_since_check)} hours.",
                        "hours_since_check": hours_since_check,
                    })
            else:
                exceptions.append({
                    "type": "no_check_call",
                    "severity": "medium",
                    "message": "In transit but no check calls recorded.",
                })

        # Check 3: Late pickup
        if shipment.get("status") == "pending_pickup":
            pickup_date = shipment.get("pickup_date")
            if pickup_date and pickup_date < now:
                hours_late = (now - pickup_date).total_seconds() / 3600
                exceptions.append({
                    "type": "late_pickup",
                    "severity": "high",
                    "message": f"Pickup is {int(hours_late)} hours overdue.",
                    "hours_late": hours_late,
                })

        # Check 4: Late delivery
        if shipment.get("status") in ["in_transit", "out_for_delivery"]:
            delivery_date = shipment.get("delivery_date")
            if delivery_date and delivery_date < now:
                hours_late = (now - delivery_date).total_seconds() / 3600
                exceptions.append({
                    "type": "late_delivery",
                    "severity": "high",
                    "message": f"Delivery is {int(hours_late)} hours overdue.",
                    "hours_late": hours_late,
                })

        # Check 5: ETA past delivery date
        eta = shipment.get("eta")
        delivery_date = shipment.get("delivery_date")
        if eta and delivery_date and eta > delivery_date:
            hours_late = (eta - delivery_date).total_seconds() / 3600
            exceptions.append({
                "type": "eta_past_delivery",
                "severity": "medium",
                "message": f"ETA is {int(hours_late)} hours past scheduled delivery.",
                "projected_hours_late": hours_late,
            })

        return exceptions

    @staticmethod
    async def get_tracking_timeline(shipment_id: str) -> dict:
        """Get comprehensive tracking timeline for a shipment."""
        db = get_database()
        shipment_oid = ObjectId(shipment_id)

        # Get shipment
        shipment = await db.shipments.find_one({"_id": shipment_oid})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        # Get all tracking events
        events = await db.tracking_events.find(
            {"shipment_id": shipment_oid}
        ).sort("event_timestamp", 1).to_list(200)

        # Get geofence events
        gf_events = await db.geofence_events.find(
            {"shipment_id": shipment_oid}
        ).sort("event_timestamp", 1).to_list(50)

        # Get POD
        pod = await db.pod_captures.find_one({"shipment_id": shipment_oid})

        # Build timeline
        timeline = []

        # Add shipment creation
        timeline.append({
            "timestamp": shipment.get("created_at"),
            "event_type": "shipment_created",
            "title": "Shipment Created",
            "description": f"Shipment {shipment.get('shipment_number')} created",
            "icon": "plus",
        })

        # Add tracking events
        for event in events:
            timeline.append({
                "timestamp": event.get("event_timestamp"),
                "event_type": event.get("event_type"),
                "title": event.get("event_type", "").replace("_", " ").title(),
                "description": event.get("description") or event.get("notes"),
                "location": f"{event.get('location_city', '')}, {event.get('location_state', '')}".strip(", "),
                "latitude": event.get("latitude"),
                "longitude": event.get("longitude"),
                "is_exception": event.get("is_exception", False),
                "icon": _get_event_icon(event.get("event_type")),
            })

        # Add geofence events
        for gf_event in gf_events:
            # Get geofence details
            gf = await db.geofences.find_one({"_id": gf_event.get("geofence_id")})
            gf_name = gf.get("name") if gf else "Unknown"

            timeline.append({
                "timestamp": gf_event.get("event_timestamp"),
                "event_type": f"geofence_{gf_event.get('event_type')}",
                "title": f"{'Arrived at' if gf_event.get('event_type') == 'enter' else 'Departed'} {gf_name}",
                "description": None,
                "location": None,
                "latitude": gf_event.get("latitude"),
                "longitude": gf_event.get("longitude"),
                "icon": "location" if gf_event.get("event_type") == "enter" else "arrow-right",
            })

        # Add POD if captured
        if pod:
            timeline.append({
                "timestamp": pod.get("captured_at"),
                "event_type": "pod_captured",
                "title": "Proof of Delivery Captured",
                "description": f"Received by: {pod.get('received_by', 'Unknown')}",
                "icon": "check-circle",
            })

        # Sort by timestamp
        timeline.sort(key=lambda x: x["timestamp"] if x["timestamp"] else datetime.min)

        # Define milestones
        milestones = [
            {"status": "booked", "label": "Booked", "completed": True},
            {"status": "pending_pickup", "label": "Dispatched", "completed": shipment.get("status") in ["pending_pickup", "in_transit", "out_for_delivery", "delivered"]},
            {"status": "in_transit", "label": "In Transit", "completed": shipment.get("status") in ["in_transit", "out_for_delivery", "delivered"]},
            {"status": "delivered", "label": "Delivered", "completed": shipment.get("status") == "delivered"},
        ]

        return {
            "shipment_number": shipment.get("shipment_number"),
            "status": shipment.get("status"),
            "milestones": milestones,
            "timeline": timeline,
            "current_location": shipment.get("last_known_location"),
            "eta": shipment.get("eta"),
            "pod_captured": pod is not None,
        }


def _get_event_icon(event_type: str) -> str:
    """Get icon name for tracking event type."""
    icons = {
        "booked": "calendar",
        "dispatched": "truck",
        "driver_assigned": "user",
        "en_route_to_pickup": "navigation",
        "arrived_at_pickup": "map-pin",
        "loading": "package",
        "departed_pickup": "arrow-right",
        "in_transit": "truck",
        "check_call": "phone",
        "arrived_at_delivery": "map-pin",
        "unloading": "package",
        "delivered": "check-circle",
        "pod_received": "file-check",
        "delay": "clock",
        "exception": "alert-triangle",
        "note": "message-square",
    }
    return icons.get(event_type, "circle")
