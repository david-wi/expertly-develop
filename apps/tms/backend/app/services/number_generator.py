from datetime import datetime
from typing import Dict
import asyncio

from app.database import get_database


class NumberGenerator:
    """Generate sequential numbers for quotes, shipments, invoices."""

    _locks: Dict[str, asyncio.Lock] = {}

    @classmethod
    def _get_lock(cls, sequence_type: str) -> asyncio.Lock:
        """Get or create a lock for a sequence type."""
        if sequence_type not in cls._locks:
            cls._locks[sequence_type] = asyncio.Lock()
        return cls._locks[sequence_type]

    @classmethod
    async def get_next_number(cls, sequence_type: str, prefix: str) -> str:
        """
        Get the next number in a sequence.

        Args:
            sequence_type: Type of sequence (e.g., "quote", "shipment", "invoice")
            prefix: Prefix for the number (e.g., "Q", "S", "INV")

        Returns:
            Formatted number like "Q-2024-00001"
        """
        lock = cls._get_lock(sequence_type)

        async with lock:
            db = get_database()
            year = datetime.now().year

            # Find or create the sequence document
            result = await db.sequences.find_one_and_update(
                {"type": sequence_type, "year": year},
                {"$inc": {"current": 1}},
                upsert=True,
                return_document=True,
            )

            current = result["current"]
            return f"{prefix}-{year}-{current:05d}"

    @classmethod
    async def get_next_quote_number(cls) -> str:
        """Get next quote number."""
        return await cls.get_next_number("quote", "Q")

    @classmethod
    async def get_next_shipment_number(cls) -> str:
        """Get next shipment number."""
        return await cls.get_next_number("shipment", "S")

    @classmethod
    async def get_next_invoice_number(cls) -> str:
        """Get next invoice number."""
        return await cls.get_next_number("invoice", "INV")
