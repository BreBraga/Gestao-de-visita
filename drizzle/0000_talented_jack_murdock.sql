CREATE TYPE "public"."papel" AS ENUM('vendedor', 'gestor');--> statement-breakpoint
CREATE TABLE "tentativa_login" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identificador" text NOT NULL,
	"em_janela" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"senha_hash" text NOT NULL,
	"zaple_user_id" uuid NOT NULL,
	"papel" "papel" DEFAULT 'vendedor' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
CREATE INDEX "idx_tentativa_identificador_janela" ON "tentativa_login" USING btree ("identificador","em_janela");