from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from bson import ObjectId
import logging

from app.database import get_database
from app.models.carrier_compliance import (
    CarrierInsurance,
    CarrierCompliance,
    InsuranceType,
    ComplianceType,
    ComplianceStatus,
)

logger = logging.getLogger(__name__)

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


# ============================================================================
# Configurable Compliance Rules
# ============================================================================

class ComplianceRuleCreate(BaseModel):
    """Schema for creating/updating compliance rules."""
    min_insurance_amount: int = Field(
        default=100000_00,
        description="Minimum insurance coverage in cents (default $100,000)",
    )
    required_insurance_types: List[str] = Field(
        default=["cargo", "liability", "auto"],
        description="Insurance types that must be present",
    )
    required_safety_ratings: List[str] = Field(
        default=["satisfactory"],
        description="Acceptable FMCSA safety ratings (e.g. satisfactory, conditional)",
    )
    max_violations: int = Field(
        default=5,
        description="Maximum allowed HOS violations before auto-block",
    )
    max_crash_count: int = Field(
        default=3,
        description="Maximum allowed crash count",
    )
    max_out_of_service_rate: float = Field(
        default=25.0,
        description="Maximum acceptable out-of-service rate (%)",
    )
    max_csa_score: float = Field(
        default=75.0,
        description="Maximum acceptable CSA BASIC score",
    )
    insurance_expiry_warning_days: int = Field(
        default=30,
        description="Days before expiry to start warning",
    )
    auto_block_non_compliant: bool = Field(
        default=True,
        description="Automatically suspend carriers that fail compliance",
    )
    require_drug_testing: bool = Field(
        default=True,
        description="Require drug testing compliance",
    )
    require_active_authority: bool = Field(
        default=True,
        description="Require active operating authority",
    )
    is_active: bool = True


class ComplianceRuleResponse(BaseModel):
    """Response schema for compliance rules."""
    id: str
    min_insurance_amount: int
    required_insurance_types: List[str]
    required_safety_ratings: List[str]
    max_violations: int
    max_crash_count: int
    max_out_of_service_rate: float
    max_csa_score: float
    insurance_expiry_warning_days: int
    auto_block_non_compliant: bool
    require_drug_testing: bool
    require_active_authority: bool
    is_active: bool
    created_at: str
    updated_at: str


class ComplianceAlertItem(BaseModel):
    """A single compliance alert for a carrier."""
    carrier_id: str
    carrier_name: str
    alert_type: str  # expiring_insurance, non_compliant, expired, suspended, rule_violation
    severity: str  # critical, warning, info
    message: str
    details: Optional[Dict[str, Any]] = None
    created_at: str


class ComplianceAlertsResponse(BaseModel):
    """Response for compliance alerts across carriers."""
    total_alerts: int
    critical_count: int
    warning_count: int
    info_count: int
    alerts: List[ComplianceAlertItem]


class FMCSALookupResponse(BaseModel):
    """Response for FMCSA data lookup."""
    carrier_id: str
    dot_number: Optional[str] = None
    mc_number: Optional[str] = None
    legal_name: Optional[str] = None
    dba_name: Optional[str] = None
    safety_rating: Optional[str] = None
    safety_rating_date: Optional[str] = None
    operating_status: Optional[str] = None
    authority_status: Optional[str] = None
    authority_grant_date: Optional[str] = None
    insurance_bipd_on_file: int = 0
    insurance_cargo_on_file: int = 0
    insurance_bond_on_file: int = 0
    total_drivers: int = 0
    total_power_units: int = 0
    mcs150_date: Optional[str] = None
    csa_scores: Optional[Dict[str, float]] = None
    out_of_service_rate: float = 0.0
    inspection_count: int = 0
    crash_count: int = 0
    is_compliant: bool = False
    compliance_issues: List[str] = []
    fetched_at: str = ""


class CarrierComplianceFullStatus(BaseModel):
    """Full compliance status for a carrier including rule evaluation."""
    carrier_id: str
    carrier_name: str
    overall_status: str  # compliant, at_risk, non_compliant, suspended
    compliance_score: float
    rule_violations: List[str]
    warnings: List[str]
    insurance_status: Dict[str, Any]
    dot_status: Dict[str, Any]
    auto_blocked: bool
    last_checked_at: Optional[str] = None


