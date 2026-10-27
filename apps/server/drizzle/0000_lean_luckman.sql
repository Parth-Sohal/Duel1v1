CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('win', 'draw', 'forfeit');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('waiting', 'active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('open', 'full', 'in_match', 'closed');--> statement-breakpoint
CREATE TYPE "public"."submission_kind" AS ENUM('run', 'submit');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('queued', 'running', 'accepted', 'wrong_answer', 'time_limit', 'memory_limit', 'runtime_error', 'compile_error', 'internal_error');