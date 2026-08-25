ALTER TYPE "public"."tipo_visita" ADD VALUE 'manutencao' BEFORE 'recorrente';--> statement-breakpoint
ALTER TYPE "public"."tipo_visita" ADD VALUE 'pedido' BEFORE 'recorrente';--> statement-breakpoint
ALTER TYPE "public"."tipo_visita" ADD VALUE 'entrega' BEFORE 'recorrente';--> statement-breakpoint
ALTER TYPE "public"."tipo_visita" ADD VALUE 'outro' BEFORE 'recorrente';--> statement-breakpoint
ALTER TABLE "visita" ADD COLUMN "descricao" text;