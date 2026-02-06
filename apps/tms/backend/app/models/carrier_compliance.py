from datetime import datetime
from enum import Enum
from typing import Optional

from .base import MongoModel, PyObjectId


class InsuranceType(str, Enum):
    CARGO = "cargo"
    LIABILITY = "liability"
    AUTO = "auto"
    WORKERS_COMP = "workers_comp"


class ComplianceType(str, Enum):
    AUTHORITY = "authority"
    SAFETY_RATING = "safety_rating"
    DRUG_TESTING = "drug_testing"
    HAZMAT_CERT = "hazmat_cert"


class ComplianceStatus(str, Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING = "pending"
    EXPIRED = "expired"


class CarrierInsurance(MongoModel):
    """Insurance policy record for a carrier."""

    carrier_id: PyObjectId
    insurance_type: InsuranceType
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_amount: int = 0  # In cents
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_current: bool = True


class CarrierCompliance(MongoModel):
    """Compliance record for a carrier."""

    carrier_id: PyObjectId
    compliance_type: ComplianceType
    status: ComplianceStatus = ComplianceStatus.PENDING
    details: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
