# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2024-09-16
### Changed
- Normalized cache TTL handling so SimpleCache accepts seconds everywhere, preventing unexpectedly long cache lifetimes.
- Relaxed text sanitization to strip scripts/tags without HTML-escaping valid characters, keeping user-provided names and descriptions readable.
- Enhanced task listing filters: Motion API calls now receive status/priority/label filters and automatically resolve assignee names, emails, or `"me"` to IDs.
- Updated documentation and runtime metadata to reflect version 2.1.0 and the new task filter options.

## [2.0.0]
- Initial consolidated MCP server release with projects, tasks, workspaces, search, comments, schedules, custom fields, recurring tasks, and statuses tools.
