"""Automation API endpoints for background jobs and automation features."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.services.waterfall_service import WaterfallService, WaterfallConfig
from app.services.auto_assignment_service import AutoAssignmentService, AssignmentRule
from app.services.invoice_automation_service import InvoiceAutomationService

router = APIRouter()


# ============================================================================
# Tender Waterfall
# ============================================================================

class WaterfallCreateRequest(BaseModel):
    shipment_id: str
    carrier_ids: List[str]
    offered_rate: int  # in cents
    timeout_minutes: int = 30
    auto_escalate: bool = True
    rate_increase_percent: float = 0.0
    max_escalations: int = 3
    notes: Optional[str] = None


class WaterfallResponse(BaseModel):
    waterfall_id: str
    status: str
    total_carriers: int


@router.post("/waterfall", response_model=WaterfallResponse)
async def create_waterfall(data: WaterfallCreateRequest):
    """Create a new tender waterfall for sequential carrier tendering."""
    try:
        config = WaterfallConfig(
            carrier_ids=data.carrier_ids,
            shipment_id=data.shipment_id,
            offered_rate=data.offered_rate,
            timeout_minutes=data.timeout_minutes,
            auto_escalate=data.auto_escalate,
            rate_increase_percent=data.rate_increase_percent,
            max_escalations=data.max_escalations,
            notes=data.notes,
        )
        result = await WaterfallService.create_waterfall(config)
        return WaterfallResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/waterfall/{waterfall_id}")
async def get_waterfall_status(waterfall_id: str):
    """Get current status of a waterfall."""
    try:
        return await WaterfallService.get_waterfall_status(waterfall_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/waterfall/{waterfall_id}/cancel")
async def cancel_waterfall(waterfall_id: str, reason: Optional[str] = None):
    """Cancel an active waterfall."""
    try:
        return await WaterfallService.cancel_waterfall(waterfall_id, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/waterfall/check-expired")
async def check_expired_tenders(background_tasks: BackgroundTasks):
    """Check for expired tenders and auto-escalate. Run periodically."""
    return await WaterfallService.check_expired_tenders()


# ============================================================================
# Auto Assignment
# ============================================================================

class AssignmentRuleCreate(BaseModel):
    name: str
    rule_type: str
    priority: int = 0
    conditions: dict = {}
    actions: dict = {}


@router.post("/rules")
async def create_assignment_rule(data: AssignmentRuleCreate):
    """Create a new auto-assignment rule."""
    rule = AssignmentRule(
        name=data.name,
        rule_type=data.rule_type,
        priority=data.priority,
        conditions=data.conditions,
        actions=data.actions,
    )
    rule_id = await AutoAssignmentService.create_rule(rule)
    return {"rule_id": rule_id, "status": "created"}


@router.get("/rules")
async def get_assignment_rules():
    """Get all active assignment rules."""
    return await AutoAssignmentService.get_assignment_rules()


@router.delete("/rules/{rule_id}")
async def delete_assignment_rule(rule_id: str):
    """Delete an assignment rule."""
    db = get_database()
    result = await db.assignment_rules.delete_one({"_id": ObjectId(rule_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "deleted"}


@router.post("/auto-assign/{shipment_id}")
async def auto_assign_shipment(
    shipment_id: str,
    use_waterfall: bool = True,
    timeout_minutes: int = 30,
    max_carriers: int = 5,
):
    """Automatically assign a shipment to carriers."""
    try:
        return await AutoAssignmentService.auto_assign_shipment(
            shipment_id=shipment_id,
            use_waterfall=use_waterfall,
            timeout_minutes=timeout_minutes,
            max_carriers=max_carriers,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auto-assign/process-new")
async def process_new_shipments():
    """Process new shipments without carriers. Run periodically."""
    return await AutoAssignmentService.process_new_shipments()


@router.get("/auto-assign/evaluate/{shipment_id}")
async def evaluate_rules_for_shipment(shipment_id: str):
    """Evaluate all rules for a shipment and return matched carriers."""
    try:
        return await AutoAssignmentService.evaluate_rules_for_shipment(shipment_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Invoice Automation
# ============================================================================

class BatchInvoiceRequest(BaseModel):
    shipment_ids: List[str]
    consolidate: bool = False


@router.post("/invoices/from-shipment/{shipment_id}")
async def create_invoice_from_shipment(shipment_id: str, auto_send: bool = False):
    """Create invoice from a delivered shipment."""
    try:
        return await InvoiceAutomationService.create_invoice_from_shipment(
            shipment_id=shipment_id,
            auto_send=auto_send,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/from-pod/{shipment_id}")
async def trigger_invoice_from_pod(shipment_id: str):
    """Trigger invoice creation from POD receipt."""
    return await InvoiceAutomationService.trigger_invoice_from_pod(shipment_id)


@router.post("/invoices/batch")
async def batch_create_invoices(data: BatchInvoiceRequest):
    """Create invoices for multiple shipments."""
    return await InvoiceAutomationService.batch_create_invoices(
        shipment_ids=data.shipment_ids,
        consolidate=data.consolidate,
    )


@router.post("/invoices/process-delivered")
async def process_delivered_shipments():
    """Process delivered shipments without invoices. Run periodically."""
    return await InvoiceAutomationService.process_delivered_shipments()


# ============================================================================
# Document Classification
# ============================================================================

@router.post("/documents/classify/{document_id}")
async def classify_document(document_id: str, background_tasks: BackgroundTasks):
    """Trigger AI classification for a document."""
    from app.services.document_processing import get_document_processor

    processor = get_document_processor()

    # Run in background
    async def process():
        try:
            await processor.process_document(document_id)
        except Exception as e:
            # Log error
            db = get_database()
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {"extraction_error": str(e)}}
            )

    background_tasks.add_task(process)

    return {"status": "processing", "document_id": document_id}


@router.post("/documents/process-pending")
async def process_pending_documents(background_tasks: BackgroundTasks, limit: int = 10):
    """Process documents pending extraction. Run periodically."""
    from app.services.document_processing import get_document_processor

    db = get_database()
    processor = get_document_processor()

    # Find documents pending processing
    pending = await db.documents.find({
        "$or": [
            {"extraction_status": "pending"},
            {"extraction_status": {"$exists": False}}
        ],
        "mime_type": {"$in": ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]}
    }).limit(limit).to_list(limit)

    processed_ids = []
    for doc in pending:
        doc_id = str(doc["_id"])
        processed_ids.append(doc_id)

        async def process(did=doc_id):
            try:
                await processor.process_document(did)
            except Exception:
                pass

        background_tasks.add_task(process)

    return {"status": "processing", "count": len(processed_ids), "document_ids": processed_ids}


# ============================================================================
# Scheduler / Background Jobs Status
# ============================================================================

@router.get("/jobs/status")
async def get_automation_status():
    """Get status of automation services."""
    db = get_database()

    # Count pending items
    pending_documents = await db.documents.count_documents({
        "$or": [
            {"extraction_status": "pending"},
            {"extraction_status": {"$exists": False}}
        ]
    })

    unassigned_shipments = await db.shipments.count_documents({
        "carrier_id": None,
        "status": {"$in": ["booked", "pending_pickup"]}
    })

    delivered_without_invoice = await db.shipments.count_documents({
        "status": "delivered",
        "invoice_created": {"$ne": True}
    })

    active_waterfalls = await db.tender_waterfalls.count_documents({"status": "active"})

    return {
        "pending_document_classification": pending_documents,
        "unassigned_shipments": unassigned_shipments,
        "delivered_without_invoice": delivered_without_invoice,
        "active_waterfalls": active_waterfalls,
        "timestamp": utc_now(),
    }


@router.post("/jobs/run-all")
async def run_all_automations(background_tasks: BackgroundTasks):
    """Run all periodic automation tasks. For manual trigger or cron."""

    async def run():
        # Check expired tenders
        await WaterfallService.check_expired_tenders()

        # Process new shipments
        await AutoAssignmentService.process_new_shipments()

        # Process delivered shipments
        await InvoiceAutomationService.process_delivered_shipments()

    background_tasks.add_task(run)

    return {"status": "running", "message": "All automation tasks triggered"}
