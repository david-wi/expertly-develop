# Identity Client

Shared Python client for Expertly Identity service authentication and user management.

## Installation

From the monorepo root, install as an editable package:

```bash
pip install -e packages/identity-client
```

Or in an app's requirements.txt:

```
-e ../../packages/identity-client
```

## Usage

### FastAPI Dependencies

```python
from identity_client.dependencies import get_current_user, require_auth, require_role
from identity_client.models import User

@app.get("/api/protected")
async def protected_route(user: User = Depends(get_current_user)):
    return {"message": f"Hello {user.name}"}

@app.get("/api/admin-only")
async def admin_route(user: User = Depends(require_role("admin", "owner"))):
    return {"message": "Admin access granted"}
```

### Direct Client Usage

```python
from identity_client import IdentityClient

client = IdentityClient(base_url="https://identity.ai.devintensive.com")

# Validate a session
result = await client.validate_session(session_token)
if result.valid:
    print(f"User: {result.user.name}")

# Get user by ID
user = await client.get_user(user_id)

# List organization users
users = await client.list_users(organization_id)
```

## Configuration

The client reads configuration from environment variables:

- `IDENTITY_API_URL`: Identity service URL (default: `https://identity.ai.devintensive.com`)
- `IDENTITY_INTERNAL_URL`: Internal URL for service-to-service calls (optional)
