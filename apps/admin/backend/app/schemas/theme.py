"""Theme schemas for API request/response validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ThemePrimaryColors(BaseModel):
    """Primary color palette (11 shades)."""
    shade_50: str = Field(alias="50")
    shade_100: str = Field(alias="100")
    shade_200: str = Field(alias="200")
    shade_300: str = Field(alias="300")
    shade_400: str = Field(alias="400")
    shade_500: str = Field(alias="500")
    shade_600: str = Field(alias="600")
    shade_700: str = Field(alias="700")
    shade_800: str = Field(alias="800")
    shade_900: str = Field(alias="900")
    shade_950: str = Field(alias="950")

    model_config = {"populate_by_name": True}


class ThemeBackgroundColors(BaseModel):
    """Background colors."""
    default: str
    surface: str
    elevated: str


class ThemeTextColors(BaseModel):
    """Text colors."""
    primary: str
    secondary: str
    muted: str


class ThemeBorderColors(BaseModel):
    """Border colors."""
    default: str
    subtle: str


class ThemeModeColors(BaseModel):
    """Colors for a specific mode (light or dark)."""
    primary: ThemePrimaryColors
    background: ThemeBackgroundColors
    text: ThemeTextColors
    border: ThemeBorderColors


class ThemeColorsSchema(BaseModel):
    """Full theme color configuration for both modes."""
    light: ThemeModeColors
    dark: ThemeModeColors


# Request schemas
class ThemeCreate(BaseModel):
    """Schema for creating a new theme."""
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = None
    is_default: bool = False
    colors: ThemeColorsSchema


class ThemeUpdate(BaseModel):
    """Schema for updating a theme (creates new version)."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    colors: Optional[ThemeColorsSchema] = None
    change_summary: Optional[str] = None
    changed_by: Optional[str] = None


# Response schemas
class ThemeVersionResponse(BaseModel):
    """Schema for theme version in responses."""
    id: UUID
    version_number: int
    snapshot: dict
    change_summary: Optional[str]
    changed_by: Optional[str]
    changed_at: datetime
    status: str

    model_config = {"from_attributes": True}


class ThemeResponse(BaseModel):
    """Schema for theme in list responses."""
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    is_default: bool
    is_active: bool
    current_version: int
    colors: Optional[dict] = None  # Include colors for display
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThemeListResponse(BaseModel):
    """Schema for list of themes."""
    themes: list[ThemeResponse]
    total: int


class ThemeDetailResponse(BaseModel):
    """Schema for theme detail with current colors."""
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    is_default: bool
    is_active: bool
    current_version: int
    colors: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThemeVersionListResponse(BaseModel):
    """Schema for list of theme versions."""
    versions: list[ThemeVersionResponse]
    total: int


# Public API schemas
class PublicThemeResponse(BaseModel):
    """Schema for public theme API (consumed by other apps)."""
    id: str
    name: str
    slug: str
    colors: dict

    model_config = {"from_attributes": True}


class PublicThemeListResponse(BaseModel):
    """Schema for public theme list."""
    themes: list[PublicThemeResponse]
