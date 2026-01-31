# Assignment Detail Improvements Request

**Date:** 2026-01-31
**Request:** Assignment Detail Modal Improvements

## Summary
Improve the Expertly Manage Assignment Detail modal with:
1. Future date scheduling - Allow setting a "not before" date/time window
2. More compact UI - Reduce vertical spacing, better information density
3. Visual refresh - Make it less "dull" with better styling and visual hierarchy
4. Better comments - Support lengthy threaded discussions like Teamwork

## Changes Made
1. Backend: Added scheduling fields to Task model (scheduled_start, scheduled_end, schedule_timezone)
2. Frontend: Updated API types with scheduling fields
3. Frontend: Refactored TaskDetailModal with compact layout, visual refresh, collapsible Advanced Settings, improved comments section
