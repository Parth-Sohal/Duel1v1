CREATE TABLE "daily_challenges" (
	"day" date PRIMARY KEY NOT NULL,
	"challenge_version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_challenge_version_id_challenge_versions_id_fk" FOREIGN KEY ("challenge_version_id") REFERENCES "public"."challenge_versions"("id") ON DELETE cascade ON UPDATE no action;