from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.carrier_compliance import (
    CarrierInsurance,
    CarrierCompliance,
    InsuranceType,
    ComplianceType,
    ComplianceStatus,
)

router = APIRouter()


# ============================================================================
# Insurance schemas
# ============================================================================

class InsuranceCreate(BaseModel):
    insurance_type: InsuranceType
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_amount: int = 0
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_current: bool = True


class InsuranceUpdate(BaseModel):
    insurance_type: Optional[InsuranceType] = None
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_amount: Optional[int] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_current: Optional[bool] = None


class InsuranceResponse(BaseModel):
    id: str
    carrier_id: str
    insurance_type: InsuranceType
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_amount: int
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    is_current: bool
    days_until_expiry: Optional[int] = None
    created_at: str
    updated_at: str


# ============================================================================
# Compliance schemas
# ============================================================================

class ComplianceCreate(BaseModel):
    compliance_type: ComplianceType
    status: ComplianceStatus = ComplianceStatus.PENDING
    details: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class ComplianceUpdate(BaseModel):
    compliance_type: Optional[ComplianceType] = None
    status: Optional[ComplianceStatus] = None
    details: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class ComplianceResponse(BaseModel):
    id: str
    carrier_id: str
    compliance_type: ComplianceType
    status: ComplianceStatus
    details: Optional[str] = None
    verified_at: Optional[str] = None
    expires_at: Optional[str] = None
    days_until_expiry: Optional[int] = None
    created_at: str
    updated_at: str


class ComplianceStatusSummary(BaseModel):
    carrier_id: str
    overall_status: str  # "compliant", "at_risk", "non_compliant"
    insurance_count: int
    compliance_count: int
    expiring_soon: int  # Items expiring within 30 days
    expired: int
    non_compliant: int
    issues: List[str]


class ComplianceCheckResult(BaseModel):
    carrier_id: str
    checked_at: str
    issues: List[str]
    warnings: List[str]
    expiring_insurance: List[InsuranceResponse]
    expired_compliance: List[ComplianceResponse]
    missing_records: List[str]


# ============================================================================
# Helpers
# ============================================================================

def insurance_to_response(insurance: CarrierInsurance) -> InsuranceResponse:
    days_until_expiry = None
    if insurance.expiry_date:
        now = datetime.now(timezone.utc)
        delta = insurance.expiry_date - now
        days_until_expiry = delta.days

    return InsuranceResponse(
        id=str(insurance.id),
        carrier_id=str(insurance.carrier_id),
        insurance_type=insurance.insurance_type,
        provider=insurance.provider,
        policy_number=insurance.policy_number,
        coverage_amount=insurance.coverage_amount,
        effective_date=insurance.effective_date.isoformat() if insurance.effective_date else None,
        expiry_date=insurance.expiry_date.isoformat() if insurance.expiry_date else None,
        is_current=insurance.is_current,
        days_until_expiry=days_until_expiry,
        created_at=insurance.created_at.isoformat(),
        updated_at=insurance.updated_at.isoformat(),
    )


def compliance_to_response(compliance: CarrierCompliance) -> ComplianceResponse:
    days_until_expiry = None
    if compliance.expires_at:
        now = datetime.now(timezone.utc)
        delta = compliance.expires_at - now
        days_until_expiry = delta.days

    return ComplianceResponse(
        id=str(compliance.id),
        carrier_id=str(compliance.carrier_id),
        compliance_type=compliance.compliance_type,
        status=compliance.status,
        details=compliance.details,
        verified_at=compliance.verified_at.isoformat() if compliance.verified_at else None,
        expires_at=compliance.expires_at.isoformat() if compliance.expires_at else None,
        days_until_expiry=days_until_expiry,
        created_at=compliance.created_at.isoformat(),
        updated_at=compliance.updated_at.isoformat(),
    )


# ============================================================================
# Insurance endpoints
# ============================================================================

@router.get("/{carrier_id}/insurance", response_model=List[InsuranceResponse])
async def list_carrier_insurance(carrier_id: str):
    """List all insurance records for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    cursor = db.carrier_insurance.find({"carrier_id": ObjectId(carrier_id)}).sort("insurance_type", 1)
    records = await cursor.to_list(1000)

    return [insurance_to_response(CarrierInsurance(**r)) for r in records]


@router.post("/{carrier_id}/insurance", response_model=InsuranceResponse)
async def create_carrier_insurance(carrier_id: str, data: InsuranceCreate):
    """Create an insurance record for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    insurance_data = data.model_dump()
    insurance_data["carrier_id"] = ObjectId(carrier_id)
    insurance = CarrierInsurance(**insurance_data)
    await db.carrier_insurance.insert_one(insurance.model_dump_mongo())

    return insurance_to_response(insurance)


# ============================================================================
# Compliance endpoints
# ============================================================================

@router.get("/{carrier_id}/compliance", response_model=List[ComplianceResponse])
async def list_carrier_compliance(carrier_id: str):
    """List all compliance records for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    cursor = db.carrier_compliance.find({"carrier_id": ObjectId(carrier_id)}).sort("compliance_type", 1)
    records = await cursor.to_list(1000)

    return [compliance_to_response(CarrierCompliance(**r)) for r in records]


@router.post("/{carrier_id}/compliance", response_model=ComplianceResponse)
async def create_carrier_compliance(carrier_id: str, data: ComplianceCreate):
    """Create a compliance record for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    compliance_data = data.model_dump()
    compliance_data["carrier_id"] = ObjectId(carrier_id)
    compliance = CarrierCompliance(**compliance_data)
    await db.carrier_compliance.insert_one(compliance.model_dump_mongo())

    return compliance_to_response(compliance)


