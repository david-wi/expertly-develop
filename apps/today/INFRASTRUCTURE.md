# INFRASTRUCTURE.md

Infrastructure documentation for David's application deployment environment.

## Servers

### Production Droplet
- **Provider**: DigitalOcean
- **IP**: 174.138.81.31
- **OS**: Ubuntu 24.04.3 LTS
- **Specs**: 2 vCPU, 4GB RAM, 80GB disk
- **Region**: NYC3
- **SSH Access**: root user with password authentication

## Coolify Setup

- **Version**: 4.0.0-beta.462
- **URL**: http://174.138.81.31:8000
- **Admin**: david@expertly.com
- **Data Directory**: /data/coolify/
- **Environment File**: /data/coolify/source/.env (BACKUP THIS FILE)

### Coolify Services
Coolify runs the following containers:
- coolify (main application)
- coolify-db (internal PostgreSQL for Coolify metadata)
- coolify-redis (internal Redis)
- coolify-realtime (websocket service)

### GitHub Integration
- **GitHub App Client ID**: Ov23lijt2irnnAOgMl2s
- **Status**: Configured

To deploy a new app from GitHub:
1. Install the GitHub App on the repository
2. In Coolify: Projects → Add Resource → GitHub

## Databases

### Managed PostgreSQL (Application Data)
- **Provider**: DigitalOcean Managed Database
- **Host**: db-david-ex-do-user-32334011-0.j.db.ondigitalocean.com
- **Port**: 25060
- **Database**: defaultdb (create app-specific databases as needed)
- **Username**: doadmin
- **SSL Mode**: require
- **Version**: PostgreSQL 18.1

**Connection from Droplet**: Verified working. Applications deployed via Coolify can connect using these credentials via environment variables.

**Connection String Template**:
```
postgresql://doadmin:<PASSWORD>@db-david-ex-do-user-32334011-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

### Per-Application Database Setup
For each new application:
1. Create a new database: `CREATE DATABASE appname;`
2. Optionally create a dedicated user with limited permissions
3. Store credentials in Coolify environment variables for the application

## Networking

- Droplet has public IPv4: 174.138.81.31
- Coolify UI on port 8000
- Deployed applications get ports assigned by Coolify (or use Coolify's built-in proxy)
- PostgreSQL managed DB accessible from droplet (DO internal networking)

## Backups

### Droplet
- **Status**: Enabled (2026-01-22)
- **Droplet ID**: 546327554
- **Frequency**: Weekly (DigitalOcean default)
- **Retention**: 4 weekly backups

### PostgreSQL Managed Database
- **Status**: Automatic daily backups enabled by DigitalOcean
- **Retention**: 7 days
- **Point-in-time recovery**: Available

### Coolify Configuration
- **Critical file**: `/data/coolify/source/.env`
- **Local backup**: `__SPECIAL/backups/coolify-env-20260122.txt`

## Recovery Procedures

### Droplet Failure
1. Create new droplet from DigitalOcean backup, OR
2. Create fresh droplet and reinstall Coolify:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
3. Restore `/data/coolify/source/.env` from backup
4. Reconnect GitHub repositories in Coolify UI
5. Redeploy applications

### Database Failure
1. DigitalOcean managed databases auto-failover to standby
2. For data recovery: Use DigitalOcean console to restore from backup
3. Point-in-time recovery available for last 7 days

### Application Failure
1. Check Coolify UI for container logs
2. Redeploy from GitHub (Coolify UI → Application → Redeploy)
3. If needed, rollback to previous deployment in Coolify

## Change Log

| Date | Change | Why | Undo |
|------|--------|-----|------|
| 2026-01-22 | Initial Coolify installation | Set up deployment infrastructure | Destroy droplet and recreate |
| 2026-01-22 | Verified PostgreSQL connectivity | Confirm apps can reach managed DB | N/A |
| 2026-01-22 | Connected GitHub App | Enable deployments from GitHub | Remove app in Coolify Settings → GitHub |
| 2026-01-22 | Enabled droplet backups | Data protection | Disable via DO API or console |
| 2026-01-22 | Backed up Coolify .env | Disaster recovery | N/A |
