CREATE TABLE "vessel_positions_hourly" (
	"mmsi" integer NOT NULL,
	"region" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"sog" real,
	"cog" real,
	"ship_type" smallint,
	"ship_name" text,
	"flag_state" text,
	CONSTRAINT "vessel_positions_hourly_mmsi_region_hour_pk" PRIMARY KEY("mmsi","region","hour")
);
--> statement-breakpoint
CREATE TABLE "vessel_positions_recent" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"mmsi" integer NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"sog" real,
	"cog" real,
	"true_heading" real,
	"navigational_status" smallint,
	"region" text NOT NULL,
	"message_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessels" (
	"mmsi" integer PRIMARY KEY NOT NULL,
	"imo" integer,
	"ship_name" text,
	"call_sign" text,
	"ship_type" smallint,
	"flag_state" text,
	"length_m" real,
	"width_m" real,
	"draft_m" real,
	"destination" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vessel_positions_hourly_region_hour_idx" ON "vessel_positions_hourly" USING btree ("region","hour" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vessel_positions_recent_region_observed_at_idx" ON "vessel_positions_recent" USING btree ("region","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vessel_positions_recent_mmsi_observed_at_idx" ON "vessel_positions_recent" USING btree ("mmsi","observed_at" DESC NULLS LAST);