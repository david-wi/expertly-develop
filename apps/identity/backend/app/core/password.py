"""Password validation and strength checking."""

import re
from typing import Optional, List


# Common weak passwords to reject
COMMON_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
    "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
    "ashley", "bailey", "shadow", "123123", "654321", "superman", "qazwsx",
    "michael", "football", "password1", "password123", "welcome", "welcome1",
    "admin", "admin123", "root", "toor", "pass", "test", "guest", "master",
    "changeme", "hello", "secret", "love", "god", "sex", "money",
}


class PasswordStrengthError(Exception):
    """Raised when a password doesn't meet strength requirements."""

    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_password_strength(password: str, email: Optional[str] = None) -> List[str]:
    """
    Validate password strength.

    Returns a list of error messages. Empty list means password is valid.
    """
    errors = []

    # Minimum length
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")

    # Maximum length (to prevent DoS with huge passwords)
    if len(password) > 128:
        errors.append("Password must be no more than 128 characters")

    # Check for common patterns
    lower_password = password.lower()

    # Common passwords
    if lower_password in COMMON_PASSWORDS:
        errors.append("This password is too common")

    # Variations of common passwords
    for common in COMMON_PASSWORDS:
        if common in lower_password:
            errors.append("Password contains a common password pattern")
            break

    # All same character
    if len(set(password)) == 1:
        errors.append("Password cannot be all the same character")

    # Sequential characters (123456, abcdef)
    sequential_patterns = [
        "123456789",
        "987654321",
        "abcdefghijklmnopqrstuvwxyz",
        "zyxwvutsrqponmlkjihgfedcba",
        "qwertyuiop",
        "asdfghjkl",
        "zxcvbnm",
    ]
    for pattern in sequential_patterns:
        for i in range(len(pattern) - 3):
            if pattern[i:i+4] in lower_password:
                errors.append("Password contains sequential characters")
                break
        else:
            continue
        break

    # Repeated patterns (abcabc, 123123)
    if len(password) >= 6:
        half_len = len(password) // 2
        if password[:half_len] == password[half_len:2*half_len]:
            errors.append("Password contains a repeated pattern")

    # Contains part of email
    if email:
        email_lower = email.lower()
        email_parts = email_lower.replace("@", " ").replace(".", " ").split()
        for part in email_parts:
            if len(part) >= 4 and part in lower_password:
                errors.append("Password should not contain parts of your email")
                break

    # At least one uppercase, one lowercase, one digit or special char
    has_upper = bool(re.search(r'[A-Z]', password))
    has_lower = bool(re.search(r'[a-z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password))

    # Require at least 3 of the 4 character types
    char_types = sum([has_upper, has_lower, has_digit, has_special])
    if char_types < 3:
        errors.append("Password must contain at least 3 of: uppercase, lowercase, digit, special character")

    return errors


def is_password_strong(password: str, email: Optional[str] = None) -> bool:
    """Check if a password meets strength requirements."""
    return len(validate_password_strength(password, email)) == 0


def check_password_strength(password: str, email: Optional[str] = None) -> None:
    """
    Validate password strength, raising PasswordStrengthError if invalid.
    """
    errors = validate_password_strength(password, email)
    if errors:
        raise PasswordStrengthError(errors)
