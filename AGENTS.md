# roof-wiki development

Read CLAUDE.md for architecture and source discipline. These updated user requirements supersede any older conflicting language:
- Brands, models, and manufacturer specifications are allowed throughout the wiki.
- Optimize for desktop research and mobile access; not primarily an on-roof workflow.
- Support descriptive search using recorded content, aliases, and verified product data.
- Never invent Xactimate codes. Each published mapping needs category, selector, description, unit, price-list identity, source, and verification date.
- Keep draft review status honest. Preserve calculator behavior and existing Cloudflare deployment configuration.
- Run npm run validate, npm run build:site, and node --test tests/*.test.mjs for search/catalog changes.
- Do not push main or deploy as part of local development.

## Catalog authoring
content/catalog.json contains products and xactimate arrays. Product fields: id, component (existing slug), brand, model, description, specs (text key/value pairs), sourceUrl (manufacturer HTTPS URL), verifiedOn (YYYY-MM-DD). Xactimate fields: id, component, category, selector, description, unit, priceList, source, verifiedOn; optional notes. Build validates references and required fields. No customer data or pricing belongs here.
