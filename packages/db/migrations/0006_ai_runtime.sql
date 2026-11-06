CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"run_number" integer NOT NULL,
	"attempt" integer NOT NULL,
	"agent_id" uuid,
	"agent_version_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"response_model" text,
	"status" text DEFAULT 'running' NOT NULL,
	"prompt_hash" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(14, 6),
	"finish_reason" text,
	"provider_request_id" text,
	"tools_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_status_ck" CHECK ("agent_runs"."status" IN ('running', 'succeeded', 'failed', 'aborted'))
);
--> statement-breakpoint
CREATE TABLE "ai_provider_checks" (
	"provider" text PRIMARY KEY NOT NULL,
	"ok" boolean NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"latency_ms" integer,
	"models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_version_id_agent_versions_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_checks" ADD CONSTRAINT "ai_provider_checks_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_task_run_attempt_uq" ON "agent_runs" USING btree ("task_id","run_number","attempt");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_started_idx" ON "agent_runs" USING btree ("agent_id","started_at");--> statement-breakpoint
CREATE INDEX "agent_runs_started_idx" ON "agent_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");