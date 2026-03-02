# Release Notes

## v1.0.0

Initial release.

### Tools
- `confluence_health_check` – Test connection and verify account/space info
- `search_content` – CQL full-text search across pages and blog posts
- `get_page` – Full page content including body (HTML stripped to plain text)
- `create_page` – Create new pages with Confluence Storage Format content
- `update_page` – Update existing page body, title, with auto version increment
- `list_spaces` – List all accessible spaces with keys and types
- `list_pages_in_space` – Browse pages within a specific space
- `add_page_comment` – Add inline comments to pages

### Authentication
- Confluence Cloud: Email + API token (Basic Auth)
- Confluence Server / Data Center: Personal Access Token (Bearer)
