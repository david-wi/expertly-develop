from typing import List, Optional
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.customer import Customer, CustomerStatus
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter()


def customer_to_response(customer: Customer) -> CustomerResponse:
    """Convert Customer model to response schema."""
    return CustomerResponse(
        id=str(customer.id),
        name=customer.name,
        code=customer.code,
        status=customer.status,
        contacts=customer.contacts,
        billing_email=customer.billing_email,
        address_line1=customer.address_line1,
        address_line2=customer.address_line2,
        city=customer.city,
        state=customer.state,
        zip_code=customer.zip_code,
        country=customer.country,
        payment_terms=customer.payment_terms,
        credit_limit=customer.credit_limit,
        default_margin_percent=customer.default_margin_percent,
        pricing_notes=customer.pricing_notes,
        notes=customer.notes,
        total_shipments=customer.total_shipments,
        total_revenue=customer.total_revenue,
        last_shipment_at=customer.last_shipment_at,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )


@router.get("", response_model=List[CustomerResponse])
async def list_customers(
    status: Optional[CustomerStatus] = None,
    search: Optional[str] = None,
):
    """List all customers with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.customers.find(query).sort("name", 1)
    customers = await cursor.to_list(1000)

    return [customer_to_response(Customer(**c)) for c in customers]


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str):
    """Get a customer by ID."""
    db = get_database()

    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer_to_response(Customer(**customer))


@router.post("", response_model=CustomerResponse)
async def create_customer(data: CustomerCreate):
    """Create a new customer."""
    db = get_database()

    customer = Customer(**data.model_dump())
    await db.customers.insert_one(customer.model_dump_mongo())

    return customer_to_response(customer)


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, data: CustomerUpdate):
    """Update a customer."""
    db = get_database()

    customer_doc = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer_doc:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer = Customer(**customer_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != customer.status:
            customer.transition_to(new_status)

    for field, value in update_data.items():
        setattr(customer, field, value)

    customer.mark_updated()

    await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": customer.model_dump_mongo()}
    )

    return customer_to_response(customer)


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer."""
    db = get_database()

    result = await db.customers.delete_one({"_id": ObjectId(customer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {"success": True}
