ALTER TABLE "agent_versions" ADD COLUMN "ai_provider" text;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD COLUMN "ai_model" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "specialties" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "personality" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "hierarchy_level" text DEFAULT 'specialist' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "reports_to_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "appearance" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "seed_key" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reports_to_agent_id_agents_id_fk" FOREIGN KEY ("reports_to_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_reports_to_idx" ON "agents" USING btree ("reports_to_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_seed_key_uq" ON "agents" USING btree ("seed_key");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_hierarchy_level_ck" CHECK ("agents"."hierarchy_level" IN ('coo', 'director', 'specialist'));