@router.post("/compliance/rules", response_model=ComplianceRuleResponse)
async def set_compliance_rules(data: ComplianceRuleCreate):
    """Create or update configurable compliance rules.

    These rules determine minimum insurance amounts, required safety ratings,
    maximum violation thresholds, and whether to auto-block non-compliant carriers.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    rule_doc = data.model_dump()
    rule_doc["updated_at"] = now

    # Upsert - only one active rule set at a time
    existing = await db.compliance_rules.find_one({"is_active": True})
    if existing:
        await db.compliance_rules.update_one(
            {"_id": existing["_id"]},
            {"$set": rule_doc},
        )
        rule_doc["_id"] = existing["_id"]
        rule_doc["created_at"] = existing.get("created_at", now)
    else:
        rule_doc["created_at"] = now
        result = await db.compliance_rules.insert_one(rule_doc)
        rule_doc["_id"] = result.inserted_id

    return ComplianceRuleResponse(
        id=str(rule_doc["_id"]),
        min_insurance_amount=rule_doc["min_insurance_amount"],
        required_insurance_types=rule_doc["required_insurance_types"],
        required_safety_ratings=rule_doc["required_safety_ratings"],
        max_violations=rule_doc["max_violations"],
        max_crash_count=rule_doc["max_crash_count"],
        max_out_of_service_rate=rule_doc["max_out_of_service_rate"],
        max_csa_score=rule_doc["max_csa_score"],
        insurance_expiry_warning_days=rule_doc["insurance_expiry_warning_days"],
        auto_block_non_compliant=rule_doc["auto_block_non_compliant"],
        require_drug_testing=rule_doc["require_drug_testing"],
        require_active_authority=rule_doc["require_active_authority"],
        is_active=rule_doc.get("is_active", True),
        created_at=rule_doc["created_at"].isoformat() if isinstance(rule_doc["created_at"], datetime) else str(rule_doc["created_at"]),
        updated_at=rule_doc["updated_at"].isoformat() if isinstance(rule_doc["updated_at"], datetime) else str(rule_doc["updated_at"]),
    )


@router.get("/compliance/rules", response_model=ComplianceRuleResponse)
async def get_compliance_rules():
    """Get the current active compliance rules configuration."""
    db = get_database()

    rule_doc = await db.compliance_rules.find_one({"is_active": True})
    if not rule_doc:
        # Return defaults
        now = datetime.now(timezone.utc)
        defaults = ComplianceRuleCreate()
        default_doc = defaults.model_dump()
        default_doc["created_at"] = now
        default_doc["updated_at"] = now
        result = await db.compliance_rules.insert_one(default_doc)
        default_doc["_id"] = result.inserted_id
        rule_doc = default_doc

    return ComplianceRuleResponse(
        id=str(rule_doc["_id"]),
        min_insurance_amount=rule_doc.get("min_insurance_amount", 100000_00),
        required_insurance_types=rule_doc.get("required_insurance_types", ["cargo", "liability", "auto"]),
        required_safety_ratings=rule_doc.get("required_safety_ratings", ["satisfactory"]),
        max_violations=rule_doc.get("max_violations", 5),
        max_crash_count=rule_doc.get("max_crash_count", 3),
        max_out_of_service_rate=rule_doc.get("max_out_of_service_rate", 25.0),
        max_csa_score=rule_doc.get("max_csa_score", 75.0),
        insurance_expiry_warning_days=rule_doc.get("insurance_expiry_warning_days", 30),
        auto_block_non_compliant=rule_doc.get("auto_block_non_compliant", True),
        require_drug_testing=rule_doc.get("require_drug_testing", True),
        require_active_authority=rule_doc.get("require_active_authority", True),
        is_active=rule_doc.get("is_active", True),
        created_at=rule_doc["created_at"].isoformat() if isinstance(rule_doc.get("created_at"), datetime) else str(rule_doc.get("created_at", "")),
        updated_at=rule_doc["updated_at"].isoformat() if isinstance(rule_doc.get("updated_at"), datetime) else str(rule_doc.get("updated_at", "")),
    )


@router.get("/compliance/alerts", response_model=ComplianceAlertsResponse)
async def get_compliance_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: critical, warning, info"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get compliance alerts for all carriers.

    Returns expiring insurance, non-compliant carriers, auto-blocked carriers,
    and rule violations based on the configured compliance rules.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    # Get active rules
    rule_doc = await db.compliance_rules.find_one({"is_active": True})
    if not rule_doc:
        rule_doc = ComplianceRuleCreate().model_dump()

    warning_days = rule_doc.get("insurance_expiry_warning_days", 30)
    warning_threshold = now + timedelta(days=warning_days)
    min_insurance = rule_doc.get("min_insurance_amount", 100000_00)
    required_insurance_types = set(rule_doc.get("required_insurance_types", ["cargo", "liability", "auto"]))
    max_violations = rule_doc.get("max_violations", 5)
    max_crash_count = rule_doc.get("max_crash_count", 3)
    max_oos_rate = rule_doc.get("max_out_of_service_rate", 25.0)
    max_csa = rule_doc.get("max_csa_score", 75.0)
    allowed_ratings = set(rule_doc.get("required_safety_ratings", ["satisfactory"]))

    alerts: List[ComplianceAlertItem] = []

    # 1. Check insurance expirations and coverage amounts
    insurance_cursor = db.carrier_insurance.find({"is_current": True})
    insurance_records = await insurance_cursor.to_list(5000)

    # Group insurance by carrier
    carrier_insurance_map: Dict[str, List[dict]] = {}
    for ins in insurance_records:
        cid = str(ins.get("carrier_id", ""))
        carrier_insurance_map.setdefault(cid, []).append(ins)

    # Get carrier names for alert display
    carrier_cursor = db.carriers.find({"status": {"$ne": "do_not_use"}})
    all_carriers = await carrier_cursor.to_list(5000)
    carrier_name_map = {str(c["_id"]): c.get("name", "Unknown") for c in all_carriers}

    for cid, ins_list in carrier_insurance_map.items():
        carrier_name = carrier_name_map.get(cid, "Unknown Carrier")
        existing_types = set()
        for ins in ins_list:
            ins_type = ins.get("insurance_type", "")
            existing_types.add(ins_type)
            exp = ins.get("expiry_date")
            coverage = ins.get("coverage_amount", 0)

            # Expired insurance
            if exp and exp < now:
                alerts.append(ComplianceAlertItem(
                    carrier_id=cid,
                    carrier_name=carrier_name,
                    alert_type="expired",
                    severity="critical",
                    message=f"{ins_type.replace('_', ' ').title()} insurance has expired",
                    details={"insurance_type": ins_type, "expiry_date": exp.isoformat() if isinstance(exp, datetime) else str(exp)},
                    created_at=now.isoformat(),
                ))
            # Expiring soon
            elif exp and exp < warning_threshold:
                days_left = (exp - now).days if isinstance(exp, datetime) else 0
                alerts.append(ComplianceAlertItem(
                    carrier_id=cid,
                    carrier_name=carrier_name,
                    alert_type="expiring_insurance",
                    severity="warning",
                    message=f"{ins_type.replace('_', ' ').title()} insurance expires in {days_left} days",
                    details={"insurance_type": ins_type, "days_until_expiry": days_left},
                    created_at=now.isoformat(),
                ))

            # Below minimum coverage
            if coverage < min_insurance and coverage > 0:
                alerts.append(ComplianceAlertItem(
                    carrier_id=cid,
                    carrier_name=carrier_name,
                    alert_type="rule_violation",
                    severity="warning",
                    message=f"{ins_type.replace('_', ' ').title()} coverage (${coverage // 100:,}) below minimum (${min_insurance // 100:,})",
                    details={"insurance_type": ins_type, "coverage_amount": coverage, "minimum_required": min_insurance},
                    created_at=now.isoformat(),
                ))

        # Missing required insurance types
        missing = required_insurance_types - existing_types
        for m in missing:
            alerts.append(ComplianceAlertItem(
                carrier_id=cid,
                carrier_name=carrier_name,
                alert_type="non_compliant",
                severity="critical",
                message=f"Missing required {m.replace('_', ' ').title()} insurance",
                details={"missing_insurance_type": m},
                created_at=now.isoformat(),
            ))

    # 2. Check DOT compliance records against rules
    dot_cursor = db.dot_compliance.find()
    dot_records = await dot_cursor.to_list(5000)

    for dot in dot_records:
        cid = str(dot.get("carrier_id", ""))
        carrier_name = carrier_name_map.get(cid, "Unknown Carrier")
        safety_rating = dot.get("fmcsa_safety_rating", "")
        hos_violations = dot.get("hos_violation_count", 0)
        crash_count = dot.get("crash_count", 0)
        oos_rate = dot.get("out_of_service_rate", 0.0)
        csa_scores = dot.get("csa_scores", {})

        # Safety rating not in allowed list
        if safety_rating and safety_rating not in allowed_ratings:
            sev = "critical" if safety_rating == "unsatisfactory" else "warning"
            alerts.append(ComplianceAlertItem(
                carrier_id=cid,
                carrier_name=carrier_name,
                alert_type="rule_violation",
                severity=sev,
                message=f"FMCSA safety rating '{safety_rating}' does not meet requirements",
                details={"safety_rating": safety_rating, "allowed_ratings": list(allowed_ratings)},
                created_at=now.isoformat(),
            ))

        # HOS violations exceed limit
        if hos_violations > max_violations:
            alerts.append(ComplianceAlertItem(
                carrier_id=cid,
                carrier_name=carrier_name,
                alert_type="rule_violation",
                severity="critical",
                message=f"HOS violations ({hos_violations}) exceed maximum ({max_violations})",
                details={"hos_violations": hos_violations, "max_allowed": max_violations},
                created_at=now.isoformat(),
            ))

        # Crash count exceeds limit
        if crash_count > max_crash_count:
            alerts.append(ComplianceAlertItem(
                carrier_id=cid,
                carrier_name=carrier_name,
                alert_type="rule_violation",
                severity="critical",
                message=f"Crash count ({crash_count}) exceeds maximum ({max_crash_count})",
                details={"crash_count": crash_count, "max_allowed": max_crash_count},
                created_at=now.isoformat(),
            ))

        # Out-of-service rate too high
        if oos_rate > max_oos_rate:
            alerts.append(ComplianceAlertItem(
                carrier_id=cid,
                carrier_name=carrier_name,
                alert_type="rule_violation",
                severity="warning",
                message=f"Out-of-service rate ({oos_rate:.1f}%) exceeds limit ({max_oos_rate:.1f}%)",
                details={"oos_rate": oos_rate, "max_allowed": max_oos_rate},
                created_at=now.isoformat(),
            ))

        # CSA scores above threshold
        for category, score in csa_scores.items():
            if score > max_csa:
                alerts.append(ComplianceAlertItem(
                    carrier_id=cid,
                    carrier_name=carrier_name,
                    alert_type="rule_violation",
                    severity="warning",
                    message=f"CSA {category.replace('_', ' ').title()} score ({score}) exceeds threshold ({max_csa})",
                    details={"csa_category": category, "score": score, "threshold": max_csa},
                    created_at=now.isoformat(),
                ))

    # 3. Check for suspended carriers (auto-blocked)
    suspended_cursor = db.carriers.find({"status": "suspended"})
    suspended_carriers = await suspended_cursor.to_list(1000)
    for c in suspended_carriers:
        cid = str(c["_id"])
        alerts.append(ComplianceAlertItem(
            carrier_id=cid,
            carrier_name=c.get("name", "Unknown"),
            alert_type="suspended",
            severity="critical",
            message="Carrier is suspended due to compliance failure",
            details={"status": "suspended"},
            created_at=now.isoformat(),
        ))

    # Filter by severity if requested
    if severity:
        alerts = [a for a in alerts if a.severity == severity]

    # Sort: critical first, then warning, then info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a.severity, 9))

    # Count by severity (before limiting)
    critical_count = sum(1 for a in alerts if a.severity == "critical")
    warning_count = sum(1 for a in alerts if a.severity == "warning")
    info_count = sum(1 for a in alerts if a.severity == "info")
    total = len(alerts)

    return ComplianceAlertsResponse(
        total_alerts=total,
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
        alerts=alerts[:limit],
    )


@router.get("/{carrier_id}/compliance-status", response_model=CarrierComplianceFullStatus)
async def get_full_compliance_status(carrier_id: str):
    """Get full compliance status for a carrier, evaluated against configured rules.

    Returns detailed compliance evaluation including rule violations, warnings,
    insurance status, DOT status, and whether the carrier was auto-blocked.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    carrier_name = carrier.get("name", "Unknown")

    # Get active rules
    rule_doc = await db.compliance_rules.find_one({"is_active": True})
    if not rule_doc:
        rule_doc = ComplianceRuleCreate().model_dump()

    min_insurance = rule_doc.get("min_insurance_amount", 100000_00)
    required_ins_types = set(rule_doc.get("required_insurance_types", ["cargo", "liability", "auto"]))
    allowed_ratings = set(rule_doc.get("required_safety_ratings", ["satisfactory"]))
    max_violations = rule_doc.get("max_violations", 5)
    max_crash_count = rule_doc.get("max_crash_count", 3)
    max_oos_rate = rule_doc.get("max_out_of_service_rate", 25.0)
    max_csa = rule_doc.get("max_csa_score", 75.0)
    warning_days = rule_doc.get("insurance_expiry_warning_days", 30)
    auto_block = rule_doc.get("auto_block_non_compliant", True)
    require_drug_testing = rule_doc.get("require_drug_testing", True)
    require_authority = rule_doc.get("require_active_authority", True)

    violations: List[str] = []
    warnings: List[str] = []

    # Evaluate insurance
    insurance_cursor = db.carrier_insurance.find({"carrier_id": ObjectId(carrier_id), "is_current": True})
    insurance_records = await insurance_cursor.to_list(100)

    existing_types = set()
    total_coverage = 0
    expired_insurance = 0
    expiring_insurance = 0
    warning_threshold = now + timedelta(days=warning_days)

    for ins in insurance_records:
        ins_type = ins.get("insurance_type", "")
        existing_types.add(ins_type)
        coverage = ins.get("coverage_amount", 0)
        total_coverage += coverage
        exp = ins.get("expiry_date")

        if exp and exp < now:
            expired_insurance += 1
            violations.append(f"{ins_type.replace('_', ' ').title()} insurance expired")
        elif exp and exp < warning_threshold:
            expiring_insurance += 1
            days_left = (exp - now).days
            warnings.append(f"{ins_type.replace('_', ' ').title()} insurance expires in {days_left} days")

        if coverage > 0 and coverage < min_insurance:
            violations.append(f"{ins_type.replace('_', ' ').title()} coverage (${coverage // 100:,}) below minimum (${min_insurance // 100:,})")

    missing_types = required_ins_types - existing_types
    for m in missing_types:
        violations.append(f"Missing required {m.replace('_', ' ').title()} insurance")

    insurance_status = {
        "total_policies": len(insurance_records),
        "total_coverage": total_coverage,
        "expired_count": expired_insurance,
        "expiring_count": expiring_insurance,
        "missing_types": list(missing_types),
    }

    # Evaluate DOT compliance
    dot_record = await db.dot_compliance.find_one({"carrier_id": ObjectId(carrier_id)})
    dot_status: Dict[str, Any] = {"has_data": False}

    if dot_record:
        dot_status["has_data"] = True
        safety_rating = dot_record.get("fmcsa_safety_rating", "")
        hos_violations = dot_record.get("hos_violation_count", 0)
        crash_count = dot_record.get("crash_count", 0)
        oos_rate = dot_record.get("out_of_service_rate", 0.0)
        csa_scores = dot_record.get("csa_scores", {})
        operating_status = dot_record.get("operating_status", "")
        drug_compliant = dot_record.get("drug_testing_compliant", True)

        dot_status["safety_rating"] = safety_rating
        dot_status["operating_status"] = operating_status
        dot_status["hos_violations"] = hos_violations
        dot_status["crash_count"] = crash_count
        dot_status["oos_rate"] = oos_rate
        dot_status["last_checked_at"] = dot_record.get("last_checked_at")

        if safety_rating and safety_rating not in allowed_ratings:
            if safety_rating == "unsatisfactory":
                violations.append(f"FMCSA safety rating is '{safety_rating}' -- carrier should not operate")
            else:
                violations.append(f"FMCSA safety rating '{safety_rating}' not in allowed list: {', '.join(allowed_ratings)}")

        if hos_violations > max_violations:
            violations.append(f"HOS violations ({hos_violations}) exceed maximum ({max_violations})")

        if crash_count > max_crash_count:
            violations.append(f"Crash count ({crash_count}) exceeds maximum ({max_crash_count})")

        if oos_rate > max_oos_rate:
            warnings.append(f"Out-of-service rate ({oos_rate:.1f}%) exceeds limit ({max_oos_rate:.1f}%)")

        for category, score in csa_scores.items():
            if score > max_csa:
                warnings.append(f"CSA {category.replace('_', ' ').title()} score ({score}) above threshold ({max_csa})")

        if require_authority and operating_status not in ("authorized", ""):
            violations.append(f"Operating authority is '{operating_status}' -- active authority required")

        if require_drug_testing and not drug_compliant:
            violations.append("Drug testing non-compliant")

    # Calculate compliance score
    score = 100.0
    score -= len(violations) * 15
    score -= len(warnings) * 5
    score = max(0.0, min(100.0, score))

    # Determine overall status
    if carrier.get("status") == "suspended":
        overall_status = "suspended"
    elif len(violations) > 0:
        overall_status = "non_compliant"
    elif len(warnings) > 0:
        overall_status = "at_risk"
    else:
        overall_status = "compliant"

    # Auto-block logic: if non-compliant and auto-block is enabled, suspend carrier
    auto_blocked = False
    if auto_block and overall_status == "non_compliant" and carrier.get("status") not in ("suspended", "do_not_use"):
        await db.carriers.update_one(
            {"_id": ObjectId(carrier_id)},
            {"$set": {"status": "suspended", "updated_at": now}},
        )
        auto_blocked = True
        overall_status = "suspended"
        logger.info(
            "Auto-blocked carrier %s (%s) due to compliance violations: %s",
            carrier_id, carrier_name, "; ".join(violations),
        )

    return CarrierComplianceFullStatus(
        carrier_id=carrier_id,
        carrier_name=carrier_name,
        overall_status=overall_status,
        compliance_score=round(score, 1),
        rule_violations=violations,
        warnings=warnings,
        insurance_status=insurance_status,
        dot_status=dot_status,
        auto_blocked=auto_blocked,
        last_checked_at=now.isoformat(),
    )


