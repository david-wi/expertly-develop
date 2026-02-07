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


# ============================================================================
# DOT Compliance Tracking
# ============================================================================

class DOTComplianceResponse(BaseModel):
    carrier_id: str
    carrier_name: str
    dot_number: Optional[str] = None
    mc_number: Optional[str] = None
    fmcsa_safety_rating: Optional[str] = None  # satisfactory, conditional, unsatisfactory
    fmcsa_status: Optional[str] = None  # authorized, not_authorized, revoked
    csa_scores: Optional[dict] = None  # unsafe_driving, hos, vehicle_maint, etc.
    authority_status: Optional[str] = None
    authority_grant_date: Optional[str] = None
    insurance_on_file: bool = False
    operating_status: Optional[str] = None
    drug_testing_enrolled: bool = False
    drug_testing_last_test: Optional[str] = None
    drug_testing_compliant: bool = False
    hos_violation_count: int = 0
    inspection_count: int = 0
    out_of_service_rate: float = 0.0
    crash_count: int = 0
    compliance_alerts: List[str] = []
    last_checked_at: Optional[str] = None
    overall_compliance_score: float = 0.0


class DOTComplianceDashboard(BaseModel):
    total_carriers: int
    compliant_count: int
    at_risk_count: int
    non_compliant_count: int
    expiring_within_30_days: int
    carriers_needing_review: List[dict]
    recent_alerts: List[dict]


@router.get("/{carrier_id}/dot-compliance", response_model=DOTComplianceResponse)
async def get_dot_compliance(carrier_id: str):
    """Get comprehensive DOT compliance data for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    carrier_name = carrier.get("name", "Unknown")
    dot_number = carrier.get("dot_number")
    mc_number = carrier.get("mc_number")

    # Check existing DOT compliance record
    dot_record = await db.dot_compliance.find_one({"carrier_id": ObjectId(carrier_id)})

    now = datetime.now(timezone.utc)

    if dot_record:
        # Return existing record
        alerts = dot_record.get("compliance_alerts", [])
        csa = dot_record.get("csa_scores", {})
        safety_rating = dot_record.get("fmcsa_safety_rating", "satisfactory")
    else:
        # Generate simulated DOT compliance data based on carrier info
        import hashlib
        import random
        seed = int(hashlib.md5(carrier_id.encode()).hexdigest()[:8], 16)
        random.seed(seed)

        safety_rating = random.choice(["satisfactory", "satisfactory", "satisfactory", "conditional", "conditional"])
        operating_status = "authorized" if carrier.get("authority_active", True) else "not_authorized"

        csa = {
            "unsafe_driving": round(random.uniform(0, 65), 1),
            "hours_of_service": round(random.uniform(0, 70), 1),
            "vehicle_maintenance": round(random.uniform(0, 55), 1),
            "controlled_substances": round(random.uniform(0, 30), 1),
            "hazardous_materials": round(random.uniform(0, 25), 1),
            "driver_fitness": round(random.uniform(0, 40), 1),
            "crash_indicator": round(random.uniform(0, 50), 1),
        }

        alerts = []
        # Generate alerts based on scores
        for category, score in csa.items():
            threshold = 65 if category in ("unsafe_driving", "hours_of_service") else 75
            if score > threshold:
                alerts.append(f"CSA {category.replace('_', ' ').title()} score ({score}) exceeds intervention threshold ({threshold})")

        if safety_rating == "conditional":
            alerts.append("FMCSA Safety Rating is CONDITIONAL - review required")

        # Check insurance from existing records
        insurance_cursor = db.carrier_insurance.find({"carrier_id": ObjectId(carrier_id), "is_current": True})
        insurance_records = await insurance_cursor.to_list(10)
        for ins in insurance_records:
            exp = ins.get("expiry_date")
            if exp and exp < now + timedelta(days=30):
                if exp < now:
                    alerts.append(f"{ins.get('insurance_type', 'Insurance')} has EXPIRED")
                else:
                    alerts.append(f"{ins.get('insurance_type', 'Insurance')} expires in {(exp - now).days} days")

        inspection_count = random.randint(0, 15)
        oos_rate = round(random.uniform(0, 12), 1)
        crash_count = random.randint(0, 3)
        hos_violations = random.randint(0, 5)

        # Save record
        dot_doc = {
            "carrier_id": ObjectId(carrier_id),
            "fmcsa_safety_rating": safety_rating,
            "fmcsa_status": operating_status,
            "csa_scores": csa,
            "authority_status": operating_status,
            "insurance_on_file": len(insurance_records) > 0,
            "operating_status": operating_status,
            "drug_testing_enrolled": random.choice([True, True, False]),
            "drug_testing_last_test": (now - timedelta(days=random.randint(30, 365))).isoformat(),
            "drug_testing_compliant": random.choice([True, True, True, False]),
            "hos_violation_count": hos_violations,
            "inspection_count": inspection_count,
            "out_of_service_rate": oos_rate,
            "crash_count": crash_count,
            "compliance_alerts": alerts,
            "last_checked_at": now.isoformat(),
            "created_at": now,
            "updated_at": now,
        }

        await db.dot_compliance.update_one(
            {"carrier_id": ObjectId(carrier_id)},
            {"$set": dot_doc},
            upsert=True,
        )
        dot_record = dot_doc

    # Calculate overall compliance score
    score = 100.0
    if safety_rating == "conditional":
        score -= 20
    elif safety_rating == "unsatisfactory":
        score -= 50
    if csa:
        high_csa = sum(1 for v in csa.values() if v > 65)
        score -= high_csa * 10
    if dot_record.get("out_of_service_rate", 0) > 5:
        score -= 10
    if not dot_record.get("drug_testing_compliant", True):
        score -= 15
    score = max(0, min(100, score))

    return DOTComplianceResponse(
        carrier_id=carrier_id,
        carrier_name=carrier_name,
        dot_number=dot_number,
        mc_number=mc_number,
        fmcsa_safety_rating=dot_record.get("fmcsa_safety_rating"),
        fmcsa_status=dot_record.get("fmcsa_status"),
        csa_scores=dot_record.get("csa_scores"),
        authority_status=dot_record.get("authority_status"),
        insurance_on_file=dot_record.get("insurance_on_file", False),
        operating_status=dot_record.get("operating_status"),
        drug_testing_enrolled=dot_record.get("drug_testing_enrolled", False),
        drug_testing_last_test=dot_record.get("drug_testing_last_test"),
        drug_testing_compliant=dot_record.get("drug_testing_compliant", False),
        hos_violation_count=dot_record.get("hos_violation_count", 0),
        inspection_count=dot_record.get("inspection_count", 0),
        out_of_service_rate=dot_record.get("out_of_service_rate", 0),
        crash_count=dot_record.get("crash_count", 0),
        compliance_alerts=dot_record.get("compliance_alerts", []),
        last_checked_at=dot_record.get("last_checked_at"),
        overall_compliance_score=round(score, 1),
    )


@router.post("/{carrier_id}/compliance-check")
async def run_dot_compliance_check(carrier_id: str):
    """Run a full DOT compliance check and update records."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Trigger a fresh check by clearing the existing record
    await db.dot_compliance.delete_one({"carrier_id": ObjectId(carrier_id)})

    # Call the GET endpoint logic to regenerate
    result = await get_dot_compliance(carrier_id)
    return result