@router.get("/{carrier_id}/compliance/status", response_model=ComplianceStatusSummary)
async def get_compliance_status(carrier_id: str):
    """Get overall compliance summary for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    now = datetime.now(timezone.utc)
    thirty_days = now + timedelta(days=30)

    # Get all insurance and compliance records
    insurance_cursor = db.carrier_insurance.find({"carrier_id": ObjectId(carrier_id)})
    insurance_records = await insurance_cursor.to_list(1000)

    compliance_cursor = db.carrier_compliance.find({"carrier_id": ObjectId(carrier_id)})
    compliance_records = await compliance_cursor.to_list(1000)

    expiring_soon = 0
    expired = 0
    non_compliant = 0
    issues: List[str] = []

    for r in insurance_records:
        ins = CarrierInsurance(**r)
        if ins.expiry_date:
            if ins.expiry_date < now:
                expired += 1
                issues.append(f"{ins.insurance_type.value} insurance expired")
            elif ins.expiry_date < thirty_days:
                expiring_soon += 1
                issues.append(f"{ins.insurance_type.value} insurance expiring soon")

    for r in compliance_records:
        comp = CarrierCompliance(**r)
        if comp.status == ComplianceStatus.NON_COMPLIANT:
            non_compliant += 1
            issues.append(f"{comp.compliance_type.value} is non-compliant")
        elif comp.status == ComplianceStatus.EXPIRED:
            expired += 1
            issues.append(f"{comp.compliance_type.value} has expired")
        if comp.expires_at:
            if comp.expires_at < now:
                expired += 1
            elif comp.expires_at < thirty_days:
                expiring_soon += 1

    # Determine overall status
    if expired > 0 or non_compliant > 0:
        overall_status = "non_compliant"
    elif expiring_soon > 0:
        overall_status = "at_risk"
    else:
        overall_status = "compliant"

    return ComplianceStatusSummary(
        carrier_id=carrier_id,
        overall_status=overall_status,
        insurance_count=len(insurance_records),
        compliance_count=len(compliance_records),
        expiring_soon=expiring_soon,
        expired=expired,
        non_compliant=non_compliant,
        issues=issues,
    )


@router.post("/{carrier_id}/compliance/check", response_model=ComplianceCheckResult)
async def run_compliance_check(carrier_id: str):
    """Run a compliance check on a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    now = datetime.now(timezone.utc)
    thirty_days = now + timedelta(days=30)

    insurance_cursor = db.carrier_insurance.find({"carrier_id": ObjectId(carrier_id)})
    insurance_records = await insurance_cursor.to_list(1000)

    compliance_cursor = db.carrier_compliance.find({"carrier_id": ObjectId(carrier_id)})
    compliance_records = await compliance_cursor.to_list(1000)

    issues: List[str] = []
    warnings: List[str] = []
    expiring_insurance: List[InsuranceResponse] = []
    expired_compliance: List[ComplianceResponse] = []
    missing_records: List[str] = []

    # Check for required insurance types
    existing_insurance_types = set()
    for r in insurance_records:
        ins = CarrierInsurance(**r)
        existing_insurance_types.add(ins.insurance_type)
        if ins.expiry_date:
            if ins.expiry_date < now:
                issues.append(f"{ins.insurance_type.value} insurance has expired")
                expiring_insurance.append(insurance_to_response(ins))
            elif ins.expiry_date < thirty_days:
                warnings.append(f"{ins.insurance_type.value} insurance expires in {(ins.expiry_date - now).days} days")
                expiring_insurance.append(insurance_to_response(ins))

    # Check for missing required insurance
    required_insurance = {InsuranceType.CARGO, InsuranceType.LIABILITY, InsuranceType.AUTO}
    missing_insurance = required_insurance - existing_insurance_types
    for missing in missing_insurance:
        missing_records.append(f"{missing.value} insurance")

    # Check compliance records
    for r in compliance_records:
        comp = CarrierCompliance(**r)
        if comp.status == ComplianceStatus.NON_COMPLIANT:
            issues.append(f"{comp.compliance_type.value} is non-compliant")
        elif comp.status == ComplianceStatus.EXPIRED:
            issues.append(f"{comp.compliance_type.value} has expired")
            expired_compliance.append(compliance_to_response(comp))
        if comp.expires_at and comp.expires_at < thirty_days and comp.expires_at > now:
            warnings.append(f"{comp.compliance_type.value} expires in {(comp.expires_at - now).days} days")

    # Check for missing required compliance records
    existing_compliance_types = {CarrierCompliance(**r).compliance_type for r in compliance_records}
    required_compliance = {ComplianceType.AUTHORITY, ComplianceType.SAFETY_RATING}
    missing_compliance = required_compliance - existing_compliance_types
    for missing in missing_compliance:
        missing_records.append(f"{missing.value} compliance record")

    return ComplianceCheckResult(
        carrier_id=carrier_id,
        checked_at=now.isoformat(),
        issues=issues,
        warnings=warnings,
        expiring_insurance=expiring_insurance,
        expired_compliance=expired_compliance,
        missing_records=missing_records,
    )
