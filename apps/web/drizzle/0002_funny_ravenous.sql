CREATE TABLE "share_link" (
	"board_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"token" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_link_board_id_idx" ON "share_link" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_live_board_id_idx" ON "share_link" USING btree ("board_id") WHERE "share_link"."revoked_at" is null;