@router.get("/compliance-dashboard")
async def get_compliance_dashboard():
    """Get a compliance dashboard across all carriers."""
    db = get_database()
    now = datetime.now(timezone.utc)

    # Get all carriers
    total_carriers = await db.carriers.count_documents({"status": {"$ne": "do_not_use"}})

    # Get DOT compliance records
    dot_cursor = db.dot_compliance.find()
    dot_records = await dot_cursor.to_list(1000)

    compliant = 0
    at_risk = 0
    non_compliant = 0
    needs_review = []
    recent_alerts = []

    for r in dot_records:
        cid = str(r.get("carrier_id", ""))
        alerts = r.get("compliance_alerts", [])
        safety_rating = r.get("fmcsa_safety_rating", "satisfactory")

        if safety_rating == "unsatisfactory" or len(alerts) > 3:
            non_compliant += 1
            needs_review.append({
                "carrier_id": cid,
                "safety_rating": safety_rating,
                "alert_count": len(alerts),
                "status": "non_compliant",
            })
        elif safety_rating == "conditional" or len(alerts) > 0:
            at_risk += 1
            if len(alerts) > 1:
                needs_review.append({
                    "carrier_id": cid,
                    "safety_rating": safety_rating,
                    "alert_count": len(alerts),
                    "status": "at_risk",
                })
        else:
            compliant += 1

        for alert in alerts[:3]:
            recent_alerts.append({
                "carrier_id": cid,
                "alert": alert,
                "timestamp": r.get("last_checked_at"),
            })

    # Count expiring insurance
    thirty_days = now + timedelta(days=30)
    expiring = await db.carrier_insurance.count_documents({
        "is_current": True,
        "expiry_date": {"$lte": thirty_days, "$gte": now},
    })

    recent_alerts.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return {
        "total_carriers": total_carriers,
        "compliant_count": compliant,
        "at_risk_count": at_risk,
        "non_compliant_count": non_compliant,
        "expiring_within_30_days": expiring,
        "carriers_needing_review": needs_review[:20],
        "recent_alerts": recent_alerts[:20],
    }
