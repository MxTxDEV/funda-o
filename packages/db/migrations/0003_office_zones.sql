CREATE TABLE "department_office_zones" (
	"department_id" uuid PRIMARY KEY NOT NULL,
	"zone" text NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_office_zones" ADD CONSTRAINT "department_office_zones_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_office_zones" ADD CONSTRAINT "department_office_zones_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "department_office_zones_zone_uq" ON "department_office_zones" USING btree ("zone");