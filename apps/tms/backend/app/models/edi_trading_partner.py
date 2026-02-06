"""EDI Trading Partner configuration model."""

from enum import Enum
from typing import Optional

from .base import MongoModel


class ConnectionType(str, Enum):
    """Connection method for EDI exchange."""
    SFTP = "sftp"
    AS2 = "as2"
    API = "api"


class EDITradingPartner(MongoModel):
    """Configuration for an EDI trading partner."""

    # Partner identification
    partner_name: str
    partner_code: Optional[str] = None  # Short code for display

    # EDI identifiers
    isa_id: str  # ISA sender/receiver ID
    isa_qualifier: str = "ZZ"  # ISA qualifier (ZZ = mutually defined, 01 = DUNS, etc.)
    gs_id: str  # GS application sender/receiver code

    # Message types this partner supports
    supported_message_types: list[str] = []  # e.g., ["204", "214", "210", "990"]

    # Connection configuration
    connection_type: ConnectionType = ConnectionType.SFTP
    connection_config: dict = {}
    # For SFTP: {host, port, username, password/key_path, remote_dir_inbound, remote_dir_outbound}
    # For AS2: {url, as2_from, as2_to, certificate_path}
    # For API: {base_url, api_key, auth_type}

    # Status
    is_active: bool = True

    # Delimiters (customizable per partner)
    element_separator: str = "*"
    segment_terminator: str = "~"
    sub_element_separator: str = ":"

    # Contact info
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

    # Notes
    notes: Optional[str] = None
