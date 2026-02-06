from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.customer_contact import CustomerContact

router = APIRouter()


class CustomerContactCreate(BaseModel):
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False
    department: Optional[str] = None
    notes: Optional[str] = None


class CustomerContactUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: Optional[bool] = None
    department: Optional[str] = None
    notes: Optional[str] = None


class CustomerContactResponse(BaseModel):
    id: str
    customer_id: str
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool
    department: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


def contact_to_response(contact: CustomerContact) -> CustomerContactResponse:
    return CustomerContactResponse(
        id=str(contact.id),
        customer_id=str(contact.customer_id),
        name=contact.name,
        title=contact.title,
        email=contact.email,
        phone=contact.phone,
        is_primary=contact.is_primary,
        department=contact.department,
        notes=contact.notes,
        created_at=contact.created_at.isoformat(),
        updated_at=contact.updated_at.isoformat(),
    )


@router.get("/{customer_id}/contacts", response_model=List[CustomerContactResponse])
async def list_customer_contacts(customer_id: str):
    """List all contacts for a customer."""
    db = get_database()

    # Verify customer exists
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    cursor = db.customer_contacts.find({"customer_id": ObjectId(customer_id)}).sort("name", 1)
    contacts = await cursor.to_list(1000)

    return [contact_to_response(CustomerContact(**c)) for c in contacts]


@router.post("/{customer_id}/contacts", response_model=CustomerContactResponse)
async def create_customer_contact(customer_id: str, data: CustomerContactCreate):
    """Create a contact for a customer."""
    db = get_database()

    # Verify customer exists
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # If this is primary, unset other primary contacts
    if data.is_primary:
        await db.customer_contacts.update_many(
            {"customer_id": ObjectId(customer_id), "is_primary": True},
            {"$set": {"is_primary": False}},
        )

    contact_data = data.model_dump()
    contact_data["customer_id"] = ObjectId(customer_id)
    contact = CustomerContact(**contact_data)
    await db.customer_contacts.insert_one(contact.model_dump_mongo())

    return contact_to_response(contact)


@router.patch("/{customer_id}/contacts/{contact_id}", response_model=CustomerContactResponse)
async def update_customer_contact(customer_id: str, contact_id: str, data: CustomerContactUpdate):
    """Update a customer contact."""
    db = get_database()

    contact_doc = await db.customer_contacts.find_one({
        "_id": ObjectId(contact_id),
        "customer_id": ObjectId(customer_id),
    })
    if not contact_doc:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = CustomerContact(**contact_doc)
    update_data = data.model_dump(exclude_unset=True)

    # If setting as primary, unset other primary contacts
    if update_data.get("is_primary"):
        await db.customer_contacts.update_many(
            {"customer_id": ObjectId(customer_id), "is_primary": True, "_id": {"$ne": ObjectId(contact_id)}},
            {"$set": {"is_primary": False}},
        )

    for field, value in update_data.items():
        setattr(contact, field, value)

    contact.mark_updated()

    await db.customer_contacts.update_one(
        {"_id": ObjectId(contact_id)},
        {"$set": contact.model_dump_mongo()},
    )

    return contact_to_response(contact)


@router.delete("/{customer_id}/contacts/{contact_id}")
async def delete_customer_contact(customer_id: str, contact_id: str):
    """Delete a customer contact."""
    db = get_database()

    result = await db.customer_contacts.delete_one({
        "_id": ObjectId(contact_id),
        "customer_id": ObjectId(customer_id),
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {"success": True}
