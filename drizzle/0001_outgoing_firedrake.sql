CREATE TYPE "public"."status_visita" AS ENUM('a_fazer', 'realizada', 'cancelada', 'reagendada');--> statement-breakpoint
CREATE TYPE "public"."tipo_visita" AS ENUM('prospeccao', 'recorrente');--> statement-breakpoint
CREATE TABLE "visita" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contato_id" uuid NOT NULL,
	"contato_nome" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"zaple_user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"status" "status_visita" DEFAULT 'a_fazer' NOT NULL,
	"tipo" "tipo_visita" DEFAULT 'prospeccao' NOT NULL,
	"titulo" text NOT NULL,
	"relatorio" text,
	"origem_id" uuid,
	"card_id" uuid,
	"sincronizado_em" timestamp with time zone,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visita" ADD CONSTRAINT "visita_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_visita_usuario_data" ON "visita" USING btree ("usuario_id","data");--> statement-breakpoint
CREATE INDEX "idx_visita_data_status" ON "visita" USING btree ("data","status");