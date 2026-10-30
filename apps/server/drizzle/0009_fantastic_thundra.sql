ALTER TABLE "matches" DROP CONSTRAINT "matches_winner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;