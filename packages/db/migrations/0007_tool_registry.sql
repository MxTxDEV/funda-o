CREATE TABLE "research_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid,
	"tool_execution_id" uuid,
	"agent_id" uuid,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"content_hash" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_sources_kind_ck" CHECK ("research_sources"."kind" IN ('web_page', 'search_result'))
);
--> statement-breakpoint
CREATE TABLE "tool_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" text NOT NULL,
	"agent_run_id" uuid,
	"task_id" uuid,
	"agent_id" uuid,
	"status" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"output" jsonb,
	"error" text,
	"denial_reason" text,
	"duration_ms" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_executions_status_ck" CHECK ("tool_executions"."status" IN ('succeeded', 'failed', 'denied'))
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "autonomy_level" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_tool_execution_id_tool_executions_id_fk" FOREIGN KEY ("tool_execution_id") REFERENCES "public"."tool_executions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_sources_task_idx" ON "research_sources" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tool_executions_tool_started_idx" ON "tool_executions" USING btree ("tool_id","started_at");--> statement-breakpoint
CREATE INDEX "tool_executions_agent_started_idx" ON "tool_executions" USING btree ("agent_id","started_at");--> statement-breakpoint
CREATE INDEX "tool_executions_task_idx" ON "tool_executions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tool_executions_run_idx" ON "tool_executions" USING btree ("agent_run_id");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_autonomy_level_ck" CHECK ("agents"."autonomy_level" BETWEEN 1 AND 4);