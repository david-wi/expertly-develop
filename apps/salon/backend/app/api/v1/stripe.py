"""Stripe API endpoints for payments and Connect."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from pydantic import BaseModel
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_user
from ...services.stripe_service import stripe_service
from ...config import settings

router = APIRouter()


# =====================
# Request/Response Models
# =====================

class CreateConnectLinkResponse(BaseModel):
    url: str
    stripe_account_id: Optional[str] = None


class ConnectStatusResponse(BaseModel):
    connected: bool
    onboarding_complete: bool
    charges_enabled: bool
    payouts_enabled: bool
    requirements: list[str] = []
    error: Optional[str] = None


class PaymentIntentRequest(BaseModel):
    amount: int  # In cents
    client_id: str
    appointment_id: Optional[str] = None
    description: Optional[str] = None


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str


class SetupIntentRequest(BaseModel):
    client_id: str


class SetupIntentResponse(BaseModel):
    client_secret: str
    setup_intent_id: str


class RefundRequest(BaseModel):
    payment_intent_id: str
    amount: Optional[int] = None  # Partial refund amount in cents
    reason: str = "requested_by_customer"


class PaymentMethodResponse(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int


# =====================
# Stripe Connect Endpoints
# =====================

@router.get("/connect/status", response_model=ConnectStatusResponse)
async def get_connect_status(
    current_user: dict = Depends(get_current_user),
):
    """Get the Stripe Connect status for the salon."""
    result = await stripe_service.check_account_status(current_user["salon_id"])
    return ConnectStatusResponse(**result)


@router.post("/connect/onboard", response_model=CreateConnectLinkResponse)
async def create_connect_onboarding_link(
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Connect onboarding link for the salon."""
    if not stripe_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured"
        )

    result = await stripe_service.create_connect_account_link(current_user["salon_id"])

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to create onboarding link")
        )

    return CreateConnectLinkResponse(
        url=result["url"],
        stripe_account_id=result.get("stripe_account_id"),
    )


@router.get("/connect/oauth/callback")
async def handle_connect_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),  # salon_id
):
    """Handle OAuth callback from Stripe Connect."""
    result = await stripe_service.complete_connect_oauth(code, state)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to complete OAuth")
        )

    return {"message": "Stripe account connected successfully"}


@router.post("/connect/disconnect")
async def disconnect_stripe_account(
    current_user: dict = Depends(get_current_user),
):
    """Disconnect the Stripe Connect account."""
    result = await stripe_service.disconnect_account(current_user["salon_id"])
    return {"message": "Stripe account disconnected"}


# =====================
# Payment Endpoints
# =====================

@router.post("/payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    request: PaymentIntentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a payment intent for a deposit or payment."""
    result = await stripe_service.create_payment_intent(
        amount=request.amount,
        salon_id=current_user["salon_id"],
        client_id=request.client_id,
        appointment_id=request.appointment_id,
        description=request.description,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to create payment intent")
        )

    return PaymentIntentResponse(
        client_secret=result["client_secret"],
        payment_intent_id=result["payment_intent_id"],
    )


@router.post("/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(
    request: SetupIntentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a setup intent to save a card for future use."""
    result = await stripe_service.create_setup_intent(
        client_id=request.client_id,
        salon_id=current_user["salon_id"],
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to create setup intent")
        )

    return SetupIntentResponse(
        client_secret=result["client_secret"],
        setup_intent_id=result["setup_intent_id"],
    )


@router.post("/capture/{payment_intent_id}")
async def capture_payment(
    payment_intent_id: str,
    amount: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Capture a previously authorized payment."""
    result = await stripe_service.capture_payment(
        payment_intent_id=payment_intent_id,
        amount=amount,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to capture payment")
        )

    return result


@router.post("/refund")
async def refund_payment(
    request: RefundRequest,
    current_user: dict = Depends(get_current_user),
):
    """Refund a payment."""
    result = await stripe_service.refund_payment(
        payment_intent_id=request.payment_intent_id,
        amount=request.amount,
        reason=request.reason,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to process refund")
        )

    return result


@router.get("/payment-methods/{client_id}", response_model=list[PaymentMethodResponse])
async def get_payment_methods(
    client_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get saved payment methods for a client."""
    # Verify client belongs to salon
    clients_collection = get_collection("clients")
    client = await clients_collection.find_one({
        "_id": ObjectId(client_id),
        "salon_id": current_user["salon_id"],
    })

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    methods = await stripe_service.get_client_payment_methods(client_id)
    return [PaymentMethodResponse(**m) for m in methods]


# =====================
# Webhook Handler
# =====================

@router.post("/webhook")
async def handle_stripe_webhook(request: Request):
    """Handle Stripe webhooks."""
    import stripe

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle specific events
    event_type = event["type"]
    event_data = event["data"]["object"]

    if event_type == "payment_intent.succeeded":
        await handle_payment_succeeded(event_data)
    elif event_type == "payment_intent.payment_failed":
        await handle_payment_failed(event_data)
    elif event_type == "account.updated":
        await handle_account_updated(event_data)

    return {"received": True}


async def handle_payment_succeeded(payment_intent: dict):
    """Handle successful payment."""
    appointments_collection = get_collection("appointments")
    payments_collection = get_collection("payments")

    appointment_id = payment_intent.get("metadata", {}).get("appointment_id")

    if appointment_id:
        # Update appointment status
        await appointments_collection.update_one(
            {"_id": ObjectId(appointment_id)},
            {
                "$set": {
                    "deposit_captured": True,
                    "status": "confirmed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    # Log payment
    await payments_collection.insert_one({
        "payment_intent_id": payment_intent["id"],
        "amount": payment_intent["amount"],
        "currency": payment_intent["currency"],
        "status": "succeeded",
        "salon_id": payment_intent.get("metadata", {}).get("salon_id"),
        "client_id": payment_intent.get("metadata", {}).get("client_id"),
        "appointment_id": appointment_id,
        "created_at": datetime.now(timezone.utc),
    })


async def handle_payment_failed(payment_intent: dict):
    """Handle failed payment."""
    payments_collection = get_collection("payments")

    await payments_collection.insert_one({
        "payment_intent_id": payment_intent["id"],
        "amount": payment_intent["amount"],
        "currency": payment_intent["currency"],
        "status": "failed",
        "error": payment_intent.get("last_payment_error", {}).get("message"),
        "salon_id": payment_intent.get("metadata", {}).get("salon_id"),
        "client_id": payment_intent.get("metadata", {}).get("client_id"),
        "appointment_id": payment_intent.get("metadata", {}).get("appointment_id"),
        "created_at": datetime.now(timezone.utc),
    })


async def handle_account_updated(account: dict):
    """Handle Stripe Connect account updates."""
    salons_collection = get_collection("salons")

    # Find salon with this Stripe account
    salon = await salons_collection.find_one({"stripe_account_id": account["id"]})

    if salon and account.get("charges_enabled"):
        # Update onboarding status
        await salons_collection.update_one(
            {"_id": salon["_id"]},
            {
                "$set": {
                    "stripe_onboarding_complete": True,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
