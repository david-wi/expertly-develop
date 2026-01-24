"""Website model for public booking pages."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class WebsiteTheme(str, Enum):
    """Available website themes."""
    ELEGANT = "elegant"  # Classic salon look
    MODERN = "modern"  # Clean, minimalist
    WARM = "warm"  # Cozy, inviting
    BOLD = "bold"  # High contrast, vibrant
    NATURAL = "natural"  # Earth tones, organic


class SocialLinks(BaseModel):
    """Social media links."""
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    tiktok: Optional[str] = None
    twitter: Optional[str] = None
    youtube: Optional[str] = None
    yelp: Optional[str] = None
    google_business: Optional[str] = None


class WebsiteSection(BaseModel):
    """A configurable section of the website."""
    id: str
    type: str  # "hero", "about", "services", "team", "gallery", "testimonials", "contact", "booking"
    enabled: bool = True
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    order: int = 0


class WebsiteSettings(BaseModel):
    """Website configuration settings."""

    # Basic info
    tagline: Optional[str] = None  # e.g., "Where Beauty Meets Excellence"
    about_text: Optional[str] = None  # About us description

    # Branding
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#D4A5A5"  # Warm rose
    secondary_color: str = "#C9A86C"  # Soft gold
    font_heading: str = "Playfair Display"
    font_body: str = "Inter"

    # Theme
    theme: WebsiteTheme = WebsiteTheme.WARM

    # Hero section
    hero_image_url: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    show_booking_cta: bool = True

    # Gallery
    gallery_images: list[str] = Field(default_factory=list)

    # Testimonials
    testimonials: list[dict] = Field(default_factory=list)  # [{name, text, rating, photo_url}]

    # Contact
    show_map: bool = True
    show_hours: bool = True
    contact_form_enabled: bool = True

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: list[str] = Field(default_factory=list)

    # Social
    social_links: SocialLinks = Field(default_factory=SocialLinks)

    # Sections configuration
    sections: list[WebsiteSection] = Field(default_factory=list)

    # Public booking settings
    allow_public_booking: bool = True
    require_account: bool = False  # Require client to create account
    show_prices: bool = True
    show_staff_bios: bool = True
    new_client_discount_enabled: bool = True


class Website(BaseModel):
    """Salon's public website configuration."""

    salon_id: str
    is_published: bool = False
    custom_domain: Optional[str] = None  # e.g., "beautysalon.com"
    subdomain: Optional[str] = None  # e.g., "beautysalon" for beautysalon.appointments.app
    settings: WebsiteSettings = Field(default_factory=WebsiteSettings)
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None


# Default sections template
DEFAULT_SECTIONS = [
    WebsiteSection(
        id="hero",
        type="hero",
        enabled=True,
        title="Welcome to {salon_name}",
        subtitle="Where beauty meets excellence",
        order=0,
    ),
    WebsiteSection(
        id="services",
        type="services",
        enabled=True,
        title="Our Services",
        subtitle="Discover our range of treatments",
        order=1,
    ),
    WebsiteSection(
        id="team",
        type="team",
        enabled=True,
        title="Meet Our Team",
        subtitle="Expert stylists dedicated to your beauty",
        order=2,
    ),
    WebsiteSection(
        id="gallery",
        type="gallery",
        enabled=True,
        title="Our Work",
        subtitle="See the transformations",
        order=3,
    ),
    WebsiteSection(
        id="testimonials",
        type="testimonials",
        enabled=True,
        title="What Our Clients Say",
        order=4,
    ),
    WebsiteSection(
        id="booking",
        type="booking",
        enabled=True,
        title="Book Your Appointment",
        subtitle="Schedule your visit today",
        order=5,
    ),
    WebsiteSection(
        id="contact",
        type="contact",
        enabled=True,
        title="Contact Us",
        order=6,
    ),
]