@router.post("/{carrier_id}/compliance/fmcsa-lookup", response_model=FMCSALookupResponse)
async def fmcsa_lookup(carrier_id: str):
    """Simulate FMCSA data integration for a carrier.

    In production, this would call the FMCSA SAFER Web Services API.
    Currently returns simulated data based on carrier info, seeded deterministically
    so repeated lookups return consistent results for the same carrier.
    """
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    now = datetime.now(timezone.utc)
    carrier_name = carrier.get("name", "Unknown")
    dot_number = carrier.get("dot_number")
    mc_number = carrier.get("mc_number")

    # Deterministic simulation based on carrier ID
    import hashlib
    import random
    seed = int(hashlib.md5(carrier_id.encode()).hexdigest()[:8], 16)
    random.seed(seed)

    safety_rating = random.choice(["satisfactory", "satisfactory", "satisfactory", "conditional", "conditional", "unsatisfactory"])
    operating_status = "authorized" if carrier.get("authority_active", True) else "not_authorized"

    csa_scores = {
        "unsafe_driving": round(random.uniform(0, 80), 1),
        "hours_of_service": round(random.uniform(0, 80), 1),
        "vehicle_maintenance": round(random.uniform(0, 65), 1),
        "controlled_substances": round(random.uniform(0, 40), 1),
        "hazardous_materials": round(random.uniform(0, 35), 1),
        "driver_fitness": round(random.uniform(0, 50), 1),
        "crash_indicator": round(random.uniform(0, 60), 1),
    }

    inspection_count = random.randint(2, 25)
    oos_rate = round(random.uniform(0, 30), 1)
    crash_count = random.randint(0, 5)
    total_drivers = random.randint(1, 50)
    total_power_units = random.randint(1, 60)

    bipd = random.choice([750000, 1000000, 1500000, 2000000])
    cargo = random.choice([100000, 250000, 500000, 1000000])
    bond = random.choice([0, 10000, 25000, 75000])

    # Get compliance rules to evaluate
    rule_doc = await db.compliance_rules.find_one({"is_active": True})
    if not rule_doc:
        rule_doc = ComplianceRuleCreate().model_dump()

    allowed_ratings = set(rule_doc.get("required_safety_ratings", ["satisfactory"]))
    max_csa = rule_doc.get("max_csa_score", 75.0)
    max_crash = rule_doc.get("max_crash_count", 3)
    max_oos = rule_doc.get("max_out_of_service_rate", 25.0)

    compliance_issues: List[str] = []
    if safety_rating not in allowed_ratings:
        compliance_issues.append(f"Safety rating '{safety_rating}' not in allowed list")
    if crash_count > max_crash:
        compliance_issues.append(f"Crash count ({crash_count}) exceeds maximum ({max_crash})")
    if oos_rate > max_oos:
        compliance_issues.append(f"OOS rate ({oos_rate}%) exceeds limit ({max_oos}%)")
    for cat, sc in csa_scores.items():
        if sc > max_csa:
            compliance_issues.append(f"CSA {cat.replace('_', ' ').title()} ({sc}) exceeds threshold ({max_csa})")

    is_compliant = len(compliance_issues) == 0

    # Store the FMCSA lookup result
    fmcsa_doc = {
        "carrier_id": ObjectId(carrier_id),
        "dot_number": dot_number,
        "mc_number": mc_number,
        "legal_name": carrier_name,
        "safety_rating": safety_rating,
        "safety_rating_date": (now - timedelta(days=random.randint(30, 730))).isoformat(),
        "operating_status": operating_status,
        "authority_status": operating_status,
        "authority_grant_date": (now - timedelta(days=random.randint(365, 3650))).isoformat(),
        "insurance_bipd_on_file": bipd,
        "insurance_cargo_on_file": cargo,
        "insurance_bond_on_file": bond,
        "total_drivers": total_drivers,
        "total_power_units": total_power_units,
        "csa_scores": csa_scores,
        "out_of_service_rate": oos_rate,
        "inspection_count": inspection_count,
        "crash_count": crash_count,
        "is_compliant": is_compliant,
        "compliance_issues": compliance_issues,
        "fetched_at": now,
        "updated_at": now,
    }

    await db.fmcsa_lookups.update_one(
        {"carrier_id": ObjectId(carrier_id)},
        {"$set": fmcsa_doc},
        upsert=True,
    )

    # Also update the DOT compliance record with fresh data
    await db.dot_compliance.update_one(
        {"carrier_id": ObjectId(carrier_id)},
        {"$set": {
            "fmcsa_safety_rating": safety_rating,
            "fmcsa_status": operating_status,
            "csa_scores": csa_scores,
            "operating_status": operating_status,
            "authority_status": operating_status,
            "out_of_service_rate": oos_rate,
            "inspection_count": inspection_count,
            "crash_count": crash_count,
            "last_checked_at": now.isoformat(),
            "updated_at": now,
        }},
        upsert=True,
    )

    return FMCSALookupResponse(
        carrier_id=carrier_id,
        dot_number=dot_number,
        mc_number=mc_number,
        legal_name=carrier_name,
        safety_rating=safety_rating,
        safety_rating_date=fmcsa_doc["safety_rating_date"],
        operating_status=operating_status,
        authority_status=operating_status,
        authority_grant_date=fmcsa_doc["authority_grant_date"],
        insurance_bipd_on_file=bipd,
        insurance_cargo_on_file=cargo,
        insurance_bond_on_file=bond,
        total_drivers=total_drivers,
        total_power_units=total_power_units,
        mcs150_date=(now - timedelta(days=random.randint(60, 365))).isoformat(),
        csa_scores=csa_scores,
        out_of_service_rate=oos_rate,
        inspection_count=inspection_count,
        crash_count=crash_count,
        is_compliant=is_compliant,
        compliance_issues=compliance_issues,
        fetched_at=now.isoformat(),
    )
