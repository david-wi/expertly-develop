# Future Monitor Providers Backlog

## Email Providers (Priority)
- [x] Gmail - Implemented
- [x] Outlook - Implemented
- [ ] iMessage - Apple Messages for Business API

## Team Communication
- [ ] Teams - Microsoft Teams via Graph API
- [ ] Discord - Discord Bot API
- [ ] WhatsApp for Business - WhatsApp Business API

## Project/Task Management
- [ ] Teamwork - Teamwork Projects API (webhook-based)
- [ ] Jira - Atlassian Jira Cloud API
- [ ] GitHub - Already implemented (GitHubMonitorAdapter)

## Customer Support
- [ ] Zendesk - Zendesk API (tickets, comments)
- [ ] Freshdesk - Freshdesk API
- [ ] Intercom - Intercom API (conversations)

## CRM/Marketing
- [ ] HubSpot - HubSpot CRM API (contacts, deals, tickets)

## Social Media
- [ ] Facebook Messenger - Meta Business API
- [ ] Instagram - Meta Business API (DMs, comments)

## Other
- [ ] SMS - Twilio API or similar

---

## Implementation Notes

Each provider should:
1. Create adapter class in `backend/app/services/monitor_providers/{provider}.py`
2. Follow MonitorAdapter interface (poll, validate_config, get_required_scopes)
3. Add provider to MonitorProvider enum in `models/monitor.py`
4. Add provider config model if needed
5. Register in monitor_service.py `get_adapter_for_provider()`
6. Add OAuth provider if needed (oauth.py, config.py)
7. Update frontend Monitors.tsx with provider-specific form fields
8. Update connections API list_providers()
