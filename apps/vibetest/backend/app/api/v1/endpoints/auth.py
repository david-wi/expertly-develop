"""Authentication endpoints."""
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organization, User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    TokenRefresh,
    UserResponse,
    OrganizationResponse,
)
from app.services.password import hash_password, verify_password
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.api.deps import get_current_user

router = APIRouter()


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from a name."""
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:50]  # Limit length


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(
    user_in: UserRegister,
    db: Session = Depends(get_db),
):
    """Register a new user and organization."""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    now = datetime.utcnow()
    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    # Generate unique slug
    base_slug = generate_slug(user_in.organization_name)
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create organization
    organization = Organization(
        id=org_id,
        name=user_in.organization_name,
        slug=slug,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(organization)

    # Create user as owner
    user = User(
        id=user_id,
        organization_id=org_id,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
        role="owner",
        is_active=True,
        is_verified=False,
        created_at=now,
        updated_at=now,
    )
    db.add(user)

    db.commit()

    # Generate tokens
    access_token = create_access_token(user_id, org_id, "owner")
    refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    user_in: UserLogin,
    db: Session = Depends(get_db),
):
    """Authenticate user and return tokens."""
    user = db.query(User).filter(
        User.email == user_in.email,
        User.deleted_at.is_(None)
    ).first()

    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Generate tokens
    access_token = create_access_token(user.id, user.organization_id, user.role)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    token_in: TokenRefresh,
    db: Session = Depends(get_db),
):
    """Exchange refresh token for new access token."""
    payload = decode_refresh_token(token_in.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Generate new tokens
    access_token = create_access_token(user.id, user.organization_id, user.role)
    new_refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Get current user information."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        organization=OrganizationResponse(
            id=current_user.organization.id,
            name=current_user.organization.name,
            slug=current_user.organization.slug,
            is_active=current_user.organization.is_active,
            created_at=current_user.organization.created_at,
        ),
    )
