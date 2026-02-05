"""Invoice automation service for automatic invoice generation."""
from typing import Optional
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.models.invoice import InvoiceStatus
from app.models.work_item import WorkItemType, WorkItemStatus
from app.services.number_generator import NumberGenerator


class InvoiceAutomationService:
    """Service for automatic invoice generation from POD."""

    @staticmethod
    async def create_invoice_from_shipment(
        shipment_id: str,
        auto_send: bool = False,
    ) -> dict:
        """
        Create an invoice from a delivered shipment.
        Returns invoice ID and details.
        """
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        # Check for existing invoice
        existing = await db.invoices.find_one({"shipment_id": ObjectId(shipment_id)})
        if existing:
            return {
                "status": "already_exists",
                "invoice_id": str(existing["_id"]),
                "invoice_number": existing.get("invoice_number")
            }

        # Get customer
        customer = await db.customers.find_one({"_id": shipment["customer_id"]})
        if not customer:
            raise ValueError("Customer not found")

        # Generate invoice number
        invoice_number = await NumberGenerator.generate("invoice")

        # Build line items
        line_items = []

        # Main freight charge
        customer_price = shipment.get("customer_price", 0)
        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        origin_str = f"{origin.get('city', '')}, {origin.get('state', '')}"
        dest_str = f"{dest.get('city', '')}, {dest.get('state', '')}"

        line_items.append({
            "description": f"Freight: {origin_str} to {dest_str}",
            "quantity": 1,
            "unit_price": customer_price,
            "shipment_id": shipment_id,
        })

        # TODO: Add accessorials from shipment

        total = sum(item["quantity"] * item["unit_price"] for item in line_items)

        # Calculate due date based on customer payment terms
        from datetime import timedelta
        payment_terms = customer.get("payment_terms", 30)
        due_date = utc_now() + timedelta(days=payment_terms)

        # Create invoice
        invoice = {
            "invoice_number": invoice_number,
            "customer_id": shipment["customer_id"],
            "shipment_id": ObjectId(shipment_id),
            "status": InvoiceStatus.DRAFT.value,
            "invoice_date": utc_now(),
            "due_date": due_date,
            "billing_name": customer.get("name", ""),
            "billing_address": customer.get("address_line1"),
            "billing_city": customer.get("city"),
            "billing_state": customer.get("state"),
            "billing_zip": customer.get("zip_code"),
            "line_items": line_items,
            "subtotal": total,
            "tax_rate": 0,
            "tax_amount": 0,
            "total": total,
            "amount_paid": 0,
            "amount_due": total,
            "notes": f"Shipment: {shipment.get('shipment_number')}",
            "auto_generated": True,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        result = await db.invoices.insert_one(invoice)
        invoice_id = str(result.inserted_id)

        if auto_send:
            # Send invoice
            await db.invoices.update_one(
                {"_id": result.inserted_id},
                {
                    "$set": {
                        "status": InvoiceStatus.SENT.value,
                        "sent_at": utc_now(),
                        "updated_at": utc_now()
                    }
                }
            )

            # Create notification for customer
            await db.portal_notifications.insert_one({
                "portal_type": "customer",
                "entity_id": shipment["customer_id"],
                "title": f"Invoice {invoice_number}",
                "message": f"New invoice generated for shipment {shipment.get('shipment_number')}. Amount: ${total / 100:.2f}",
                "notification_type": "invoice",
                "invoice_id": result.inserted_id,
                "shipment_id": ObjectId(shipment_id),
                "is_read": False,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            })

            return {
                "status": "created_and_sent",
                "invoice_id": invoice_id,
                "invoice_number": invoice_number,
                "total": total,
            }
        else:
            # Create work item for review
            await db.work_items.insert_one({
                "work_type": WorkItemType.INVOICE_READY.value,
                "status": WorkItemStatus.OPEN.value,
                "title": f"Review Invoice {invoice_number}",
                "description": f"Auto-generated invoice for {shipment.get('shipment_number')}. Total: ${total / 100:.2f}",
                "invoice_id": result.inserted_id,
                "shipment_id": ObjectId(shipment_id),
                "customer_id": shipment["customer_id"],
                "priority": 3,
                "is_overdue": False,
                "is_snoozed": False,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            })

            return {
                "status": "created_pending_review",
                "invoice_id": invoice_id,
                "invoice_number": invoice_number,
                "total": total,
            }

    @staticmethod
    async def trigger_invoice_from_pod(shipment_id: str) -> dict:
        """
        Triggered when POD is received.
        Creates invoice if shipment is delivered and no invoice exists.
        """
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            return {"status": "shipment_not_found"}

        # Check if delivered
        if shipment.get("status") != "delivered":
            return {"status": "not_delivered"}

        # Check for POD
        pod = await db.pod_captures.find_one({"shipment_id": ObjectId(shipment_id)})
        if not pod:
            return {"status": "no_pod"}

        # Check for existing invoice
        existing = await db.invoices.find_one({"shipment_id": ObjectId(shipment_id)})
        if existing:
            return {
                "status": "invoice_exists",
                "invoice_id": str(existing["_id"])
            }

        # Get customer settings
        customer = await db.customers.find_one({"_id": shipment["customer_id"]})
        auto_send = customer.get("auto_invoice_on_pod", False) if customer else False

        # Create invoice
        return await InvoiceAutomationService.create_invoice_from_shipment(
            shipment_id=shipment_id,
            auto_send=auto_send,
        )

    @staticmethod
    async def process_delivered_shipments():
        """
        Process delivered shipments without invoices.
        Called periodically.
        """
        db = get_database()

        # Find delivered shipments without invoices
        delivered = await db.shipments.find({
            "status": "delivered",
            "invoice_created": {"$ne": True}
        }).limit(20).to_list(20)

        results = []
        for shipment in delivered:
            shipment_id = str(shipment["_id"])

            # Check for POD
            pod = await db.pod_captures.find_one({"shipment_id": shipment["_id"]})
            if not pod:
                continue

            try:
                result = await InvoiceAutomationService.create_invoice_from_shipment(
                    shipment_id=shipment_id,
                    auto_send=False,  # Create in draft for review
                )
                results.append({
                    "shipment_id": shipment_id,
                    "result": result
                })

                # Mark shipment
                await db.shipments.update_one(
                    {"_id": shipment["_id"]},
                    {"$set": {"invoice_created": True, "updated_at": utc_now()}}
                )
            except Exception as e:
                results.append({
                    "shipment_id": shipment_id,
                    "error": str(e)
                })

        return {"processed": len(results), "results": results}

    @staticmethod
    async def batch_create_invoices(
        shipment_ids: list,
        consolidate: bool = False,
    ) -> dict:
        """
        Create invoices for multiple shipments.
        If consolidate=True, creates one invoice for all shipments (same customer only).
        """
        db = get_database()

        if not shipment_ids:
            return {"status": "no_shipments"}

        if consolidate:
            # Get shipments
            shipments = await db.shipments.find({
                "_id": {"$in": [ObjectId(sid) for sid in shipment_ids]},
                "status": "delivered"
            }).to_list(100)

            if not shipments:
                return {"status": "no_delivered_shipments"}

            # Check all same customer
            customer_ids = set(str(s["customer_id"]) for s in shipments)
            if len(customer_ids) > 1:
                return {"status": "error", "message": "Cannot consolidate shipments from different customers"}

            customer_id = shipments[0]["customer_id"]
            customer = await db.customers.find_one({"_id": customer_id})

            # Generate invoice number
            invoice_number = await NumberGenerator.generate("invoice")

            # Build line items from all shipments
            line_items = []
            total = 0

            for shipment in shipments:
                customer_price = shipment.get("customer_price", 0)
                stops = shipment.get("stops", [])
                origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
                dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

                line_items.append({
                    "description": f"Shipment {shipment.get('shipment_number')}: {origin.get('city', '')}, {origin.get('state', '')} to {dest.get('city', '')}, {dest.get('state', '')}",
                    "quantity": 1,
                    "unit_price": customer_price,
                    "shipment_id": str(shipment["_id"]),
                })
                total += customer_price

            # Calculate due date
            from datetime import timedelta
            payment_terms = customer.get("payment_terms", 30) if customer else 30
            due_date = utc_now() + timedelta(days=payment_terms)

            # Create consolidated invoice
            invoice = {
                "invoice_number": invoice_number,
                "customer_id": customer_id,
                "shipment_id": None,  # Multiple shipments
                "shipment_ids": [ObjectId(sid) for sid in shipment_ids],
                "status": InvoiceStatus.DRAFT.value,
                "invoice_date": utc_now(),
                "due_date": due_date,
                "billing_name": customer.get("name", "") if customer else "",
                "line_items": line_items,
                "subtotal": total,
                "tax_rate": 0,
                "tax_amount": 0,
                "total": total,
                "amount_paid": 0,
                "amount_due": total,
                "notes": f"Consolidated invoice for {len(shipments)} shipments",
                "is_consolidated": True,
                "auto_generated": True,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }

            result = await db.invoices.insert_one(invoice)

            # Mark shipments
            await db.shipments.update_many(
                {"_id": {"$in": [s["_id"] for s in shipments]}},
                {"$set": {"invoice_created": True, "updated_at": utc_now()}}
            )

            return {
                "status": "consolidated_invoice_created",
                "invoice_id": str(result.inserted_id),
                "invoice_number": invoice_number,
                "shipment_count": len(shipments),
                "total": total,
            }

        else:
            # Create individual invoices
            results = []
            for shipment_id in shipment_ids:
                try:
                    result = await InvoiceAutomationService.create_invoice_from_shipment(
                        shipment_id=shipment_id,
                        auto_send=False,
                    )
                    results.append(result)
                except Exception as e:
                    results.append({
                        "shipment_id": shipment_id,
                        "error": str(e)
                    })

            return {
                "status": "individual_invoices_created",
                "count": len([r for r in results if r.get("invoice_id")]),
                "results": results,
            }
