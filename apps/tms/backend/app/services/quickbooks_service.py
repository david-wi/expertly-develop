"""
QuickBooks Online Integration Service.

Provides OAuth flow, entity sync, and webhook handling for QuickBooks Online.
"""

import os
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from ..models.accounting import (
    AccountingProvider,
    AccountingConnection,
    EntityMapping,
    SyncJob,
    SyncLogEntry,
    SyncStatus,
    SyncDirection,
    EntityType,
    QuickBooksCustomer,
    QuickBooksInvoice,
    QuickBooksPayment,
    QuickBooksVendor,
)


class QuickBooksService:
    """
    Service for QuickBooks Online integration.

    Handles:
    - OAuth2 authorization flow
    - Token refresh
    - Customer, Invoice, Payment sync
    - Vendor (carrier) and Bill sync
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.provider = AccountingProvider.QUICKBOOKS

        # OAuth configuration (from environment)
        self.client_id = os.getenv("QUICKBOOKS_CLIENT_ID")
        self.client_secret = os.getenv("QUICKBOOKS_CLIENT_SECRET")
        self.redirect_uri = os.getenv("QUICKBOOKS_REDIRECT_URI", "https://tms.ai.devintensive.com/api/v1/accounting/callback")

        # API URLs
        self.auth_url = "https://appcenter.intuit.com/connect/oauth2"
        self.token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
        self.api_base = "https://quickbooks.api.intuit.com/v3"

    # ==================== OAuth Flow ====================

    def get_authorization_url(self, state: str) -> str:
        """Generate QuickBooks OAuth authorization URL."""
        scope = "com.intuit.quickbooks.accounting"
        url = (
            f"{self.auth_url}"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope={scope}"
            f"&state={state}"
        )
        return url

    async def exchange_code_for_tokens(self, code: str, realm_id: str) -> AccountingConnection:
        """Exchange authorization code for access/refresh tokens."""
        # In production, this would make an HTTP request to token_url
        # POST with grant_type=authorization_code, code, redirect_uri

        # Mock token response for development
        connection = await self._get_or_create_connection()
        connection.access_token = f"mock_access_token_{datetime.utcnow().timestamp()}"
        connection.refresh_token = f"mock_refresh_token_{datetime.utcnow().timestamp()}"
        connection.token_expires_at = datetime.utcnow() + timedelta(hours=1)
        connection.company_id = realm_id
        connection.is_connected = True
        connection.connected_at = datetime.utcnow()
        connection.connection_error = None

        # Fetch company info
        connection.company_name = "Demo Company Inc."  # Would come from API

        await self._save_connection(connection)
        return connection

    async def refresh_access_token(self) -> Optional[AccountingConnection]:
        """Refresh expired access token using refresh token."""
        connection = await self.get_connection()
        if not connection or not connection.refresh_token:
            return None

        # In production, this would POST to token_url with grant_type=refresh_token

        # Mock refresh for development
        connection.access_token = f"mock_access_token_{datetime.utcnow().timestamp()}"
        connection.token_expires_at = datetime.utcnow() + timedelta(hours=1)

        await self._save_connection(connection)
        return connection

    async def disconnect(self) -> bool:
        """Revoke tokens and disconnect from QuickBooks."""
        connection = await self.get_connection()
        if not connection:
            return False

        # In production, this would POST to revocation endpoint

        connection.access_token = None
        connection.refresh_token = None
        connection.token_expires_at = None
        connection.is_connected = False
        connection.connected_at = None
        connection.company_id = None
        connection.company_name = None

        await self._save_connection(connection)
        return True

    # ==================== Connection Management ====================

    async def get_connection(self) -> Optional[AccountingConnection]:
        """Get the QuickBooks connection."""
        doc = await self.db.accounting_connections.find_one({
            "provider": self.provider.value
        })
        if doc:
            return AccountingConnection(**doc)
        return None

    async def _get_or_create_connection(self) -> AccountingConnection:
        """Get existing connection or create new one."""
        connection = await self.get_connection()
        if not connection:
            connection = AccountingConnection(provider=self.provider)
            result = await self.db.accounting_connections.insert_one(
                connection.model_dump(by_alias=True)
            )
            connection.id = result.inserted_id
        return connection

    async def _save_connection(self, connection: AccountingConnection) -> None:
        """Save connection to database."""
        await self.db.accounting_connections.update_one(
            {"_id": connection.id},
            {"$set": connection.model_dump(exclude={"id", "created_at"})}
        )

    async def update_connection_settings(self, settings: dict) -> AccountingConnection:
        """Update sync settings for the connection."""
        connection = await self._get_or_create_connection()

        allowed_fields = [
            "auto_sync_enabled", "sync_interval_minutes",
            "sync_customers", "sync_invoices", "sync_payments",
            "sync_vendors", "sync_bills",
            "revenue_account_id", "revenue_account_name",
            "expense_account_id", "expense_account_name",
            "ar_account_id", "ap_account_id",
            "tax_code_id", "tax_rate_percent"
        ]

        for field, value in settings.items():
            if field in allowed_fields:
                setattr(connection, field, value)

        await self._save_connection(connection)
        return connection

    async def _ensure_token_valid(self) -> bool:
        """Ensure access token is valid, refresh if needed."""
        connection = await self.get_connection()
        if not connection or not connection.is_connected:
            return False

        if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
            refreshed = await self.refresh_access_token()
            return refreshed is not None

        return True

    # ==================== Sync Operations ====================

    async def sync_all(self, full_sync: bool = False, triggered_by: str = "manual") -> SyncJob:
        """Run full sync of all enabled entity types."""
        connection = await self.get_connection()
        if not connection or not connection.is_connected:
            raise ValueError("QuickBooks not connected")

        # Determine which entities to sync
        entity_types = []
        if connection.sync_customers:
            entity_types.append(EntityType.CUSTOMER)
        if connection.sync_invoices:
            entity_types.append(EntityType.INVOICE)
        if connection.sync_payments:
            entity_types.append(EntityType.PAYMENT)
        if connection.sync_vendors:
            entity_types.append(EntityType.VENDOR)
        if connection.sync_bills:
            entity_types.append(EntityType.BILL)

        # Create sync job
        job = SyncJob(
            provider=self.provider,
            direction=SyncDirection.TO_ACCOUNTING,
            status=SyncStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
            triggered_by=triggered_by,
            entity_types=entity_types,
            full_sync=full_sync,
        )
        result = await self.db.accounting_sync_jobs.insert_one(
            job.model_dump(by_alias=True)
        )
        job.id = result.inserted_id

        try:
            # Sync each entity type
            for entity_type in entity_types:
                if entity_type == EntityType.CUSTOMER:
                    await self._sync_customers(job)
                elif entity_type == EntityType.INVOICE:
                    await self._sync_invoices(job)
                elif entity_type == EntityType.PAYMENT:
                    await self._sync_payments(job)
                elif entity_type == EntityType.VENDOR:
                    await self._sync_vendors(job)

            job.status = SyncStatus.COMPLETED if job.failed_count == 0 else SyncStatus.PARTIAL

        except Exception as e:
            job.status = SyncStatus.FAILED
            job.error_message = str(e)

        job.completed_at = datetime.utcnow()
        await self._update_sync_job(job)

        # Update connection last sync time
        connection.last_sync_at = datetime.utcnow()
        await self._save_connection(connection)

        return job

    async def sync_entity(self, entity_type: EntityType, entity_id: str) -> SyncLogEntry:
        """Sync a single entity to QuickBooks."""
        connection = await self.get_connection()
        if not connection or not connection.is_connected:
            raise ValueError("QuickBooks not connected")

        await self._ensure_token_valid()

        if entity_type == EntityType.CUSTOMER:
            return await self._sync_single_customer(entity_id)
        elif entity_type == EntityType.INVOICE:
            return await self._sync_single_invoice(entity_id)
        elif entity_type == EntityType.VENDOR:
            return await self._sync_single_vendor(entity_id)
        else:
            raise ValueError(f"Unsupported entity type: {entity_type}")

    async def _sync_customers(self, job: SyncJob) -> None:
        """Sync all customers to QuickBooks."""
        cursor = self.db.customers.find({"status": "active"})
        async for customer_doc in cursor:
            job.total_records += 1
            try:
                entry = await self._sync_single_customer(str(customer_doc["_id"]))
                job.log_entries.append(entry)
                if entry.status == SyncStatus.COMPLETED:
                    job.synced_count += 1
                else:
                    job.failed_count += 1
            except Exception as e:
                job.failed_count += 1
                job.log_entries.append(SyncLogEntry(
                    entity_type=EntityType.CUSTOMER,
                    tms_entity_id=str(customer_doc["_id"]),
                    operation="sync",
                    status=SyncStatus.FAILED,
                    error_message=str(e),
                ))

    async def _sync_single_customer(self, customer_id: str) -> SyncLogEntry:
        """Sync a single customer to QuickBooks."""
        customer_doc = await self.db.customers.find_one({"_id": ObjectId(customer_id)})
        if not customer_doc:
            return SyncLogEntry(
                entity_type=EntityType.CUSTOMER,
                tms_entity_id=customer_id,
                operation="sync",
                status=SyncStatus.FAILED,
                error_message="Customer not found",
            )

        # Check for existing mapping
        mapping = await self._get_mapping(EntityType.CUSTOMER, customer_id)

        # Build QuickBooks customer object
        qb_customer = QuickBooksCustomer(
            display_name=customer_doc["name"],
            company_name=customer_doc.get("name"),
            primary_email=customer_doc.get("billing_email"),
            primary_phone=customer_doc.get("phone"),
            billing_address_line1=customer_doc.get("address_line1"),
            billing_city=customer_doc.get("city"),
            billing_state=customer_doc.get("state"),
            billing_postal_code=customer_doc.get("zip_code"),
            billing_country=customer_doc.get("country", "US"),
        )

        # In production, this would POST/PUT to QuickBooks API
        # For now, mock the response
        if mapping:
            # Update existing
            qb_customer.id = mapping.provider_entity_id
            operation = "update"
        else:
            # Create new - mock ID generation
            qb_customer.id = f"QBC-{customer_id[-8:]}"
            operation = "create"

            # Save mapping
            mapping = EntityMapping(
                provider=self.provider,
                entity_type=EntityType.CUSTOMER,
                tms_entity_id=ObjectId(customer_id),
                tms_entity_name=customer_doc["name"],
                provider_entity_id=qb_customer.id,
                provider_entity_name=qb_customer.display_name,
                last_synced_at=datetime.utcnow(),
            )
            await self.db.accounting_mappings.insert_one(
                mapping.model_dump(by_alias=True)
            )

        return SyncLogEntry(
            entity_type=EntityType.CUSTOMER,
            tms_entity_id=customer_id,
            provider_entity_id=qb_customer.id,
            operation=operation,
            status=SyncStatus.COMPLETED,
        )

    async def _sync_invoices(self, job: SyncJob) -> None:
        """Sync all sent/pending invoices to QuickBooks."""
        cursor = self.db.invoices.find({
            "status": {"$in": ["sent", "pending", "partial"]}
        })
        async for invoice_doc in cursor:
            job.total_records += 1
            try:
                entry = await self._sync_single_invoice(str(invoice_doc["_id"]))
                job.log_entries.append(entry)
                if entry.status == SyncStatus.COMPLETED:
                    job.synced_count += 1
                else:
                    job.failed_count += 1
            except Exception as e:
                job.failed_count += 1
                job.log_entries.append(SyncLogEntry(
                    entity_type=EntityType.INVOICE,
                    tms_entity_id=str(invoice_doc["_id"]),
                    operation="sync",
                    status=SyncStatus.FAILED,
                    error_message=str(e),
                ))

    async def _sync_single_invoice(self, invoice_id: str) -> SyncLogEntry:
        """Sync a single invoice to QuickBooks."""
        invoice_doc = await self.db.invoices.find_one({"_id": ObjectId(invoice_id)})
        if not invoice_doc:
            return SyncLogEntry(
                entity_type=EntityType.INVOICE,
                tms_entity_id=invoice_id,
                operation="sync",
                status=SyncStatus.FAILED,
                error_message="Invoice not found",
            )

        # Ensure customer is synced first
        customer_mapping = await self._get_mapping(
            EntityType.CUSTOMER,
            str(invoice_doc["customer_id"])
        )
        if not customer_mapping:
            # Sync customer first
            await self._sync_single_customer(str(invoice_doc["customer_id"]))
            customer_mapping = await self._get_mapping(
                EntityType.CUSTOMER,
                str(invoice_doc["customer_id"])
            )
            if not customer_mapping:
                return SyncLogEntry(
                    entity_type=EntityType.INVOICE,
                    tms_entity_id=invoice_id,
                    operation="sync",
                    status=SyncStatus.FAILED,
                    error_message="Failed to sync customer first",
                )

        # Check for existing mapping
        mapping = await self._get_mapping(EntityType.INVOICE, invoice_id)

        # Build line items
        line_items = []
        for item in invoice_doc.get("line_items", []):
            line_items.append({
                "Description": item.get("description"),
                "Amount": item.get("quantity", 1) * item.get("unit_price", 0) / 100,
                "DetailType": "SalesItemLineDetail",
            })

        invoice_date = invoice_doc.get("invoice_date")
        if isinstance(invoice_date, datetime):
            invoice_date = invoice_date.strftime("%Y-%m-%d")

        qb_invoice = QuickBooksInvoice(
            doc_number=invoice_doc.get("invoice_number", ""),
            customer_ref_id=customer_mapping.provider_entity_id,
            customer_ref_name=customer_mapping.provider_entity_name,
            txn_date=invoice_date or datetime.utcnow().strftime("%Y-%m-%d"),
            due_date=invoice_doc.get("due_date"),
            line_items=line_items,
            total_amount=invoice_doc.get("total", 0) / 100,
        )

        # Mock sync
        if mapping:
            qb_invoice.id = mapping.provider_entity_id
            operation = "update"
        else:
            qb_invoice.id = f"QBI-{invoice_id[-8:]}"
            operation = "create"

            mapping = EntityMapping(
                provider=self.provider,
                entity_type=EntityType.INVOICE,
                tms_entity_id=ObjectId(invoice_id),
                tms_entity_name=invoice_doc.get("invoice_number"),
                provider_entity_id=qb_invoice.id,
                last_synced_at=datetime.utcnow(),
            )
            await self.db.accounting_mappings.insert_one(
                mapping.model_dump(by_alias=True)
            )

        return SyncLogEntry(
            entity_type=EntityType.INVOICE,
            tms_entity_id=invoice_id,
            provider_entity_id=qb_invoice.id,
            operation=operation,
            status=SyncStatus.COMPLETED,
        )

    async def _sync_payments(self, job: SyncJob) -> None:
        """Sync payments from QuickBooks (payments are usually entered in accounting)."""
        # For payments, we typically sync FROM QuickBooks to TMS
        # This would fetch payments from QBO and update invoice paid amounts
        pass

    async def _sync_vendors(self, job: SyncJob) -> None:
        """Sync carriers as vendors to QuickBooks."""
        cursor = self.db.carriers.find({"status": "active"})
        async for carrier_doc in cursor:
            job.total_records += 1
            try:
                entry = await self._sync_single_vendor(str(carrier_doc["_id"]))
                job.log_entries.append(entry)
                if entry.status == SyncStatus.COMPLETED:
                    job.synced_count += 1
                else:
                    job.failed_count += 1
            except Exception as e:
                job.failed_count += 1
                job.log_entries.append(SyncLogEntry(
                    entity_type=EntityType.VENDOR,
                    tms_entity_id=str(carrier_doc["_id"]),
                    operation="sync",
                    status=SyncStatus.FAILED,
                    error_message=str(e),
                ))

    async def _sync_single_vendor(self, carrier_id: str) -> SyncLogEntry:
        """Sync a single carrier as vendor to QuickBooks."""
        carrier_doc = await self.db.carriers.find_one({"_id": ObjectId(carrier_id)})
        if not carrier_doc:
            return SyncLogEntry(
                entity_type=EntityType.VENDOR,
                tms_entity_id=carrier_id,
                operation="sync",
                status=SyncStatus.FAILED,
                error_message="Carrier not found",
            )

        mapping = await self._get_mapping(EntityType.VENDOR, carrier_id)

        qb_vendor = QuickBooksVendor(
            display_name=carrier_doc["name"],
            company_name=carrier_doc.get("name"),
            primary_email=carrier_doc.get("dispatch_email"),
            primary_phone=carrier_doc.get("dispatch_phone"),
            notes=f"MC# {carrier_doc.get('mc_number', 'N/A')}",
        )

        if mapping:
            qb_vendor.id = mapping.provider_entity_id
            operation = "update"
        else:
            qb_vendor.id = f"QBV-{carrier_id[-8:]}"
            operation = "create"

            mapping = EntityMapping(
                provider=self.provider,
                entity_type=EntityType.VENDOR,
                tms_entity_id=ObjectId(carrier_id),
                tms_entity_name=carrier_doc["name"],
                provider_entity_id=qb_vendor.id,
                provider_entity_name=qb_vendor.display_name,
                last_synced_at=datetime.utcnow(),
            )
            await self.db.accounting_mappings.insert_one(
                mapping.model_dump(by_alias=True)
            )

        return SyncLogEntry(
            entity_type=EntityType.VENDOR,
            tms_entity_id=carrier_id,
            provider_entity_id=qb_vendor.id,
            operation=operation,
            status=SyncStatus.COMPLETED,
        )

    # ==================== Mapping Helpers ====================

    async def _get_mapping(
        self,
        entity_type: EntityType,
        tms_entity_id: str
    ) -> Optional[EntityMapping]:
        """Get mapping for a TMS entity."""
        doc = await self.db.accounting_mappings.find_one({
            "provider": self.provider.value,
            "entity_type": entity_type.value,
            "tms_entity_id": ObjectId(tms_entity_id),
        })
        if doc:
            return EntityMapping(**doc)
        return None

    async def get_mappings(
        self,
        entity_type: Optional[EntityType] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[EntityMapping]:
        """Get entity mappings."""
        query = {"provider": self.provider.value}
        if entity_type:
            query["entity_type"] = entity_type.value

        cursor = self.db.accounting_mappings.find(query).skip(skip).limit(limit)
        mappings = []
        async for doc in cursor:
            mappings.append(EntityMapping(**doc))
        return mappings

    # ==================== Sync Job Helpers ====================

    async def _update_sync_job(self, job: SyncJob) -> None:
        """Update sync job in database."""
        await self.db.accounting_sync_jobs.update_one(
            {"_id": job.id},
            {"$set": job.model_dump(exclude={"id", "created_at"})}
        )

    async def get_sync_jobs(
        self,
        status: Optional[SyncStatus] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[SyncJob]:
        """Get sync job history."""
        query = {"provider": self.provider.value}
        if status:
            query["status"] = status.value

        cursor = (
            self.db.accounting_sync_jobs
            .find(query)
            .skip(skip)
            .limit(limit)
            .sort("created_at", -1)
        )
        jobs = []
        async for doc in cursor:
            jobs.append(SyncJob(**doc))
        return jobs

    async def get_sync_job(self, job_id: str) -> Optional[SyncJob]:
        """Get a specific sync job."""
        doc = await self.db.accounting_sync_jobs.find_one({"_id": ObjectId(job_id)})
        if doc:
            return SyncJob(**doc)
        return None
