"""Stripe service for payments and Stripe Connect."""

import stripe
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from ..config import settings
from ..core.database import get_collection


# Initialize Stripe
stripe.api_key = settings.stripe_secret_key


class StripeService:
    """Service for handling Stripe payments and Connect."""

    def __init__(self):
        self.api_key = settings.stripe_secret_key
        self.connect_client_id = settings.stripe_connect_client_id

    def is_configured(self) -> bool:
        """Check if Stripe is properly configured."""
        return bool(self.api_key)

    # =====================
    # Stripe Connect
    # =====================

    def get_connect_oauth_url(self, salon_id: str, redirect_uri: str) -> str:
        """Generate OAuth URL for Stripe Connect onboarding."""
        params = {
            "client_id": self.connect_client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": "read_write",
            "state": salon_id,  # Use salon_id as state for verification
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://connect.stripe.com/oauth/authorize?{query}"

    async def complete_connect_oauth(self, code: str, salon_id: str) -> dict:
        """Complete the OAuth flow and save the connected account."""
        try:
            response = stripe.OAuth.token(
                grant_type="authorization_code",
                code=code,
            )

            stripe_account_id = response.get("stripe_user_id")
            if not stripe_account_id:
                return {"success": False, "error": "No account ID returned"}

            # Save to salon
            salons_collection = get_collection("salons")
            await salons_collection.update_one(
                {"_id": ObjectId(salon_id)},
                {
                    "$set": {
                        "stripe_account_id": stripe_account_id,
                        "stripe_onboarding_complete": True,
                        "stripe_connected_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

            return {
                "success": True,
                "stripe_account_id": stripe_account_id,
            }

        except stripe.error.OAuthError as e:
            return {"success": False, "error": str(e)}

    async def create_connect_account_link(self, salon_id: str) -> dict:
        """Create an account link for Stripe Express onboarding."""
        salons_collection = get_collection("salons")
        salon = await salons_collection.find_one({"_id": ObjectId(salon_id)})

        if not salon:
            return {"success": False, "error": "Salon not found"}

        try:
            # Create Express account if none exists
            if not salon.get("stripe_account_id"):
                account = stripe.Account.create(
                    type="express",
                    country="US",
                    email=salon.get("email"),
                    business_type="company",
                    capabilities={
                        "card_payments": {"requested": True},
                        "transfers": {"requested": True},
                    },
                )
                stripe_account_id = account.id

                # Save account ID
                await salons_collection.update_one(
                    {"_id": ObjectId(salon_id)},
                    {
                        "$set": {
                            "stripe_account_id": stripe_account_id,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
            else:
                stripe_account_id = salon["stripe_account_id"]

            # Create account link
            account_link = stripe.AccountLink.create(
                account=stripe_account_id,
                refresh_url=f"{settings.stripe_connect_redirect_url}?refresh=true",
                return_url=f"{settings.stripe_connect_redirect_url}",
                type="account_onboarding",
            )

            return {
                "success": True,
                "url": account_link.url,
                "stripe_account_id": stripe_account_id,
            }

        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    async def check_account_status(self, salon_id: str) -> dict:
        """Check if a connected account is fully onboarded."""
        salons_collection = get_collection("salons")
        salon = await salons_collection.find_one({"_id": ObjectId(salon_id)})

        if not salon or not salon.get("stripe_account_id"):
            return {
                "connected": False,
                "onboarding_complete": False,
                "charges_enabled": False,
                "payouts_enabled": False,
            }

        try:
            account = stripe.Account.retrieve(salon["stripe_account_id"])

            # Update salon if onboarding is now complete
            if account.charges_enabled and not salon.get("stripe_onboarding_complete"):
                await salons_collection.update_one(
                    {"_id": ObjectId(salon_id)},
                    {
                        "$set": {
                            "stripe_onboarding_complete": True,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )

            return {
                "connected": True,
                "onboarding_complete": account.details_submitted,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "requirements": account.requirements.currently_due if account.requirements else [],
            }

        except stripe.error.StripeError as e:
            return {"connected": False, "error": str(e)}

    async def disconnect_account(self, salon_id: str) -> dict:
        """Disconnect a Stripe Connect account."""
        salons_collection = get_collection("salons")

        await salons_collection.update_one(
            {"_id": ObjectId(salon_id)},
            {
                "$set": {
                    "stripe_account_id": None,
                    "stripe_onboarding_complete": False,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$unset": {"stripe_connected_at": ""},
            },
        )

        return {"success": True}

    # =====================
    # Payments
    # =====================

    async def create_payment_intent(
        self,
        amount: int,  # Amount in cents
        currency: str = "usd",
        salon_id: Optional[str] = None,
        client_id: Optional[str] = None,
        appointment_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict:
        """Create a payment intent for collecting payment."""
        salons_collection = get_collection("salons")
        clients_collection = get_collection("clients")

        try:
            # Get salon's connected account
            salon = await salons_collection.find_one({"_id": ObjectId(salon_id)}) if salon_id else None
            connected_account = salon.get("stripe_account_id") if salon else None

            # Get or create customer
            customer_id = None
            if client_id:
                client = await clients_collection.find_one({"_id": ObjectId(client_id)})
                if client:
                    customer_id = client.get("stripe_customer_id")

            # Build payment intent params
            params = {
                "amount": amount,
                "currency": currency,
                "automatic_payment_methods": {"enabled": True},
                "metadata": {
                    "salon_id": salon_id or "",
                    "client_id": client_id or "",
                    "appointment_id": appointment_id or "",
                },
            }

            if description:
                params["description"] = description

            if customer_id:
                params["customer"] = customer_id

            # If using Connect, add application fee and connected account
            if connected_account:
                # Take 2.5% platform fee
                application_fee = int(amount * 0.025)
                params["application_fee_amount"] = application_fee
                params["transfer_data"] = {"destination": connected_account}

            payment_intent = stripe.PaymentIntent.create(**params)

            return {
                "success": True,
                "client_secret": payment_intent.client_secret,
                "payment_intent_id": payment_intent.id,
            }

        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    async def create_setup_intent(
        self,
        client_id: str,
        salon_id: str,
    ) -> dict:
        """Create a SetupIntent for saving a card for future use."""
        clients_collection = get_collection("clients")
        salons_collection = get_collection("salons")

        try:
            client = await clients_collection.find_one({"_id": ObjectId(client_id)})
            if not client:
                return {"success": False, "error": "Client not found"}

            salon = await salons_collection.find_one({"_id": ObjectId(salon_id)})
            connected_account = salon.get("stripe_account_id") if salon else None

            # Get or create Stripe customer
            customer_id = client.get("stripe_customer_id")
            if not customer_id:
                customer = stripe.Customer.create(
                    email=client.get("email"),
                    name=f"{client['first_name']} {client['last_name']}",
                    phone=client.get("phone"),
                    metadata={"salon_client_id": client_id},
                )
                customer_id = customer.id

                # Save customer ID to client
                await clients_collection.update_one(
                    {"_id": ObjectId(client_id)},
                    {
                        "$set": {
                            "stripe_customer_id": customer_id,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )

            # Create setup intent
            params = {
                "customer": customer_id,
                "automatic_payment_methods": {"enabled": True},
                "metadata": {
                    "salon_id": salon_id,
                    "client_id": client_id,
                },
            }

            # For connected accounts, use on_behalf_of
            if connected_account:
                params["on_behalf_of"] = connected_account

            setup_intent = stripe.SetupIntent.create(**params)

            return {
                "success": True,
                "client_secret": setup_intent.client_secret,
                "setup_intent_id": setup_intent.id,
            }

        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    async def capture_payment(
        self,
        payment_intent_id: str,
        amount: Optional[int] = None,
    ) -> dict:
        """Capture a previously authorized payment."""
        try:
            params = {}
            if amount:
                params["amount_to_capture"] = amount

            payment_intent = stripe.PaymentIntent.capture(
                payment_intent_id,
                **params,
            )

            return {
                "success": True,
                "status": payment_intent.status,
                "amount_captured": payment_intent.amount_received,
            }

        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    async def refund_payment(
        self,
        payment_intent_id: str,
        amount: Optional[int] = None,
        reason: str = "requested_by_customer",
    ) -> dict:
        """Refund a payment."""
        try:
            params = {
                "payment_intent": payment_intent_id,
                "reason": reason,
            }
            if amount:
                params["amount"] = amount

            refund = stripe.Refund.create(**params)

            return {
                "success": True,
                "refund_id": refund.id,
                "amount": refund.amount,
                "status": refund.status,
            }

        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    async def get_client_payment_methods(self, client_id: str) -> list:
        """Get saved payment methods for a client."""
        clients_collection = get_collection("clients")
        client = await clients_collection.find_one({"_id": ObjectId(client_id)})

        if not client or not client.get("stripe_customer_id"):
            return []

        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=client["stripe_customer_id"],
                type="card",
            )

            return [
                {
                    "id": pm.id,
                    "brand": pm.card.brand,
                    "last4": pm.card.last4,
                    "exp_month": pm.card.exp_month,
                    "exp_year": pm.card.exp_year,
                }
                for pm in payment_methods.data
            ]

        except stripe.error.StripeError:
            return []


# Singleton instance
stripe_service = StripeService()
