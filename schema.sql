-- Each *_config column follows the same rules:
--   NULL - the file returns 404 for this host
--   '{}' - the host inherits the `default` row's config
--   '{...}' - the host's own config
CREATE SCHEMA IF NOT EXISTS "web_meta";
CREATE TABLE IF NOT EXISTS "web_meta"."sites" (
	"hostname" text PRIMARY KEY,
	"site_name" text NOT NULL,
	"robots_config" jsonb DEFAULT '{}',
	"security_config" jsonb DEFAULT '{}',
	"humans_config" jsonb DEFAULT '{}',
	-- WebFinger (RFC 7033) never inherits from `default`: NULL and '{}' both 404.
	-- Shape: {"resources": {"acct:user@host": {"aliases": [...], "properties": {...}, "links": [{"rel": "...", "href": "..."}]}}}
	"webfinger_config" jsonb DEFAULT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
-- The fallback row every host inherits from. Replace the example values with your own.
INSERT INTO "web_meta"."sites" ("hostname", "site_name", "robots_config", "security_config", "humans_config") VALUES (
    'default',
	'Example Ecosystem',
	'{"groups": [{"user_agents": ["*"], "allow": ["/"], "disallow": ["/api/", "/admin"]}]}',
	'{"contact": ["mailto:security@example.com"]}',
	'{"team": [{"Name": "Your Name"}], "site": {"Host": "https://example.com"}}'
) ON CONFLICT ("hostname") DO NOTHING;
-- For databases created before WebFinger support.
ALTER TABLE "web_meta"."sites" ADD COLUMN IF NOT EXISTS "webfinger_config" jsonb DEFAULT NULL;
