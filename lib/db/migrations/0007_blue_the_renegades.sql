CREATE TABLE "PlayerPersona" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"ownerId" uuid NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "playerPersonaId" uuid;--> statement-breakpoint
ALTER TABLE "PlayerPersona" ADD CONSTRAINT "PlayerPersona_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_playerPersonaId_PlayerPersona_id_fk" FOREIGN KEY ("playerPersonaId") REFERENCES "public"."PlayerPersona"("id") ON DELETE set null ON UPDATE no action;