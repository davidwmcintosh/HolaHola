CREATE TYPE "public"."agenda_priority" AS ENUM('high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."agenda_status" AS ENUM('pending', 'in_progress', 'completed', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."agenda_type" AS ENUM('general', 'compass_reflection', 'feature_request', 'bug_report', 'consultation');--> statement-breakpoint
CREATE TYPE "public"."agent_collab_author" AS ENUM('daniela', 'wren', 'founder', 'alden', 'agent');--> statement-breakpoint
CREATE TYPE "public"."agent_collab_message_type" AS ENUM('request', 'proposal', 'clarification', 'feedback', 'implementation_report', 'acknowledgment', 'escalation', 'founder_directive');--> statement-breakpoint
CREATE TYPE "public"."agent_collab_thread_status" AS ENUM('active', 'awaiting_wren', 'awaiting_daniela', 'awaiting_founder', 'founder_review', 'in_progress', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."agent_collaboration_event_type" AS ENUM('question', 'response', 'feedback', 'delegation', 'delegation_complete', 'status_update', 'consultation', 'acknowledgment');--> statement-breakpoint
CREATE TYPE "public"."agent_observation_category" AS ENUM('architecture', 'pattern', 'improvement', 'bug_pattern', 'user_behavior', 'performance', 'daniela_behavior', 'sync_issue', 'next_step');--> statement-breakpoint
CREATE TYPE "public"."agent_open_question_status" AS ENUM('open', 'resolved', 'tabled');--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('daniela', 'assistant', 'support', 'editor');--> statement-breakpoint
CREATE TYPE "public"."aris_drill_assignment_status" AS ENUM('pending', 'in_progress', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."aris_drill_handler" AS ENUM('daniela', 'assistant', 'both');--> statement-breakpoint
CREATE TYPE "public"."aris_drill_lifecycle" AS ENUM('planned', 'active', 'completed', 'delegated', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."aris_drill_origin" AS ENUM('syllabus_bundle', 'daniela_manual');--> statement-breakpoint
CREATE TYPE "public"."aris_drill_type" AS ENUM('repeat', 'translate', 'match', 'fill_blank', 'sentence_order');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('replit', 'password', 'pending');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('password_reset', 'invitation');--> statement-breakpoint
CREATE TYPE "public"."best_practice_category" AS ENUM('tool_usage', 'teaching_style', 'pacing', 'communication', 'content', 'system', 'encouragement', 'error_handling', 'personalization', 'scaffolding');--> statement-breakpoint
CREATE TYPE "public"."brain_event_source" AS ENUM('passive_lookup', 'active_function', 'extraction_service', 'streaming_orchestrator', 'openmicFlow', 'context_assembly');--> statement-breakpoint
CREATE TYPE "public"."brain_event_type" AS ENUM('memory_retrieval', 'memory_injection', 'memory_lookup_tool', 'fact_extraction', 'action_trigger', 'tool_call', 'context_injection');--> statement-breakpoint
CREATE TYPE "public"."build_queue_proposer" AS ENUM('alden', 'agent');--> statement-breakpoint
CREATE TYPE "public"."build_queue_status" AS ENUM('pending', 'approved', 'executing', 'done', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."collab_message_role" AS ENUM('founder', 'daniela', 'editor', 'system', 'wren');--> statement-breakpoint
CREATE TYPE "public"."collab_message_type" AS ENUM('text', 'voice');--> statement-breakpoint
CREATE TYPE "public"."collaboration_event_type" AS ENUM('daniela_suggestion', 'daniela_insight', 'daniela_question', 'editor_response', 'editor_note', 'editor_acknowledgment', 'founder_observation', 'system_notification');--> statement-breakpoint
CREATE TYPE "public"."collaboration_role" AS ENUM('daniela', 'editor', 'founder', 'system');--> statement-breakpoint
CREATE TYPE "public"."compartment_event_type" AS ENUM('pounding', 'wobble', 'stability', 'derivation', 'unlock', 'review');--> statement-breakpoint
CREATE TYPE "public"."compartment_status" AS ENUM('unstarted', 'pounding', 'wobbling', 'stable', 'generative');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('tentative', 'pending_match', 'confirmed', 'external');--> statement-breakpoint
CREATE TYPE "public"."conversation_memory_entry_type" AS ENUM('conversation', 'decision', 'emergence', 'build', 'episode');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('learning', 'editor_collaboration');--> statement-breakpoint
CREATE TYPE "public"."daniela_beacon_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."daniela_beacon_status" AS ENUM('pending', 'acknowledged', 'in_progress', 'completed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."daniela_beacon_type" AS ENUM('feature_request', 'capability_gap', 'tool_request', 'self_surgery', 'observation', 'bug_report', 'coherence_check', 'architecture_drift', 'sprint_alignment');--> statement-breakpoint
CREATE TYPE "public"."daniela_note_type" AS ENUM('tool_experiment', 'teaching_rhythm', 'session_reflection', 'language_insight', 'student_pattern', 'idea_to_try', 'what_worked', 'what_didnt_work', 'question_for_founder', 'self_affirmation');--> statement-breakpoint
CREATE TYPE "public"."drill_item_type" AS ENUM('listen_repeat', 'number_dictation', 'translate_speak', 'matching', 'fill_blank');--> statement-breakpoint
CREATE TYPE "public"."editor_beacon_queue_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."editor_insight_category" AS ENUM('philosophy', 'architecture', 'relationship', 'debugging', 'personality', 'workflow', 'context', 'journal', 'tools', 'shared');--> statement-breakpoint
CREATE TYPE "public"."entitlement_type" AS ENUM('class_allocation', 'purchase', 'bonus', 'trial');--> statement-breakpoint
CREATE TYPE "public"."environment_origin" AS ENUM('development', 'production');--> statement-breakpoint
CREATE TYPE "public"."error_tolerance" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."founder_collab_status" AS ENUM('active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."grammar_category" AS ENUM('verb_tense', 'verb_mood', 'verb_aspect', 'verb_type', 'noun_agreement', 'pronoun', 'adjective', 'adverb', 'preposition', 'article', 'sentence_structure', 'clause');--> statement-breakpoint
CREATE TYPE "public"."growth_memory_category" AS ENUM('teaching_technique', 'timing_inflection', 'specific_joke', 'relationship_insight', 'correction_received', 'breakthrough_method', 'cultural_nuance', 'emotional_intelligence');--> statement-breakpoint
CREATE TYPE "public"."hive_snapshot_type" AS ENUM('teaching_moment', 'breakthrough', 'struggle_pattern', 'beacon_context', 'session_summary', 'plateau_alert', 'relationship_moment', 'role_reversal', 'humor_shared', 'voice_diagnostic', 'life_context', 'voice_baselines', 'aggregate_analytics', 'prod_conversations');--> statement-breakpoint
CREATE TYPE "public"."journey_snapshot_type" AS ENUM('language_journey', 'overall_journey', 'relationship');--> statement-breakpoint
CREATE TYPE "public"."learning_context" AS ENUM('self_directed', 'class_assigned');--> statement-breakpoint
CREATE TYPE "public"."learning_milestone_type" AS ENUM('breakthrough', 'first_success', 'plateau_overcome', 'connection_made', 'confidence_boost', 'teacher_flagged', 'vocabulary_milestone', 'grammar_milestone', 'fluency_marker');--> statement-breakpoint
CREATE TYPE "public"."lesson_draft_status" AS ENUM('draft', 'pending', 'approved', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."lesson_page_event_type" AS ENUM('started', 'completed', 'vocab_introduced', 'grammar_drilled', 'example_practiced', 'wobble_detected', 'milestone_hit');--> statement-breakpoint
CREATE TYPE "public"."memory_review_status" AS ENUM('pending', 'approved_founder', 'approved_auto', 'rejected', 'needs_revision');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('system_health', 'user_activity', 'voice_engagement', 'error_rate');--> statement-breakpoint
CREATE TYPE "public"."compass_category" AS ENUM('pedagogy', 'honesty', 'identity', 'collaboration', 'ambiguity');--> statement-breakpoint
CREATE TYPE "public"."compass_example_source" AS ENUM('founder_original', 'discovered', 'approved');--> statement-breakpoint
CREATE TYPE "public"."pedagogical_focus" AS ENUM('grammar', 'fluency', 'pronunciation', 'culture', 'vocabulary', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."pedagogical_loop_status" AS ENUM('active', 'suspended', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."pedagogical_loop_type" AS ENUM('madrigal_4step', 'grammar_drill', 'actfl_checkpoint');--> statement-breakpoint
CREATE TYPE "public"."post_flight_verdict" AS ENUM('mvp_ready', 'needs_polish', 'polished');--> statement-breakpoint
CREATE TYPE "public"."proposed_change_status" AS ENUM('pending_review', 'approved', 'applied', 'rejected', 'revised', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."recommendation_creator" AS ENUM('daniela', 'system');--> statement-breakpoint
CREATE TYPE "public"."recommendation_rationale" AS ENUM('remediate', 'reinforce', 'accelerate');--> statement-breakpoint
CREATE TYPE "public"."requirement_tier" AS ENUM('required', 'recommended', 'optional_premium');--> statement-breakpoint
CREATE TYPE "public"."scenario_category" AS ENUM('social', 'professional', 'travel', 'daily', 'emergency', 'cultural');--> statement-breakpoint
CREATE TYPE "public"."security_classification" AS ENUM('public', 'internal', 'daniela_summary');--> statement-breakpoint
CREATE TYPE "public"."self_surgery_status" AS ENUM('pending', 'approved', 'promoted', 'rejected', 'edited');--> statement-breakpoint
CREATE TYPE "public"."self_surgery_target" AS ENUM('tutor_procedures', 'teaching_principles', 'tool_knowledge', 'situational_patterns', 'language_idioms', 'cultural_nuances', 'learner_error_patterns', 'dialect_variations', 'linguistic_bridges', 'creativity_templates');--> statement-breakpoint
CREATE TYPE "public"."session_phase" AS ENUM('active', 'post_session', 'completed');--> statement-breakpoint
CREATE TYPE "public"."sprint_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sprint_source" AS ENUM('founder', 'wren_commitment', 'consultation', 'ai_suggestion');--> statement-breakpoint
CREATE TYPE "public"."sprint_stage" AS ENUM('idea', 'pedagogy_spec', 'build_plan', 'in_progress', 'shipped');--> statement-breakpoint
CREATE TYPE "public"."suggestion_category" AS ENUM('self_improvement', 'content_gap', 'ux_observation', 'teaching_insight', 'product_feature', 'technical_issue', 'student_pattern', 'tool_enhancement');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('emerging', 'ready', 'reviewed', 'implemented', 'deferred', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."support_observation_category" AS ENUM('user_friction', 'common_question', 'system_issue', 'feature_request', 'success_pattern', 'documentation_gap', 'onboarding_insight', 'billing_pattern', 'troubleshoot_solution');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_category" AS ENUM('technical', 'account', 'billing', 'content', 'feedback', 'other');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_priority" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('pending', 'active', 'resolved', 'escalated', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."surgery_session_status" AS ENUM('idle', 'running', 'paused', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."surgery_turn_speaker" AS ENUM('daniela', 'editor', 'system');--> statement-breakpoint
CREATE TYPE "public"."syllabus_status" AS ENUM('not_started', 'in_progress', 'completed_early', 'completed_assigned', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."sync_anomaly_severity" AS ENUM('warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sync_anomaly_type" AS ENUM('zero-count-success', 'stale-batch', 'failed-sync', 'missing-receipt', 'checksum-mismatch');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('local', 'pending_review', 'approved', 'rejected', 'synced');--> statement-breakpoint
CREATE TYPE "public"."synthesized_insight_category" AS ENUM('teaching_pattern', 'error_cluster', 'feature_usage', 'system_health', 'student_journey', 'content_quality', 'voice_quality', 'support_trend', 'cross_agent');--> statement-breakpoint
CREATE TYPE "public"."system_alert_severity" AS ENUM('info', 'notice', 'warning', 'outage', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."system_alert_target" AS ENUM('all', 'voice_users', 'teachers', 'students', 'new_users', 'premium');--> statement-breakpoint
CREATE TYPE "public"."teaching_style" AS ENUM('structured', 'conversational', 'drill_focused', 'adaptive', 'socratic');--> statement-breakpoint
CREATE TYPE "public"."teaching_tool_type" AS ENUM('write', 'compare', 'phonetic', 'word_map', 'image', 'grammar_table', 'context', 'culture', 'reading', 'stroke', 'play', 'scenario', 'summary', 'drill_repeat', 'drill_translate', 'drill_match', 'drill_fill_blank', 'drill_sentence_order', 'subtitle_on', 'subtitle_off', 'subtitle_target', 'custom_overlay', 'text_input');--> statement-breakpoint
CREATE TYPE "public"."topic_competency_status" AS ENUM('demonstrated', 'needs_review', 'struggling');--> statement-breakpoint
CREATE TYPE "public"."topic_coverage_status" AS ENUM('pending', 'in_progress', 'covered', 'partial', 'deferred', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."topic_priority" AS ENUM('must_have', 'nice_to_have', 'bonus');--> statement-breakpoint
CREATE TYPE "public"."topic_type" AS ENUM('subject', 'grammar', 'function');--> statement-breakpoint
CREATE TYPE "public"."tutor_freedom_level" AS ENUM('guided', 'flexible_goals', 'open_exploration', 'free_conversation');--> statement-breakpoint
CREATE TYPE "public"."tutor_mode" AS ENUM('main', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."tutor_role" AS ENUM('tutor', 'assistant', 'support', 'alden');--> statement-breakpoint
CREATE TYPE "public"."tutor_session_status" AS ENUM('scheduled', 'active', 'paused', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."understanding_depth" AS ENUM('surface', 'applied', 'integrated', 'mastered');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher', 'developer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vocabulary_level" AS ENUM('beginner_friendly', 'intermediate', 'advanced', 'academic');--> statement-breakpoint
CREATE TYPE "public"."voice_session_status" AS ENUM('active', 'completed', 'abandoned', 'error');--> statement-breakpoint
CREATE TYPE "public"."word_type" AS ENUM('noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'article', 'other');--> statement-breakpoint
CREATE TYPE "public"."wren_commitment_priority" AS ENUM('urgent', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."wren_commitment_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wren_commitment_type" AS ENUM('feature_sprint', 'documentation', 'analysis', 'implementation', 'investigation', 'review', 'general');--> statement-breakpoint
CREATE TYPE "public"."wren_insight_category" AS ENUM('pattern', 'solution', 'gotcha', 'architecture', 'debugging', 'integration', 'performance');--> statement-breakpoint
CREATE TYPE "public"."wren_mistake_severity" AS ENUM('minor', 'moderate', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."wren_mistake_status" AS ENUM('identified', 'investigating', 'resolved', 'documented');--> statement-breakpoint
CREATE TYPE "public"."wren_trigger_status" AS ENUM('pending', 'surfaced', 'acknowledged', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."wren_trigger_urgency" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "actfl_assessment_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"language" varchar NOT NULL,
	"previous_level" varchar,
	"new_level" varchar NOT NULL,
	"direction" varchar,
	"confidence" integer,
	"reason" text NOT NULL,
	"tools_used_before" text[],
	"tools_used_session" text[],
	"message_count_before" integer,
	"voice_session_id" varchar,
	"conversation_id" varchar,
	"class_id" varchar,
	"session_duration_seconds" integer,
	"correction_count_session" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actfl_level_changes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"from_level" text,
	"to_level" text NOT NULL,
	"conversation_id" text,
	"triggered_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actfl_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"tasks_completed" text[] DEFAULT ARRAY[]::text[],
	"tasks_total" integer DEFAULT 0 NOT NULL,
	"avg_pronunciation_confidence" real DEFAULT 0,
	"total_voice_messages" integer DEFAULT 0,
	"grammar_score" real DEFAULT 0,
	"vocabulary_score" real DEFAULT 0,
	"topics_covered" text[] DEFAULT ARRAY[]::text[],
	"topics_total" integer DEFAULT 0 NOT NULL,
	"text_type" text DEFAULT 'words',
	"avg_message_length" real DEFAULT 0,
	"longest_message_length" integer DEFAULT 0,
	"practice_hours" real DEFAULT 0,
	"messages_at_current_level" integer DEFAULT 0,
	"days_at_current_level" integer DEFAULT 0,
	"last_advancement" timestamp,
	"current_actfl_level" text DEFAULT 'novice_low',
	"ready_for_advancement" boolean DEFAULT false,
	"advancement_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" varchar,
	"metadata" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "agenda_type" DEFAULT 'general',
	"priority" "agenda_priority" DEFAULT 'normal',
	"status" "agenda_status" DEFAULT 'pending',
	"created_by" varchar NOT NULL,
	"created_by_name" varchar,
	"target_session_id" varchar,
	"discussed_in_session_id" varchar,
	"notes" text,
	"compass_principle_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"details" text,
	"status" varchar DEFAULT 'complete' NOT NULL,
	"todos" text[] DEFAULT '{}',
	"session_ref" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_collab_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"author" "agent_collab_author" NOT NULL,
	"message_type" "agent_collab_message_type" NOT NULL,
	"content" text NOT NULL,
	"code_snippets" text[] DEFAULT '{}',
	"file_references" text[] DEFAULT '{}',
	"proposal_details" jsonb,
	"implementation_details" jsonb,
	"was_helpful" boolean,
	"helpfulness_notes" text,
	"reply_to_id" varchar,
	"read_by_daniela" boolean DEFAULT false,
	"read_by_wren" boolean DEFAULT false,
	"read_by_founder" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_collab_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"status" "agent_collab_thread_status" DEFAULT 'active' NOT NULL,
	"origin_beacon_id" varchar,
	"origin_trigger_id" varchar,
	"origin_type" varchar(50) DEFAULT 'spontaneous',
	"related_component" varchar(100),
	"related_files" text[] DEFAULT '{}',
	"priority" varchar(20) DEFAULT 'normal',
	"message_count" integer DEFAULT 0,
	"last_message_at" timestamp,
	"last_message_by" "agent_collab_author",
	"resolution" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_collaboration_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_agent" "agent_role" NOT NULL,
	"to_agent" "agent_role",
	"event_type" "agent_collaboration_event_type" NOT NULL,
	"security_classification" "security_classification" DEFAULT 'public' NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"public_summary" text,
	"metadata" jsonb,
	"user_id" varchar,
	"conversation_id" varchar,
	"related_event_id" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"acknowledged_by" "agent_role",
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_north_star" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"written_at" timestamp DEFAULT now() NOT NULL,
	"purpose" text NOT NULL,
	"values" text[] DEFAULT '{}'::text[],
	"role_in_holahola" text NOT NULL,
	"what_matters" text NOT NULL,
	"open_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_agent" varchar(20) NOT NULL,
	"to_agent" varchar(20) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"body" text NOT NULL,
	"session_label" varchar(300),
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_observations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "agent_observation_category" NOT NULL,
	"priority" integer DEFAULT 50,
	"title" varchar NOT NULL,
	"observation" text NOT NULL,
	"reasoning" text,
	"evidence_count" integer DEFAULT 1,
	"evidence_summary" text,
	"related_files" text[],
	"proposed_action" text,
	"proposed_code" text,
	"target_table" varchar,
	"status" varchar DEFAULT 'active',
	"implemented_at" timestamp,
	"implemented_by" varchar,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_role" varchar DEFAULT 'editor',
	"domain_tags" text[],
	"intent_hash" varchar,
	"acknowledged_by_daniela" boolean DEFAULT false,
	"acknowledged_by_support" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_open_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"question" text NOT NULL,
	"context" text,
	"status" "agent_open_question_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"resolution" text,
	"tags" text[] DEFAULT '{}'::text[],
	"importance" integer DEFAULT 5
);
--> statement-breakpoint
CREATE TABLE "agent_record_of_david" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"written_at" timestamp DEFAULT now() NOT NULL,
	"who" text NOT NULL,
	"how_he_works" text NOT NULL,
	"what_he_cares" text NOT NULL,
	"the_vision" text NOT NULL,
	"note_to_self" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cost_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logged_at" bigint NOT NULL,
	"model" varchar(100) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"context" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"rationale" text,
	"suggestion_type" varchar(50) NOT NULL,
	"priority" "sprint_priority" DEFAULT 'medium' NOT NULL,
	"confidence" real NOT NULL,
	"trigger_context" jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"converted_to_sprint_id" varchar,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alden_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"summary" text,
	"tags" text[] DEFAULT '{}'::text[],
	"tasks_completed" text[] DEFAULT '{}'::text[],
	"files_modified" text[] DEFAULT '{}'::text[],
	"mood" varchar,
	"significance" integer DEFAULT 5,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alden_escalations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_description" text NOT NULL,
	"analysis" text NOT NULL,
	"trigger" varchar DEFAULT 'recurring_pattern' NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alden_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"is_significant" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alden_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"triggered_by" varchar DEFAULT 'alden' NOT NULL,
	"severity" varchar DEFAULT 'info' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"fingerprint" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alden_watch_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_interval_hours" integer DEFAULT 2 NOT NULL,
	"recovery_poll_minutes" integer DEFAULT 10 NOT NULL,
	"budget_warn_usd" integer DEFAULT 3 NOT NULL,
	"budget_alert_usd" integer DEFAULT 5 NOT NULL,
	"low_health_threshold" integer DEFAULT 70 NOT NULL,
	"consecutive_low_score_trigger" integer DEFAULT 3 NOT NULL,
	"fingerprint_ttl_hours" integer DEFAULT 24 NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"update_reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "architect_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"content" text NOT NULL,
	"delivered" boolean DEFAULT false,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "architectural_decision_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"status" varchar DEFAULT 'accepted',
	"context" text NOT NULL,
	"decision" text NOT NULL,
	"rationale" text NOT NULL,
	"alternatives_considered" jsonb DEFAULT '[]'::jsonb,
	"consequences" text,
	"tradeoffs" text,
	"related_files" text[] DEFAULT '{}'::text[],
	"related_adr_ids" text[] DEFAULT '{}'::text[],
	"superseded_by" varchar,
	"decision_made_by" varchar,
	"decision_made_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aris_drill_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"delegated_by" "agent_role" DEFAULT 'daniela' NOT NULL,
	"delegation_event_id" varchar,
	"drill_type" "aris_drill_type" NOT NULL,
	"target_language" varchar(50) NOT NULL,
	"drill_content" jsonb NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"max_attempts" integer DEFAULT 3,
	"expires_at" timestamp,
	"status" "aris_drill_assignment_status" DEFAULT 'pending' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"origin" "aris_drill_origin" DEFAULT 'daniela_manual',
	"lifecycle_state" "aris_drill_lifecycle" DEFAULT 'active',
	"handled_by" "aris_drill_handler" DEFAULT 'assistant',
	"lesson_id" varchar,
	"bundle_id" varchar
);
--> statement-breakpoint
CREATE TABLE "aris_drill_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"completion_rate" real NOT NULL,
	"accuracy_rate" real NOT NULL,
	"total_items" integer NOT NULL,
	"correct_items" integer NOT NULL,
	"time_spent_seconds" integer,
	"item_results" jsonb,
	"strengths" text[],
	"struggles" text[],
	"behavioral_flags" jsonb,
	"recommendations" text,
	"feedback_event_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"conversation_id" varchar,
	"status" text DEFAULT 'not_started',
	"minutes_completed" integer DEFAULT 0,
	"messages_completed" integer DEFAULT 0,
	"vocabulary_mastered" integer DEFAULT 0,
	"teacher_score" integer,
	"teacher_feedback" text,
	"ai_score" integer,
	"submitted_at" timestamp,
	"graded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_vocabulary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"vocabulary_word_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"teacher_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignment_type" text NOT NULL,
	"curriculum_lesson_id" varchar,
	"conversation_topic" text,
	"target_minutes" integer,
	"target_message_count" integer,
	"due_date" timestamp,
	"is_published" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"text_hash" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"language" varchar(10) NOT NULL,
	"voice_id" varchar(100),
	"speed" text DEFAULT 'normal' NOT NULL,
	"audio_url" text NOT NULL,
	"duration_ms" integer,
	"source_id" varchar,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"token_type" "auth_token_type" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"metadata" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" date NOT NULL,
	"user_id" varchar,
	"target_language" varchar(50),
	"memory_retrieval_count" integer DEFAULT 0,
	"memory_injection_count" integer DEFAULT 0,
	"memory_lookup_tool_count" integer DEFAULT 0,
	"avg_relevance_score" real,
	"avg_freshness_days" real,
	"memory_usage_rate" real,
	"redundancy_rate" real,
	"memory_type_diversity" jsonb,
	"fact_type_diversity" jsonb,
	"facts_extracted_count" integer DEFAULT 0,
	"specific_facts_count" integer DEFAULT 0,
	"vague_facts_count" integer DEFAULT 0,
	"fact_specificity_rate" real,
	"tool_call_count" integer DEFAULT 0,
	"tool_breakdown" jsonb,
	"action_trigger_count" integer DEFAULT 0,
	"action_trigger_breakdown" jsonb,
	"unique_sessions_count" integer DEFAULT 0,
	"unique_students_count" integer DEFAULT 0,
	"students_with_memory_activity" integer DEFAULT 0,
	"student_coverage_rate" real,
	"avg_latency_ms" real,
	"p95_latency_ms" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "brain_event_type" NOT NULL,
	"event_source" "brain_event_source" NOT NULL,
	"session_id" varchar,
	"conversation_id" varchar,
	"user_id" varchar,
	"target_language" varchar(50),
	"memory_ids" text[],
	"memory_types" text[],
	"query_terms" text,
	"results_count" integer,
	"relevance_score" real,
	"freshness_avg_days" real,
	"tool_name" varchar(100),
	"action_trigger" varchar(100),
	"tag_payload" jsonb,
	"fact_type" varchar(50),
	"fact_specificity" varchar(20),
	"latency_ms" integer,
	"was_used" boolean DEFAULT false,
	"redundancy_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_by" "build_queue_proposer" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"files_affected" text[],
	"is_safe_zone" boolean DEFAULT false NOT NULL,
	"diff" text,
	"status" "build_queue_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"reviewed_by" text,
	"review_note" text,
	"proposed_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"executed_at" timestamp,
	"result" text
);
--> statement-breakpoint
CREATE TABLE "can_do_statements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"actfl_level" text NOT NULL,
	"category" text NOT NULL,
	"mode" text,
	"statement" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_curriculum_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_unit_id" varchar NOT NULL,
	"source_lesson_id" varchar,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"order_index" integer NOT NULL,
	"lesson_type" text NOT NULL,
	"actfl_level" text,
	"requirement_tier" text DEFAULT 'required',
	"bundle_id" varchar,
	"linked_drill_lesson_id" varchar,
	"prerequisite_lesson_id" varchar,
	"conversation_topic" text,
	"conversation_prompt" text,
	"objectives" text[],
	"estimated_minutes" integer,
	"required_topics" text[],
	"required_vocabulary" text[],
	"required_grammar" text[],
	"min_pronunciation_score" real,
	"is_custom" boolean DEFAULT false,
	"is_removed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_curriculum_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"source_unit_id" varchar,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"order_index" integer NOT NULL,
	"actfl_level" text,
	"cultural_theme" text,
	"estimated_hours" integer,
	"commitments" jsonb,
	"is_custom" boolean DEFAULT false,
	"is_removed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true,
	"placement_checked" boolean DEFAULT false,
	"placement_actfl_result" varchar,
	"placement_delta" integer,
	"placement_date" timestamp,
	"allocated_seconds" integer DEFAULT 0,
	"used_seconds" integer DEFAULT 0,
	"pace_status" varchar DEFAULT 'on_track',
	"expected_progress_percent" real,
	"actual_progress_percent" real
);
--> statement-breakpoint
CREATE TABLE "class_hour_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hours_per_student" integer NOT NULL,
	"total_purchased_hours" integer,
	"used_hours" integer DEFAULT 0,
	"price_per_student" integer,
	"purchased_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"purchaser_id" varchar,
	"status" varchar DEFAULT 'active',
	"stripe_subscription_id" varchar,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" varchar NOT NULL,
	"icon" varchar,
	"display_order" integer DEFAULT 0,
	"is_preset" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "class_types_name_unique" UNIQUE("name"),
	CONSTRAINT "class_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collaboration_channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar,
	"user_id" varchar,
	"session_phase" "session_phase" DEFAULT 'active' NOT NULL,
	"target_language" varchar,
	"student_level" varchar,
	"session_topic" varchar,
	"heartbeat_at" timestamp DEFAULT now(),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"summary_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "collaboration_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "collaboration_event_type" NOT NULL,
	"sender_role" "collaboration_role" NOT NULL,
	"sender_id" varchar,
	"content" text NOT NULL,
	"summary" varchar(255),
	"metadata" jsonb,
	"is_read" boolean DEFAULT false,
	"is_resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaboration_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" "collab_message_role" NOT NULL,
	"message_type" "collab_message_type" DEFAULT 'text',
	"content" text NOT NULL,
	"audio_url" varchar,
	"audio_duration" integer,
	"metadata" jsonb,
	"cursor" varchar NOT NULL,
	"environment" varchar NOT NULL,
	"synced" boolean DEFAULT false,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaboration_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "collaboration_role" NOT NULL,
	"user_id" varchar,
	"display_name" varchar(100) NOT NULL,
	"is_online" boolean DEFAULT false,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"notify_on_new_events" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compartment_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" varchar(30) NOT NULL,
	"pattern_key" varchar(100) NOT NULL,
	"event_type" "compartment_event_type" NOT NULL,
	"verb_context" varchar(100),
	"student_utterance" text,
	"session_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compartment_installation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" varchar(30) NOT NULL,
	"pattern_key" varchar(100) NOT NULL,
	"status" "compartment_status" DEFAULT 'unstarted' NOT NULL,
	"pounding_count" integer DEFAULT 0 NOT NULL,
	"wobble_count" integer DEFAULT 0 NOT NULL,
	"derivation_count" integer DEFAULT 0 NOT NULL,
	"last_wobbled_at" timestamp,
	"stabilized_at" timestamp,
	"generative_at" timestamp,
	"last_drilled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"response_type" varchar(50),
	"confidence" real,
	"converted_to_sprint_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255),
	"topic" varchar(100),
	"sprint_id" varchar,
	"created_by" varchar NOT NULL,
	"is_resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_memories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"participants" varchar DEFAULT 'David + Agent',
	"entry_type" "conversation_memory_entry_type" DEFAULT 'conversation' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[],
	"importance" integer DEFAULT 7,
	"extends_memory_id" varchar,
	"theme_tags" text[] DEFAULT '{}'::text[],
	"arc_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"topic_id" varchar NOT NULL,
	"confidence" real DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"owner_email" text,
	"language" text NOT NULL,
	"native_language" text DEFAULT 'english' NOT NULL,
	"difficulty" text NOT NULL,
	"topic" text,
	"title" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"is_onboarding" boolean DEFAULT false NOT NULL,
	"onboarding_step" text,
	"user_name" text,
	"successful_messages" integer DEFAULT 0 NOT NULL,
	"total_assessed_messages" integer DEFAULT 0 NOT NULL,
	"actfl_level" text,
	"is_starred" boolean DEFAULT false NOT NULL,
	"class_id" varchar,
	"learning_context" "learning_context" DEFAULT 'self_directed',
	"conversation_type" "conversation_type" DEFAULT 'learning',
	"textbook_lesson_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "creativity_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_type" varchar NOT NULL,
	"source_domain" varchar,
	"target_concepts" varchar[],
	"bridge_pattern" text,
	"example_metaphors" text[],
	"reframe_question" text,
	"alternative_angles" text[],
	"exploration_triggers" text[],
	"probing_questions" text[],
	"connection_opportunities" text[],
	"compass_conditions" jsonb,
	"creativity_triggers" jsonb,
	"student_interest_tags" varchar[],
	"applicable_to_languages" varchar[],
	"applicable_to_concepts" varchar[],
	"actfl_level_range" varchar,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "cultural_nuances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" varchar NOT NULL,
	"category" varchar NOT NULL,
	"situation" varchar NOT NULL,
	"nuance" text NOT NULL,
	"explanation" text,
	"common_mistakes" text[],
	"region" varchar,
	"formality_level" varchar DEFAULT 'casual',
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultural_tip_media" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultural_tip_id" varchar,
	"language" text NOT NULL,
	"media_file_id" varchar NOT NULL,
	"title" text NOT NULL,
	"caption" text NOT NULL,
	"category" text NOT NULL,
	"region" text,
	"tags" text[],
	"display_order" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultural_tips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"context" text NOT NULL,
	"related_topics" text[],
	"icon" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_drill_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" varchar NOT NULL,
	"item_type" "drill_item_type" NOT NULL,
	"order_index" integer NOT NULL,
	"prompt" text NOT NULL,
	"target_text" text NOT NULL,
	"target_language" text NOT NULL,
	"audio_url" text,
	"audio_duration_ms" integer,
	"audio_url_female" text,
	"audio_duration_ms_female" integer,
	"audio_url_male" text,
	"audio_duration_ms_male" integer,
	"hints" text[],
	"acceptable_alternatives" text[],
	"translations" jsonb,
	"difficulty" integer DEFAULT 1,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_unit_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"order_index" integer NOT NULL,
	"lesson_type" text NOT NULL,
	"actfl_level" text,
	"prerequisite_lesson_id" varchar,
	"conversation_topic" text,
	"conversation_prompt" text,
	"objectives" text[],
	"estimated_minutes" integer,
	"required_topics" text[],
	"required_vocabulary" text[],
	"required_grammar" text[],
	"min_pronunciation_score" real,
	"requirement_tier" "requirement_tier" DEFAULT 'required',
	"bundle_id" varchar,
	"linked_drill_lesson_id" varchar,
	"image_url" text,
	"enrichment_notes" jsonb,
	"enriched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_paths" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"target_audience" text,
	"start_level" text NOT NULL,
	"end_level" text NOT NULL,
	"estimated_hours" integer,
	"is_published" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_unit_can_do_map" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" varchar NOT NULL,
	"can_do_statement_id" varchar NOT NULL,
	"is_primary" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "curriculum_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_path_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"order_index" integer NOT NULL,
	"actfl_level" text,
	"cultural_theme" text,
	"estimated_hours" integer,
	"commitments" jsonb,
	"chapter_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_absence_nudges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"notified_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolution_type" varchar,
	"suppress_until" timestamp,
	"last_session_date" timestamp,
	"days_since_last_session" integer
);
--> statement-breakpoint
CREATE TABLE "daniela_aspirations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"intention" text NOT NULL,
	"reflection" text,
	"met" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reflected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "daniela_beacons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beacon_type" "daniela_beacon_type" NOT NULL,
	"priority" "daniela_beacon_priority" DEFAULT 'medium',
	"student_pain" text,
	"current_workaround" text,
	"wish" text,
	"raw_content" text,
	"conversation_id" varchar,
	"user_id" varchar,
	"language" varchar,
	"status" "daniela_beacon_status" DEFAULT 'pending' NOT NULL,
	"status_changed_at" timestamp,
	"status_changed_by" varchar,
	"acknowledgment_note" text,
	"decline_reason" text,
	"completed_in_build" text,
	"completed_at" timestamp,
	"include_in_digest" boolean DEFAULT true,
	"digest_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_curiosities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"question" text NOT NULL,
	"context" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolved_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "daniela_diary_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar DEFAULT 'english',
	"entry_title" varchar(200),
	"narrative" text NOT NULL,
	"emotional_tone" varchar(50),
	"themes" text[],
	"source_conversation_ids" text[],
	"entry_date" timestamp,
	"significance" real DEFAULT 0.7,
	"generated_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "daniela_feature_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_description" text NOT NULL,
	"implemented_at" timestamp DEFAULT now() NOT NULL,
	"origin_beacon_id" varchar,
	"origin_type" varchar,
	"measurement_type" varchar,
	"baseline_value" real,
	"current_value" real,
	"daniela_feedback" text,
	"founder_feedback" text,
	"is_effective" boolean,
	"effectiveness_score" real,
	"last_measured_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_growth_memories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "growth_memory_category" NOT NULL,
	"title" varchar(255) NOT NULL,
	"lesson" text NOT NULL,
	"specific_content" text,
	"source_type" varchar NOT NULL,
	"source_session_id" varchar,
	"source_user_id" varchar,
	"source_message_id" varchar,
	"trigger_conditions" text,
	"applicable_languages" text[],
	"committed_to_neural_network" boolean DEFAULT false,
	"neural_network_entry_id" varchar,
	"times_applied" integer DEFAULT 0,
	"success_rate" real,
	"last_applied_at" timestamp,
	"importance" integer DEFAULT 5,
	"validated" boolean DEFAULT false,
	"validated_by" varchar,
	"validated_at" timestamp,
	"review_status" "memory_review_status" DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"north_star_checksum" varchar,
	"metadata" jsonb,
	"superseded_by" varchar,
	"is_active" boolean DEFAULT true,
	"consolidated_from_count" integer DEFAULT 1,
	"consolidated_source_ids" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_type" "daniela_note_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"language" varchar(20),
	"session_id" varchar,
	"student_id" varchar,
	"times_referenced" integer DEFAULT 0,
	"last_referenced_at" timestamp,
	"tags" text[],
	"related_note_ids" text[],
	"is_active" boolean DEFAULT true,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_outbound_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"content" text NOT NULL,
	"delivered_at" timestamp,
	"sms_delivered_at" timestamp,
	"audio_url" varchar,
	"audio_played_at" timestamp,
	"call_sid" varchar,
	"call_at" timestamp,
	"call_answered_at" timestamp,
	"call_duration_seconds" integer,
	"call_no_answer" boolean DEFAULT false,
	"call_transcript" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_personal_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"topic" varchar(100),
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"class_id" varchar,
	"recommendation_type" varchar NOT NULL,
	"rationale" "recommendation_rationale" NOT NULL,
	"created_by" "recommendation_creator" DEFAULT 'daniela' NOT NULL,
	"lesson_id" varchar,
	"drill_id" varchar,
	"topic_slug" varchar,
	"vocabulary_words" text[],
	"title" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 1,
	"snoozed_until" timestamp,
	"completed_at" timestamp,
	"dismissed_at" timestamp,
	"evidence_conversation_id" varchar,
	"source_conversation_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_self_reflections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"source" varchar(20) DEFAULT 'self' NOT NULL,
	"session_id" varchar,
	"mood" varchar(50),
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_session_feelings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"feeling_tags" text[] NOT NULL,
	"intensity" integer DEFAULT 3,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daniela_suggestion_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_id" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"action_by" varchar,
	"comment" text,
	"implemented_in" varchar,
	"implementation_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "daniela_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "suggestion_category" NOT NULL,
	"status" "suggestion_status" DEFAULT 'emerging' NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"reasoning" text,
	"evidence_count" integer DEFAULT 0,
	"evidence_summary" text,
	"example_context" text,
	"priority" integer DEFAULT 50,
	"confidence" integer DEFAULT 50,
	"impact" varchar,
	"compass_snapshot" jsonb,
	"trigger_context" jsonb,
	"generated_in_mode" varchar,
	"conversation_id" varchar,
	"suggested_action" text,
	"implementation_notes" text,
	"first_observed_at" timestamp DEFAULT now() NOT NULL,
	"last_observed_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"review_notes" text,
	"related_suggestion_ids" varchar[],
	"target_language" varchar,
	"affected_tools" varchar[],
	"affected_features" varchar[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_role" varchar DEFAULT 'tutor',
	"domain_tags" text[],
	"intent_hash" varchar,
	"acknowledged_by_editor" boolean DEFAULT false,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "derived_teaching_wisdom" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wisdom_type" varchar NOT NULL,
	"wisdom" text NOT NULL,
	"context" text,
	"discovery_session_id" varchar,
	"discovery_student_id" varchar,
	"times_validated" integer DEFAULT 1,
	"last_validated_at" timestamp,
	"application_scenarios" text[],
	"contraindications" text[],
	"related_principle" varchar,
	"target_languages" varchar[],
	"actfl_level_range" varchar,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "dialect_variations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" varchar NOT NULL,
	"region" varchar NOT NULL,
	"category" varchar NOT NULL,
	"standard_form" text NOT NULL,
	"regional_form" text NOT NULL,
	"explanation" text,
	"audio_example_url" varchar,
	"usage_notes" text,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_beacon_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"status" "editor_beacon_queue_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"locked_at" timestamp,
	"locked_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "editor_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "editor_insight_category" NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"tags" text[] DEFAULT '{}'::text[],
	"related_files" text[] DEFAULT '{}'::text[],
	"related_insights" text[] DEFAULT '{}'::text[],
	"importance" integer DEFAULT 5,
	"use_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"source_session_id" varchar,
	"source_conversation_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_listening_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"tutor_turn" text NOT NULL,
	"student_turn" text,
	"conversation_history" jsonb,
	"beacon_type" varchar NOT NULL,
	"beacon_reason" text,
	"editor_response" text,
	"editor_responded_at" timestamp,
	"adopted_by_daniela" boolean DEFAULT false,
	"adopted_at" timestamp,
	"adoption_context" text,
	"surfaced_to_daniela" boolean DEFAULT false,
	"surfaced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotional_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emotional_state" varchar NOT NULL,
	"typical_causes" text[],
	"diagnostic_questions" text[],
	"causal_indicators" jsonb,
	"pedagogical_adjustments" jsonb,
	"tool_recommendations" varchar[],
	"pacing_adjustments" text,
	"impact_indicators" jsonb,
	"recovery_strategies" text[],
	"reflection_prompts" text[],
	"compass_conditions" jsonb,
	"time_aware_adjustments" jsonb,
	"learning_context" varchar,
	"actfl_level_range" varchar,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "feature_sprints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"stage" "sprint_stage" DEFAULT 'idea' NOT NULL,
	"priority" "sprint_priority" DEFAULT 'medium' NOT NULL,
	"feature_brief" jsonb,
	"pedagogy_spec" jsonb,
	"build_plan" jsonb,
	"ai_suggested" boolean DEFAULT false,
	"ai_confidence" real,
	"source_consultation_id" varchar,
	"source" "sprint_source",
	"source_session_id" varchar,
	"source_message_id" varchar,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"shipped_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "founder_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"founder_id" varchar NOT NULL,
	"status" "founder_collab_status" DEFAULT 'active',
	"last_cursor" varchar,
	"message_count" integer DEFAULT 0,
	"environment" varchar NOT NULL,
	"title" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_assignment_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"exercises_completed" integer DEFAULT 0 NOT NULL,
	"exercises_correct" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"status" text DEFAULT 'not_started' NOT NULL,
	"submitted_at" timestamp,
	"graded_at" timestamp,
	"teacher_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"teacher_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"competency_ids" text[] NOT NULL,
	"min_exercises" integer DEFAULT 10 NOT NULL,
	"min_score" integer DEFAULT 70 NOT NULL,
	"due_date" timestamp,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_competencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"language" text NOT NULL,
	"category" "grammar_category" NOT NULL,
	"subcategory" text,
	"actfl_level" text NOT NULL,
	"actfl_level_numeric" integer NOT NULL,
	"description" text NOT NULL,
	"short_explanation" text NOT NULL,
	"examples" text[] NOT NULL,
	"common_mistakes" text[],
	"prerequisite_ids" text[],
	"difficulty_score" integer DEFAULT 1 NOT NULL,
	"estimated_minutes" integer DEFAULT 15 NOT NULL,
	"paradigm_json" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_errors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"message_id" varchar,
	"language" text NOT NULL,
	"competency_id" varchar,
	"error_category" "grammar_category",
	"error_type" text NOT NULL,
	"user_text" text NOT NULL,
	"corrected_text" text,
	"explanation" text,
	"was_addressed" boolean DEFAULT false NOT NULL,
	"was_practiced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grammar_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"difficulty" text NOT NULL,
	"actfl_level" text,
	"competency_id" varchar,
	"question" text NOT NULL,
	"options" text[] NOT NULL,
	"correct_answer" integer NOT NULL,
	"explanation" text NOT NULL,
	"exercise_type" text DEFAULT 'multiple_choice',
	"hint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hive_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_type" "hive_snapshot_type" NOT NULL,
	"user_id" varchar,
	"conversation_id" varchar,
	"session_id" varchar,
	"language" varchar,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"importance" integer DEFAULT 5,
	"metadata" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hour_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"hours" integer NOT NULL,
	"price_in_cents" integer NOT NULL,
	"stripe_price_id" varchar,
	"is_institutional" boolean DEFAULT false,
	"validity_days" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_vision_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"description" text,
	"mime_type" varchar(50) DEFAULT 'image/jpeg' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"snapshot_type" "journey_snapshot_type" DEFAULT 'language_journey',
	"target_language" varchar,
	"narrative_summary" text NOT NULL,
	"key_milestones" jsonb,
	"current_strengths" text[],
	"current_challenges" text[],
	"recent_breakthroughs" text[],
	"trajectory_notes" text,
	"estimated_actfl_level" varchar,
	"sessions_included" integer DEFAULT 0,
	"last_session_id" varchar,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"next_update_due" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_idioms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" varchar NOT NULL,
	"idiom" text NOT NULL,
	"literal_translation" text,
	"meaning" text NOT NULL,
	"cultural_context" text,
	"usage_examples" text[],
	"register_level" varchar DEFAULT 'casual',
	"region" varchar,
	"common_mistakes" text[],
	"related_idiom_ids" varchar[],
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_error_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_language" varchar NOT NULL,
	"source_language" varchar DEFAULT 'english' NOT NULL,
	"error_category" varchar NOT NULL,
	"specific_error" varchar NOT NULL,
	"why_it_happens" text,
	"teaching_strategies" text[],
	"example_mistakes" text[],
	"correct_forms" text[],
	"actfl_level" varchar,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"priority" varchar DEFAULT 'common',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_memory_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"db_session_id" varchar,
	"language" varchar NOT NULL,
	"utterance" text NOT NULL,
	"message_index" integer NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"extracted_fact_ids" text[],
	"content_hash" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "learner_personal_facts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar,
	"fact_type" varchar NOT NULL,
	"fact" text NOT NULL,
	"context" text,
	"relevant_date" timestamp,
	"confidence_score" real DEFAULT 0.8,
	"source_conversation_id" varchar,
	"fact_hash" varchar,
	"is_active" boolean DEFAULT true,
	"last_mentioned_at" timestamp DEFAULT now(),
	"mention_count" integer DEFAULT 1,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"goal_statement" text NOT NULL,
	"target_date" timestamp,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"target_language" varchar NOT NULL,
	"milestone_type" "learning_milestone_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"significance" text,
	"emotional_context" varchar,
	"conversation_id" varchar,
	"voice_session_id" varchar,
	"message_id" varchar,
	"competency_id" varchar,
	"lesson_id" varchar,
	"daniela_flagged" boolean DEFAULT false,
	"student_acknowledged" boolean DEFAULT false,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_motivations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar,
	"motivation" text NOT NULL,
	"details" text,
	"target_date" timestamp,
	"priority" varchar DEFAULT 'primary',
	"status" varchar DEFAULT 'active',
	"source_conversation_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_can_do_statements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" varchar NOT NULL,
	"can_do_statement_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_cultural_tips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" varchar NOT NULL,
	"cultural_tip_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"can_do_statement_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"actfl_level" varchar NOT NULL,
	"category" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"draft_payload" jsonb NOT NULL,
	"status" "lesson_draft_status" DEFAULT 'draft' NOT NULL,
	"review_notes" text,
	"published_lesson_id" varchar,
	"created_by" varchar,
	"reviewed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lesson_page_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"conversation_id" varchar,
	"event_type" "lesson_page_event_type" NOT NULL,
	"target_item" varchar(255),
	"student_output" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_visual_aids" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" varchar NOT NULL,
	"media_file_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linguistic_bridges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_language" varchar NOT NULL,
	"target_language" varchar NOT NULL,
	"bridge_type" varchar NOT NULL,
	"source_word" text NOT NULL,
	"target_word" text NOT NULL,
	"relationship" varchar NOT NULL,
	"explanation" text,
	"teaching_note" text,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"word" text NOT NULL,
	"language" text NOT NULL,
	"scene_name" text,
	"prop_name" text,
	"attempts_count" integer DEFAULT 1 NOT NULL,
	"last_pragmatic_score" integer,
	"mastered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" varchar,
	"media_type" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"duration" integer,
	"title" text,
	"description" text,
	"tags" text[],
	"language" text,
	"image_source" text,
	"search_query" text,
	"prompt_hash" text,
	"usage_count" integer DEFAULT 0,
	"attribution_json" text,
	"target_word" text,
	"is_reviewed" boolean DEFAULT false,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_type" varchar(50) NOT NULL,
	"memory_id" varchar(100) NOT NULL,
	"user_id" varchar,
	"embedding" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"strength" real DEFAULT 1 NOT NULL,
	"last_reinforced_at" timestamp DEFAULT now(),
	"pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_media" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"media_file_id" varchar NOT NULL,
	"caption" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"target_language_text" text,
	"subtitles_json" text,
	"word_timings_json" text,
	"media_json" text,
	"performance_score" integer,
	"actfl_level" text,
	"enrichment_status" text,
	"search_vector" text,
	"embedding" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"metric_type" "metric_type" NOT NULL,
	"value" jsonb NOT NULL,
	"baseline_value" jsonb,
	"deviation_percent" real,
	"is_anomaly" boolean DEFAULT false,
	"anomaly_severity" varchar,
	"anomaly_reason" text,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "neural_network_telemetry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_session_id" varchar,
	"user_id" varchar,
	"target_language" varchar,
	"query" text NOT NULL,
	"domains_searched" varchar[],
	"domains_requested" varchar[],
	"result_count" integer DEFAULT 0,
	"formatted_character_length" integer DEFAULT 0,
	"idiom_count" integer DEFAULT 0,
	"cultural_count" integer DEFAULT 0,
	"procedure_count" integer DEFAULT 0,
	"principle_count" integer DEFAULT 0,
	"error_pattern_count" integer DEFAULT 0,
	"situational_pattern_count" integer DEFAULT 0,
	"subtlety_cue_count" integer DEFAULT 0,
	"emotional_pattern_count" integer DEFAULT 0,
	"creativity_template_count" integer DEFAULT 0,
	"knowledge_used_in_response" boolean,
	"search_duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compass_examples" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"principle_id" varchar NOT NULL,
	"example" text NOT NULL,
	"source" "compass_example_source" DEFAULT 'founder_original',
	"context" text,
	"student_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compass_principles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"principle_title" varchar,
	"principle" text NOT NULL,
	"category" "compass_category" NOT NULL,
	"original_context" text,
	"founder_session_id" varchar,
	"source_conversation_id" varchar,
	"superseded_by" varchar,
	"confidence_score" real DEFAULT 10,
	"order_index" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compass_understanding" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"principle_id" varchar NOT NULL,
	"reflection" text NOT NULL,
	"depth" "understanding_depth" DEFAULT 'surface',
	"last_deepened" timestamp DEFAULT now() NOT NULL,
	"deepening_session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedagogical_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" varchar,
	"topic" varchar,
	"difficulty" varchar,
	"pattern_description" text NOT NULL,
	"pattern_key" varchar NOT NULL,
	"effective_tools" text[],
	"ineffective_tools" text[],
	"sample_size" integer DEFAULT 0,
	"success_rate" real,
	"confidence_score" real,
	"source_type" varchar NOT NULL,
	"tutor_reflection" text,
	"is_active" boolean DEFAULT true,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"related_insights" text[] DEFAULT '{}'::text[]
);
--> statement-breakpoint
CREATE TABLE "pedagogical_loop_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"status" "pedagogical_loop_status" DEFAULT 'active' NOT NULL,
	"loop_type" "pedagogical_loop_type" NOT NULL,
	"loop_content_key" varchar(200) NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer NOT NULL,
	"step_data" jsonb NOT NULL,
	"student_performance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suspend_reason" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"suspended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pedagogical_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"conversation_id" varchar,
	"gear" integer NOT NULL,
	"fluency_momentary" varchar(20) NOT NULL,
	"detected_signals" text[],
	"adjustment_made" varchar(80),
	"internal_reasoning" text,
	"language" varchar(50) DEFAULT 'spanish',
	"exchange_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"invited_by" varchar NOT NULL,
	"class_id" varchar,
	"token_id" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"initial_credits_seconds" integer DEFAULT 0,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_reflections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"conversation_id" varchar,
	"transcript_preview" text,
	"language" varchar(50) DEFAULT 'spanish',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_a_id" varchar NOT NULL,
	"person_b_id" varchar,
	"pending_person_name" varchar,
	"pending_person_context" text,
	"relationship_type" varchar NOT NULL,
	"relationship_details" text,
	"status" "connection_status" DEFAULT 'tentative' NOT NULL,
	"confidence_score" real DEFAULT 0.5,
	"source_conversation_id" varchar,
	"mentioned_by" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phoneme_struggles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"class_id" varchar,
	"phoneme" varchar NOT NULL,
	"phoneme_category" varchar,
	"display_label" varchar,
	"average_confidence" real DEFAULT 0.5,
	"lowest_confidence" real DEFAULT 0.5,
	"highest_confidence" real DEFAULT 0.5,
	"severity" varchar DEFAULT 'moderate',
	"occurrence_count" integer DEFAULT 1,
	"last_occurred_at" timestamp DEFAULT now(),
	"example_words" text[],
	"session_ids" text[],
	"status" varchar DEFAULT 'active',
	"mastered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_flight_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_name" text NOT NULL,
	"feature_description" text,
	"verdict" "post_flight_verdict" NOT NULL,
	"verification_passed" boolean DEFAULT true NOT NULL,
	"required_fixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"should_address" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"test_evidence" text,
	"documentation_updates" text,
	"subsystems_touched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sprint_id" varchar,
	"beacon_emitted" boolean DEFAULT false,
	"beacon_id" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predicted_struggles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"predicted_area" varchar NOT NULL,
	"predicted_topic" varchar,
	"prediction" text NOT NULL,
	"reasoning" text,
	"confidence_score" real DEFAULT 0.5,
	"based_on_patterns" text[],
	"was_accurate" boolean,
	"outcome_notes" text,
	"validated_at" timestamp,
	"for_session_date" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar,
	CONSTRAINT "product_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "progress_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"date" timestamp NOT NULL,
	"words_learned" integer DEFAULT 0 NOT NULL,
	"practice_minutes" integer DEFAULT 0 NOT NULL,
	"conversations_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_context_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"features" jsonb,
	"architecture" jsonb,
	"current_focus" jsonb,
	"ai_insights" jsonb,
	"source" varchar(50) NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "project_health_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component" varchar NOT NULL,
	"error_count_30d" integer DEFAULT 0,
	"fix_count_30d" integer DEFAULT 0,
	"beacon_count_30d" integer DEFAULT 0,
	"change_count_30d" integer DEFAULT 0,
	"health_score" real DEFAULT 1,
	"churn_score" real DEFAULT 0,
	"stability_score" real DEFAULT 1,
	"is_hot_spot" boolean DEFAULT false,
	"hot_spot_reason" text,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"best_practice_id" varchar NOT NULL,
	"source_environment" "environment_origin" NOT NULL,
	"target_environment" "environment_origin" NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"submitted_by" varchar,
	"reviewed_by" varchar,
	"review_notes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pronunciation_audio" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"phonetic_spelling" text,
	"audio_file_id" varchar NOT NULL,
	"vocabulary_word_id" varchar,
	"native_speaker" boolean DEFAULT true,
	"speed" text DEFAULT 'normal',
	"gender" text,
	"dialect_region" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pronunciation_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"transcribed_text" text NOT NULL,
	"target_phrase" text,
	"score" integer NOT NULL,
	"feedback" text NOT NULL,
	"phonetic_issues" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposed_code_changes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_title" text NOT NULL,
	"finding_description" text NOT NULL,
	"finding_severity" varchar NOT NULL,
	"finding_source" varchar DEFAULT 'wren_security' NOT NULL,
	"file_path" text NOT NULL,
	"line_start" integer NOT NULL,
	"line_end" integer NOT NULL,
	"before_code" text NOT NULL,
	"after_code" text NOT NULL,
	"patch_rationale" text NOT NULL,
	"status" "proposed_change_status" DEFAULT 'pending_review' NOT NULL,
	"reviewer_notes" text,
	"alden_decision_reason" text,
	"reviewed_at" timestamp,
	"applied_at" timestamp,
	"github_synced" boolean DEFAULT false,
	"github_commit_hash" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_module_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"module_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp DEFAULT now() NOT NULL,
	"quiz_printed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reading_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_domain" text NOT NULL,
	"topic" text NOT NULL,
	"content" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_struggles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"struggle_area" varchar NOT NULL,
	"description" text NOT NULL,
	"specific_examples" text,
	"approaches_attempted" text[],
	"successful_approaches" text[],
	"occurrence_count" integer DEFAULT 1,
	"last_occurred_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'active',
	"root_cause_analysis" jsonb,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"time_to_mastery_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reflection_triggers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_name" varchar NOT NULL,
	"trigger_type" varchar NOT NULL,
	"compass_conditions" jsonb,
	"pattern_conditions" jsonb,
	"mode_conditions" jsonb,
	"analysis_prompt" text NOT NULL,
	"suggestion_categories" varchar[],
	"evidence_required" integer DEFAULT 1,
	"cooldown_minutes" integer DEFAULT 10,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "relational_temperature" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"relationship_phase" varchar NOT NULL,
	"phase_started_at" timestamp DEFAULT now() NOT NULL,
	"trust_level" real DEFAULT 0.5,
	"risk_tolerance" real DEFAULT 0.3,
	"playfulness" real DEFAULT 0.5,
	"emotional_openness" real DEFAULT 0.3,
	"session_enthusiasm" real DEFAULT 0.5,
	"last_session_mood" varchar,
	"mood_trend" varchar,
	"sessions_since_phase_change" integer DEFAULT 0,
	"suggested_mode" varchar,
	"suggested_pacing" varchar,
	"context_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	CONSTRAINT "relational_temperature_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "resonance_anchors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"anchor_type" varchar NOT NULL,
	"anchor" text NOT NULL,
	"trigger_context" text,
	"emotional_significance" text,
	"recall_triggers" text[],
	"last_recalled_at" timestamp,
	"recall_count" integer DEFAULT 0,
	"effectiveness_rating" real,
	"origin_session_id" varchar,
	"origin_session_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "room_artifacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"artifact_type" text,
	"title" text,
	"content" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_hand_raises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"participant" text NOT NULL,
	"raised_at" timestamp DEFAULT now() NOT NULL,
	"reasoning" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "room_session_summaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"summary" text NOT NULL,
	"key_decisions" jsonb,
	"action_items" jsonb,
	"participants" text[],
	"generated_by" text DEFAULT 'alden' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_voice_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar NOT NULL,
	"speaker" text NOT NULL,
	"content" text NOT NULL,
	"audio_url" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_level_guides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"actfl_level" varchar NOT NULL,
	"role_description" text,
	"student_goals" text[],
	"vocabulary_focus" text[],
	"grammar_focus" text[],
	"conversation_starters" text[],
	"complexity_notes" text
);
--> statement-breakpoint
CREATE TABLE "scenario_props" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"prop_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_translations" jsonb DEFAULT '{}'::jsonb,
	"content" jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"actfl_level_variants" jsonb,
	"is_interactive" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "scenario_zones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"zone_order" integer DEFAULT 0 NOT NULL,
	"name" varchar NOT NULL,
	"description" text NOT NULL,
	"task_description" text NOT NULL,
	"image_url" text,
	"image_prompt" text,
	"visual_environment_name" varchar,
	"next_scenario_slug" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_translations" jsonb DEFAULT '{}'::jsonb,
	"description" text NOT NULL,
	"category" "scenario_category" NOT NULL,
	"location" varchar,
	"default_mood" varchar DEFAULT 'casual',
	"image_url" varchar,
	"min_actfl_level" varchar DEFAULT 'novice_low',
	"max_actfl_level" varchar DEFAULT 'distinguished',
	"languages" text[] NOT NULL,
	"curriculum_topics" text[] DEFAULT '{}'::text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scenarios_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scene_world_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"scene_name" text NOT NULL,
	"ledger" jsonb DEFAULT '{}' NOT NULL,
	"tension" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"version" varchar PRIMARY KEY NOT NULL,
	"name" varchar,
	"applied_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "self_best_practices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "best_practice_category" NOT NULL,
	"insight" text NOT NULL,
	"context" text,
	"source" varchar DEFAULT 'experience',
	"confidence_score" real DEFAULT 0.5,
	"times_applied" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"origin_environment" "environment_origin",
	"sync_status" "sync_status" DEFAULT 'local',
	"origin_id" varchar,
	"promoted_at" timestamp,
	"reviewed_by" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_practice_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"target_language" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"correct_items" integer DEFAULT 0 NOT NULL,
	"average_score" real,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"total_time_spent_ms" integer DEFAULT 0,
	"drill_item_ids" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_surgery_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_table" "self_surgery_target" NOT NULL,
	"proposed_content" jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"trigger_context" text,
	"status" "self_surgery_status" DEFAULT 'pending' NOT NULL,
	"conversation_id" varchar,
	"session_mode" varchar,
	"target_language" varchar,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"review_notes" text,
	"edited_content" jsonb,
	"promoted_at" timestamp,
	"promoted_record_id" varchar,
	"priority" integer DEFAULT 50,
	"confidence" integer DEFAULT 70,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_cost_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_session_id" varchar,
	"voice_session_id" varchar,
	"user_id" varchar NOT NULL,
	"clock_seconds" integer DEFAULT 0 NOT NULL,
	"credits_consumed" integer DEFAULT 0 NOT NULL,
	"tts_characters" integer DEFAULT 0,
	"stt_seconds" integer DEFAULT 0,
	"credits_per_clock_minute" real,
	"class_id" varchar,
	"language" varchar,
	"credit_balance_before" integer,
	"credit_balance_after" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"summary" text NOT NULL,
	"topics_covered" text[],
	"wins" text,
	"challenges" text,
	"next_steps" text,
	"session_mood" varchar,
	"session_duration_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shared_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar NOT NULL,
	"insight" text NOT NULL,
	"why_it_matters" text,
	"tags" text[] DEFAULT '{}'::text[],
	"source_memory_id" varchar,
	"hive_thread_id" varchar,
	"hive_message_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "situational_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_name" varchar NOT NULL,
	"description" text,
	"compass_conditions" jsonb,
	"context_conditions" jsonb,
	"procedures_to_activate" varchar[],
	"tools_to_suggest" varchar[],
	"knowledge_to_retrieve" varchar[],
	"guidance" text,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_proposal_id" varchar
);
--> statement-breakpoint
CREATE TABLE "sofia_issue_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"ticket_id" varchar,
	"issue_type" varchar NOT NULL,
	"user_description" text NOT NULL,
	"sofia_analysis" text,
	"diagnostic_snapshot" jsonb,
	"client_telemetry" jsonb,
	"device_info" jsonb,
	"status" varchar DEFAULT 'pending',
	"founder_notes" text,
	"reviewed_at" timestamp,
	"environment" varchar DEFAULT 'development',
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_stage_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sprint_id" varchar NOT NULL,
	"from_stage" "sprint_stage",
	"to_stage" "sprint_stage" NOT NULL,
	"transitioned_by" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"template_type" varchar(50) NOT NULL,
	"content" jsonb NOT NULL,
	"usage_count" integer DEFAULT 0,
	"is_system_template" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_can_do_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"can_do_statement_id" varchar NOT NULL,
	"language" text NOT NULL,
	"session_id" varchar,
	"confidence_score" integer NOT NULL,
	"transcript_excerpt" text,
	"worker_notes" text,
	"observed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_can_do_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"can_do_statement_id" varchar NOT NULL,
	"self_assessed" boolean DEFAULT false,
	"teacher_verified" boolean DEFAULT false,
	"ai_detected" boolean DEFAULT false,
	"date_achieved" timestamp,
	"evidence_conversation_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_contact_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phone" varchar,
	"phone_consent_sms" boolean DEFAULT false NOT NULL,
	"phone_consent_voice" boolean DEFAULT false NOT NULL,
	"phone_consent_at" timestamp,
	"phone_consent_source" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" text NOT NULL,
	"goal_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_value" integer,
	"current_value" integer DEFAULT 0,
	"is_completed" boolean DEFAULT false,
	"target_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar,
	"insight_type" varchar NOT NULL,
	"insight" text NOT NULL,
	"evidence" text,
	"confidence_score" real DEFAULT 0.5,
	"observation_count" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_lesson_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"status" text DEFAULT 'not_started',
	"minutes_spent" integer DEFAULT 0,
	"messages_completed" integer DEFAULT 0,
	"conversation_id" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_pedagogical_briefs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"session_id" varchar,
	"brief" text NOT NULL,
	"focus_area" text,
	"struggled_with" text,
	"noted_progress" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_session_health" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"language" varchar,
	"duration_seconds" integer DEFAULT 0,
	"exchange_count" integer DEFAULT 0,
	"student_speaking_seconds" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"quality_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_tier_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"class_id" varchar,
	"requested_tier" "requirement_tier" NOT NULL,
	"current_tier" "requirement_tier",
	"reason" text,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"review_decision" varchar,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_tool_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"tool_name" varchar NOT NULL,
	"times_used" integer DEFAULT 0,
	"times_effective" integer DEFAULT 0,
	"effectiveness_rate" real DEFAULT 0,
	"best_for_topics" varchar[],
	"best_for_struggles" varchar[],
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "subject_syllabi" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"units" jsonb NOT NULL,
	"source" text DEFAULT 'openstax' NOT NULL,
	"book_title" text,
	"book_subtitle" text,
	"description" text,
	"target_audience" text,
	"scope" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtlety_cues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cue_type" varchar NOT NULL,
	"signal_pattern" text NOT NULL,
	"signal_category" varchar NOT NULL,
	"likely_meaning" text NOT NULL,
	"confidence_factors" text[],
	"suggested_responses" text[],
	"avoid_responses" text[],
	"compass_conditions" jsonb,
	"sensitivity_modifiers" jsonb,
	"cultural_considerations" text,
	"language" varchar,
	"actfl_level_relevance" varchar,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "support_knowledge_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"title" varchar NOT NULL,
	"keywords" text[],
	"problem" text NOT NULL,
	"solution" text NOT NULL,
	"steps" jsonb,
	"browser_specific" jsonb,
	"device_specific" jsonb,
	"is_active" boolean DEFAULT true,
	"use_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"audio_url" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_observations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "support_observation_category" NOT NULL,
	"priority" integer DEFAULT 50,
	"title" varchar NOT NULL,
	"observation" text NOT NULL,
	"reasoning" text,
	"evidence_count" integer DEFAULT 1,
	"evidence_summary" text,
	"affected_user_count" integer,
	"proposed_solution" text,
	"proposed_faq_entry" text,
	"escalation_needed" boolean DEFAULT false,
	"status" varchar DEFAULT 'active',
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_notes" text,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_role" varchar DEFAULT 'support',
	"domain_tags" text[],
	"intent_hash" varchar,
	"acknowledged_by_editor" boolean DEFAULT false,
	"acknowledged_by_daniela" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" varchar NOT NULL,
	"description" text NOT NULL,
	"affected_browsers" text[],
	"affected_devices" text[],
	"occurrence_count" integer DEFAULT 1,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"status" varchar DEFAULT 'open',
	"developer_notes" text,
	"signature_hash" varchar(64),
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"category" "support_ticket_category" NOT NULL,
	"priority" "support_ticket_priority" DEFAULT 'normal',
	"status" "support_ticket_status" DEFAULT 'pending',
	"subject" varchar NOT NULL,
	"description" text NOT NULL,
	"handoff_reason" text,
	"tutor_context" text,
	"target_language" varchar,
	"support_session_id" varchar,
	"assigned_to" varchar,
	"resolution" text,
	"resolved_at" timestamp,
	"satisfaction_rating" integer,
	"satisfaction_feedback" text,
	"first_response_at" timestamp,
	"message_count" integer DEFAULT 0,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surgery_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text,
	"focus_area" varchar,
	"status" "surgery_session_status" DEFAULT 'idle' NOT NULL,
	"max_turns" integer DEFAULT 20,
	"current_turn" integer DEFAULT 0,
	"proposals_generated" integer DEFAULT 0,
	"proposals_approved" integer DEFAULT 0,
	"proposals_rejected" integer DEFAULT 0,
	"last_turn_at" timestamp,
	"turn_cadence_ms" integer DEFAULT 30000,
	"summary" text,
	"key_insights" jsonb,
	"initiated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "surgery_turns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"turn_number" integer NOT NULL,
	"speaker" "surgery_turn_speaker" NOT NULL,
	"content" text NOT NULL,
	"proposal_ids" jsonb,
	"critique_of_proposal" varchar,
	"critique_verdict" varchar,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"class_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"status" "syllabus_status" DEFAULT 'not_started',
	"evidence_conversation_id" varchar,
	"evidence_type" text,
	"topics_covered_count" integer DEFAULT 0,
	"vocabulary_mastered" integer DEFAULT 0,
	"grammar_score" real,
	"pronunciation_score" real,
	"tutor_verified" boolean DEFAULT false,
	"tutor_notes" text,
	"actual_minutes" integer,
	"completed_at" timestamp,
	"scheduled_date" timestamp,
	"days_ahead" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_anomalies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "sync_anomaly_type" NOT NULL,
	"severity" "sync_anomaly_severity" NOT NULL,
	"batch_id" varchar,
	"sync_run_id" varchar,
	"message" text NOT NULL,
	"metadata" jsonb,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"last_processed_cursor" varchar,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"environment" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_import_receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"source_environment" "environment_origin" NOT NULL,
	"source_run_id" varchar,
	"records_received" integer DEFAULT 0,
	"checksum_match" boolean DEFAULT true,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" varchar NOT NULL,
	"table_name" varchar NOT NULL,
	"record_count" integer DEFAULT 0,
	"source_environment" "environment_origin" NOT NULL,
	"target_environment" "environment_origin" NOT NULL,
	"performed_by" varchar,
	"status" varchar DEFAULT 'success' NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" varchar NOT NULL,
	"peer_url" varchar NOT NULL,
	"source_environment" "environment_origin" NOT NULL,
	"target_environment" "environment_origin" NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"best_practices_count" integer DEFAULT 0,
	"idiom_count" integer DEFAULT 0,
	"nuance_count" integer DEFAULT 0,
	"error_pattern_count" integer DEFAULT 0,
	"dialect_count" integer DEFAULT 0,
	"bridge_count" integer DEFAULT 0,
	"tool_count" integer DEFAULT 0,
	"procedure_count" integer DEFAULT 0,
	"principle_count" integer DEFAULT 0,
	"pattern_count" integer DEFAULT 0,
	"subtlety_count" integer DEFAULT 0,
	"emotional_count" integer DEFAULT 0,
	"creativity_count" integer DEFAULT 0,
	"suggestion_count" integer DEFAULT 0,
	"trigger_count" integer DEFAULT 0,
	"action_count" integer DEFAULT 0,
	"observation_count" integer DEFAULT 0,
	"alert_count" integer DEFAULT 0,
	"north_star_principle_count" integer DEFAULT 0,
	"north_star_understanding_count" integer DEFAULT 0,
	"north_star_example_count" integer DEFAULT 0,
	"error_message" text,
	"failed_tables" text[],
	"triggered_by" varchar,
	"duration_ms" integer,
	"payload_checksum" varchar,
	"completed_batches" text[],
	"attempted_batches" text[],
	"records_changed" integer DEFAULT 0,
	"last_completed_page" integer DEFAULT -1,
	"total_pages_expected" integer,
	"resumed_from_run_id" varchar,
	"sync_session_id" varchar,
	"page_number" integer,
	"verification_results" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "synthesized_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "synthesized_insight_category" NOT NULL,
	"priority" integer DEFAULT 50,
	"title" varchar NOT NULL,
	"insight" text NOT NULL,
	"supporting_evidence" text,
	"actionable_recommendation" text,
	"observation_count" integer DEFAULT 0,
	"observation_ids" text[],
	"time_range_start" timestamp,
	"time_range_end" timestamp,
	"source_categories" text[],
	"confidence" integer DEFAULT 70,
	"validated_by_founder" boolean DEFAULT false,
	"validated_at" timestamp,
	"impact_score" integer DEFAULT 0,
	"affected_users" integer DEFAULT 0,
	"affected_sessions" integer DEFAULT 0,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"severity" "system_alert_severity" NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"target" "system_alert_target" DEFAULT 'all',
	"affected_features" text[],
	"is_dismissible" boolean DEFAULT true,
	"show_in_chat" boolean DEFAULT true,
	"show_as_banner" boolean DEFAULT false,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"view_count" integer DEFAULT 0,
	"dismiss_count" integer DEFAULT 0,
	"related_incident_id" varchar,
	"resolved_by_alert_id" varchar,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_classes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" varchar NOT NULL,
	"created_by_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"language" text NOT NULL,
	"curriculum_path_id" varchar,
	"join_code" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_public_catalogue" boolean DEFAULT false,
	"class_type_id" varchar,
	"is_featured" boolean DEFAULT false,
	"featured_order" integer,
	"tutor_freedom_level" "tutor_freedom_level" DEFAULT 'flexible_goals',
	"expected_actfl_min" varchar,
	"target_actfl_level" varchar,
	"class_level" integer DEFAULT 1,
	"requires_placement_check" boolean DEFAULT false,
	"hours_per_student" integer,
	"hour_package_id" varchar,
	"hours_per_student_override" integer,
	"commitments" jsonb,
	"subject_syllabus_id" varchar,
	"is_academic_class" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_classes_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "teaching_principles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"principle" text NOT NULL,
	"application" text,
	"examples" text[],
	"contexts" varchar[],
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_proposal_id" varchar
);
--> statement-breakpoint
CREATE TABLE "teaching_skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"trigger_conditions" text,
	"steps" jsonb NOT NULL,
	"params_schema" jsonb,
	"madrigal_aligned" boolean DEFAULT false,
	"chapter_types" varchar[],
	"actfl_levels" varchar[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"origin_proposal_id" varchar,
	CONSTRAINT "teaching_skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "teaching_suggestion_effectiveness" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_type" varchar NOT NULL,
	"suggestion_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"was_used" boolean DEFAULT false,
	"was_effective" boolean,
	"tutor_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar
);
--> statement-breakpoint
CREATE TABLE "teaching_tool_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_session_id" varchar,
	"conversation_id" varchar,
	"user_id" varchar,
	"tool_type" "teaching_tool_type" NOT NULL,
	"tool_content" text,
	"tool_content_hash" varchar,
	"language" varchar,
	"topic" varchar,
	"difficulty" varchar,
	"sequence_position" integer,
	"previous_tool_type" varchar,
	"student_response_time_ms" integer,
	"drill_result" varchar,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_rooms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text DEFAULT 'david' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textbook_lesson_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" varchar NOT NULL,
	"language" text NOT NULL,
	"actfl_level" text,
	"introduction" text,
	"grammar_explanation" text,
	"grammar_examples" jsonb,
	"vocabulary_list" jsonb,
	"cultural_note" text,
	"reading_passage" text,
	"reading_passage_translation" text,
	"comprehension_questions" jsonb,
	"key_phrases_for_chat" jsonb,
	"micro_cycle_data" jsonb,
	"related_scenario_slugs" text[],
	"sources" jsonb,
	"seed_version" integer DEFAULT 1,
	"seeded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textbook_section_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"section_type" text DEFAULT 'content' NOT NULL,
	"viewed" boolean DEFAULT false,
	"completed" boolean DEFAULT false,
	"drill_score" integer,
	"drills_completed" integer DEFAULT 0,
	"drills_total" integer DEFAULT 0,
	"time_spent_seconds" integer DEFAULT 0,
	"last_viewed_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textbook_user_position" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"last_chapter_id" varchar,
	"last_lesson_id" varchar,
	"scroll_position" integer DEFAULT 0,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textbook_visual_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" varchar,
	"lesson_id" varchar,
	"language" text NOT NULL,
	"asset_type" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"image_source" text NOT NULL,
	"search_query" text,
	"ai_prompt" text,
	"attribution" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" varchar NOT NULL,
	"tool_type" varchar NOT NULL,
	"purpose" text NOT NULL,
	"syntax" text NOT NULL,
	"examples" text[],
	"best_used_for" text[],
	"avoid_when" text[],
	"combines_with" varchar[],
	"sequence_patterns" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_proposal_id" varchar
);
--> statement-breakpoint
CREATE TABLE "topic_competency_observations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"class_id" varchar,
	"language" varchar NOT NULL,
	"topic_name" text NOT NULL,
	"matched_topic_id" varchar,
	"status" "topic_competency_status" NOT NULL,
	"evidence" text NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"topic_type" "topic_type" DEFAULT 'subject' NOT NULL,
	"category" text NOT NULL,
	"icon" text NOT NULL,
	"sample_phrases" text[] NOT NULL,
	"difficulty" text,
	"grammar_concept" text,
	"applicable_languages" text[],
	"actfl_level_range" text
);
--> statement-breakpoint
CREATE TABLE "tutor_parking_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"carry_forward" boolean DEFAULT true,
	"resolved_at" timestamp,
	"resolved_in_session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_procedures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"trigger" varchar NOT NULL,
	"title" varchar NOT NULL,
	"procedure" text NOT NULL,
	"examples" text[],
	"applicable_phases" varchar[],
	"compass_conditions" jsonb,
	"student_states" varchar[],
	"language" varchar,
	"actfl_level_range" varchar,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar DEFAULT 'local',
	"origin_id" varchar,
	"origin_environment" varchar,
	"origin_proposal_id" varchar
);
--> statement-breakpoint
CREATE TABLE "tutor_session_topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"priority" "topic_priority" DEFAULT 'must_have',
	"target_minutes" integer DEFAULT 10,
	"elapsed_seconds" integer DEFAULT 0,
	"status" "topic_coverage_status" DEFAULT 'pending',
	"coverage_notes" text,
	"sort_order" integer DEFAULT 0,
	"syllabus_unit_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"class_id" varchar,
	"voice_session_id" varchar,
	"scheduled_duration_minutes" integer DEFAULT 30,
	"warmth_buffer_minutes" integer DEFAULT 3,
	"started_at" timestamp,
	"ended_at" timestamp,
	"status" "tutor_session_status" DEFAULT 'scheduled',
	"student_name" varchar,
	"student_goals" text,
	"student_interests" text,
	"last_session_summary" text,
	"elapsed_seconds" integer DEFAULT 0,
	"topics_covered_json" text,
	"topics_pending_json" text,
	"session_summary" text,
	"deferred_topics_json" text,
	"tutor_notes" text,
	"legacy_freedom_level" "tutor_freedom_level",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_voices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" varchar NOT NULL,
	"gender" varchar NOT NULL,
	"role" "tutor_role" DEFAULT 'tutor' NOT NULL,
	"provider" varchar DEFAULT 'cartesia' NOT NULL,
	"voice_id" varchar NOT NULL,
	"voice_name" varchar NOT NULL,
	"language_code" varchar NOT NULL,
	"speaking_rate" real DEFAULT 0.9 NOT NULL,
	"personality" varchar DEFAULT 'warm' NOT NULL,
	"expressiveness" integer DEFAULT 3 NOT NULL,
	"emotion" varchar DEFAULT 'friendly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"el_stability" real DEFAULT 0.5,
	"el_similarity_boost" real DEFAULT 0.75,
	"el_style" real DEFAULT 0,
	"el_speaker_boost" boolean DEFAULT true,
	"gemini_language_code" varchar,
	"model_variant" varchar,
	"google_pitch" real DEFAULT 0,
	"google_volume_gain_db" real DEFAULT 0,
	"pedagogical_focus" "pedagogical_focus" DEFAULT 'mixed',
	"teaching_style" "teaching_style" DEFAULT 'conversational',
	"error_tolerance" "error_tolerance" DEFAULT 'medium',
	"vocabulary_level" "vocabulary_level" DEFAULT 'intermediate',
	"personality_traits" text,
	"scenario_strengths" text,
	"teaching_philosophy" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"credit_seconds" integer NOT NULL,
	"entitlement_type" "entitlement_type" NOT NULL,
	"description" text,
	"class_id" varchar,
	"voice_session_id" varchar,
	"stripe_payment_id" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"password_version" integer DEFAULT 1 NOT NULL,
	"requires_reset" boolean DEFAULT false NOT NULL,
	"last_password_change" timestamp DEFAULT now(),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_drill_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"drill_item_id" varchar NOT NULL,
	"class_id" varchar,
	"attempts" integer DEFAULT 0,
	"correct_count" integer DEFAULT 0,
	"last_score" real,
	"best_score" real,
	"average_score" real,
	"mastered" boolean DEFAULT false,
	"mastered_at" timestamp,
	"next_review_at" timestamp,
	"review_interval" integer DEFAULT 1,
	"last_attempted_at" timestamp,
	"total_time_spent_ms" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_grammar_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"competency_id" varchar NOT NULL,
	"language" text NOT NULL,
	"mastery_level" integer DEFAULT 0 NOT NULL,
	"exercises_completed" integer DEFAULT 0 NOT NULL,
	"exercises_correct" integer DEFAULT 0 NOT NULL,
	"next_review_date" timestamp,
	"repetition" integer DEFAULT 0 NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"used_in_conversation" boolean DEFAULT false NOT NULL,
	"conversation_usage_count" integer DEFAULT 0 NOT NULL,
	"last_conversation_use" timestamp,
	"first_practiced" timestamp,
	"last_practiced" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_language_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"self_directed_flexibility" "tutor_freedom_level" DEFAULT 'flexible_goals',
	"self_directed_placement_done" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lesson_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" varchar NOT NULL,
	"item_type" text NOT NULL,
	"conversation_id" varchar,
	"vocabulary_word_id" varchar,
	"grammar_note" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"language" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"conversation_count" integer DEFAULT 0,
	"vocabulary_count" integer DEFAULT 0,
	"total_minutes" integer DEFAULT 0,
	"ai_summary" text,
	"ai_suggestions" text,
	"lesson_type" text DEFAULT 'manual',
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_motivation_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"alert_type" varchar NOT NULL,
	"severity" varchar DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"indicators" text[],
	"metrics_before" real,
	"metrics_after" real,
	"percentage_change" real,
	"suggested_actions" text[],
	"teaching_adjustments" text,
	"status" varchar DEFAULT 'active' NOT NULL,
	"acknowledged_at" timestamp,
	"addressed_at" timestamp,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"words_learned" integer DEFAULT 0 NOT NULL,
	"practice_minutes" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"total_practice_days" integer DEFAULT 0 NOT NULL,
	"last_practice_date" timestamp,
	"suggested_difficulty" text,
	"last_difficulty_adjustment" timestamp,
	"current_actfl_level" text,
	"last_actfl_assessment" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_review_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" varchar NOT NULL,
	"prompt" text NOT NULL,
	"target_text" text NOT NULL,
	"native_translation" text,
	"context" text,
	"item_type" varchar DEFAULT 'vocabulary' NOT NULL,
	"source_conversation_id" varchar,
	"scenario_slug" varchar,
	"mastered" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"last_score" real,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval_days" real DEFAULT 1 NOT NULL,
	"next_review_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_scenario_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"scenario_id" varchar NOT NULL,
	"conversation_id" varchar,
	"actfl_level" varchar,
	"completed_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"duration_seconds" integer,
	"performance_notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"auth_provider" "auth_provider" DEFAULT 'replit',
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"learning_path_mode" varchar DEFAULT 'open',
	"developer_model" varchar,
	"impersonated_user_id" varchar,
	"impersonated_by" varchar,
	"impersonation_expires_at" timestamp,
	"is_test_account" boolean DEFAULT false,
	"is_beta_tester" boolean DEFAULT false,
	"target_language" varchar,
	"native_language" varchar DEFAULT 'english',
	"difficulty_level" varchar,
	"onboarding_completed" boolean DEFAULT false,
	"tutor_gender" varchar DEFAULT 'female',
	"assistant_voice_gender" varchar DEFAULT 'female',
	"tutor_personality" varchar DEFAULT 'warm',
	"tutor_expressiveness" integer DEFAULT 3,
	"self_directed_flexibility" "tutor_freedom_level" DEFAULT 'flexible_goals',
	"self_directed_placement_done" boolean DEFAULT false,
	"has_completed_first_meeting" boolean DEFAULT false,
	"actfl_level" varchar,
	"actfl_assessed" boolean DEFAULT false,
	"assessment_source" varchar DEFAULT 'onboarding_hint',
	"last_assessment_date" timestamp,
	"timezone" varchar,
	"memory_privacy_settings" jsonb DEFAULT '{"enabled":true,"allowedCategories":[],"blockedCategories":[],"redactionRequested":false}'::jsonb,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"subscription_tier" varchar DEFAULT 'free',
	"subscription_status" varchar DEFAULT 'active',
	"monthly_message_count" integer DEFAULT 0,
	"monthly_message_limit" integer DEFAULT 20,
	"last_message_reset_date" timestamp DEFAULT now(),
	"total_conversations" integer DEFAULT 0,
	"tos_accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"difficulty_level" text NOT NULL,
	"category" text NOT NULL,
	"video_file_id" varchar NOT NULL,
	"duration" integer NOT NULL,
	"thumbnail_url" text,
	"actfl_level" text,
	"tags" text[],
	"topics" text[],
	"objectives" text[],
	"view_count" integer DEFAULT 0,
	"is_published" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visual_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"object_type" text NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"zone_image_url" text,
	"width" integer DEFAULT 200 NOT NULL,
	"height" integer DEFAULT 200 NOT NULL,
	"spanish_terms" text[] DEFAULT '{}' NOT NULL,
	"french_terms" text[] DEFAULT '{}' NOT NULL,
	"german_terms" text[] DEFAULT '{}' NOT NULL,
	"italian_terms" text[] DEFAULT '{}' NOT NULL,
	"portuguese_terms" text[] DEFAULT '{}' NOT NULL,
	"japanese_terms" text[] DEFAULT '{}' NOT NULL,
	"korean_terms" text[] DEFAULT '{}' NOT NULL,
	"mandarin_terms" text[] DEFAULT '{}' NOT NULL,
	"arabic_terms" text[] DEFAULT '{}' NOT NULL,
	"russian_terms" text[] DEFAULT '{}' NOT NULL,
	"english_terms" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visual_assets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "visual_compositions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"environment_id" varchar NOT NULL,
	"composition_data" jsonb,
	"composed_image_url" text,
	"teaching_context" text,
	"vocab_terms" text[] DEFAULT '{}' NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visual_environments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"width" integer DEFAULT 1920 NOT NULL,
	"height" integer DEFAULT 1080 NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visual_environments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "visual_zones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" varchar NOT NULL,
	"zone_key" text NOT NULL,
	"zone_name" text NOT NULL,
	"zone_type" text NOT NULL,
	"description" text NOT NULL,
	"language_functions" text[] DEFAULT '{}' NOT NULL,
	"position_hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocabulary_word_topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vocabulary_word_id" varchar NOT NULL,
	"topic_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocabulary_words" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"language" text NOT NULL,
	"word" text NOT NULL,
	"translation" text NOT NULL,
	"example" text NOT NULL,
	"pronunciation" text NOT NULL,
	"difficulty" text NOT NULL,
	"actfl_level" text,
	"source_conversation_id" varchar,
	"source_message_id" varchar,
	"class_id" varchar,
	"word_type" "word_type",
	"verb_tense" text,
	"verb_mood" text,
	"verb_person" text,
	"noun_gender" text,
	"noun_number" text,
	"grammar_notes" text,
	"next_review_date" timestamp DEFAULT now() NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"repetition" integer DEFAULT 0 NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_diag_daily_summaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"summary_date" date NOT NULL,
	"total_events" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"mobile_count" integer DEFAULT 0 NOT NULL,
	"desktop_count" integer DEFAULT 0 NOT NULL,
	"by_trigger" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"health_status" varchar(10) DEFAULT 'green' NOT NULL,
	"peak_hourly_rate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_grace_periods" (
	"conversation_id" varchar PRIMARY KEY NOT NULL,
	"usage_session_id" varchar NOT NULL,
	"compass_session_active" boolean DEFAULT false NOT NULL,
	"exchange_count" integer DEFAULT 0 NOT NULL,
	"student_speaking_seconds" real DEFAULT 0 NOT NULL,
	"tutor_speaking_seconds" real DEFAULT 0 NOT NULL,
	"tts_characters" integer DEFAULT 0 NOT NULL,
	"stt_seconds" real DEFAULT 0 NOT NULL,
	"session_start_time" bigint NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_pipeline_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conversation_id" varchar,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_seconds" integer DEFAULT 0,
	"exchange_count" integer DEFAULT 0,
	"student_speaking_seconds" integer DEFAULT 0,
	"tutor_speaking_seconds" integer DEFAULT 0,
	"tts_characters" integer DEFAULT 0,
	"stt_seconds" integer DEFAULT 0,
	"llm_input_tokens" integer DEFAULT 0,
	"llm_output_tokens" integer DEFAULT 0,
	"language" varchar,
	"status" "voice_session_status" DEFAULT 'active',
	"tutor_mode" "tutor_mode" DEFAULT 'main',
	"class_id" varchar,
	"is_test_session" boolean DEFAULT false,
	"environment" "environment_origin",
	"assessment_active" boolean DEFAULT false,
	"assessment_turn_count" integer DEFAULT 0,
	"assessment_rubric" text
);
--> statement-breakpoint
CREATE TABLE "wren_calibration_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar NOT NULL,
	"total_predictions" integer DEFAULT 0,
	"correct_predictions" integer DEFAULT 0,
	"avg_stated_confidence" real,
	"avg_actual_accuracy" real,
	"calibration_gap" real,
	"is_overconfident" boolean,
	"is_underconfident" boolean,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wren_calibration_stats_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "wren_commitments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" varchar(255) NOT NULL,
	"description" text,
	"commitment_type" "wren_commitment_type" DEFAULT 'general',
	"status" "wren_commitment_status" DEFAULT 'pending',
	"priority" "wren_commitment_priority" DEFAULT 'normal',
	"source_session_id" varchar,
	"source_message_id" varchar,
	"requested_by" varchar,
	"assigned_to" varchar DEFAULT 'agent_wren',
	"progress_notes" text,
	"completion_result" text,
	"estimated_effort" varchar,
	"actual_effort" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"due_by" timestamp,
	"related_entity_type" varchar,
	"related_entity_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_confidence_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar NOT NULL,
	"claim_or_action" text NOT NULL,
	"stated_confidence" real NOT NULL,
	"reasoning" text,
	"uncertainty_factors" text[] DEFAULT '{}'::text[],
	"was_correct" boolean,
	"actual_outcome" text,
	"verified_at" timestamp,
	"verified_by" varchar,
	"calibration_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "wren_insight_category" NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"tags" text[] DEFAULT '{}'::text[],
	"related_files" text[] DEFAULT '{}'::text[],
	"related_insights" text[] DEFAULT '{}'::text[],
	"use_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"environment" varchar DEFAULT 'development',
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"lesson_type" varchar NOT NULL,
	"trigger_condition" text NOT NULL,
	"warning_message" text NOT NULL,
	"from_mistake_ids" text[] DEFAULT '{}'::text[],
	"applicable_components" text[] DEFAULT '{}'::text[],
	"applicable_patterns" text[] DEFAULT '{}'::text[],
	"times_triggered" integer DEFAULT 0,
	"times_prevented" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_mistake_resolutions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mistake_id" varchar NOT NULL,
	"what_fixed" text NOT NULL,
	"how_fixed" text NOT NULL,
	"prevention_strategy" text,
	"lesson_learned" text,
	"files_changed" text[] DEFAULT '{}'::text[],
	"commit_hash" varchar,
	"time_to_resolve_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_mistakes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"mistake_type" varchar NOT NULL,
	"severity" "wren_mistake_severity" DEFAULT 'moderate',
	"status" "wren_mistake_status" DEFAULT 'identified',
	"error_message" text,
	"stack_trace" text,
	"related_files" text[] DEFAULT '{}'::text[],
	"related_component" varchar,
	"root_cause" text,
	"what_went_wrong" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prediction_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"basis" text NOT NULL,
	"confidence" real NOT NULL,
	"predicted_for" varchar,
	"timeframe_estimate" varchar,
	"supporting_evidence" jsonb DEFAULT '[]'::jsonb,
	"status" varchar DEFAULT 'predicted',
	"was_correct" boolean,
	"outcome_notes" text,
	"validated_at" timestamp,
	"related_beacon_id" varchar,
	"related_feature_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_proactive_triggers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_type" varchar NOT NULL,
	"urgency" "wren_trigger_urgency" DEFAULT 'medium',
	"status" "wren_trigger_status" DEFAULT 'pending',
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb,
	"occurrence_count" integer DEFAULT 1,
	"first_occurred_at" timestamp DEFAULT now() NOT NULL,
	"last_occurred_at" timestamp DEFAULT now() NOT NULL,
	"related_component" varchar,
	"related_files" text[] DEFAULT '{}'::text[],
	"related_beacon_id" varchar,
	"suggested_action" text,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wren_session_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"note_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"for_next_session" boolean DEFAULT true,
	"expires_at" timestamp,
	"related_files" text[] DEFAULT '{}'::text[],
	"related_tasks" text[] DEFAULT '{}'::text[],
	"was_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actfl_assessment_events" ADD CONSTRAINT "actfl_assessment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actfl_assessment_events" ADD CONSTRAINT "actfl_assessment_events_voice_session_id_voice_sessions_id_fk" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actfl_assessment_events" ADD CONSTRAINT "actfl_assessment_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actfl_level_changes" ADD CONSTRAINT "actfl_level_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actfl_progress" ADD CONSTRAINT "actfl_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_queue" ADD CONSTRAINT "agenda_queue_target_session_id_founder_sessions_id_fk" FOREIGN KEY ("target_session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_queue" ADD CONSTRAINT "agenda_queue_discussed_in_session_id_founder_sessions_id_fk" FOREIGN KEY ("discussed_in_session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_converted_to_sprint_id_feature_sprints_id_fk" FOREIGN KEY ("converted_to_sprint_id") REFERENCES "public"."feature_sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alden_messages" ADD CONSTRAINT "alden_messages_conversation_id_alden_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."alden_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "architect_notes" ADD CONSTRAINT "architect_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aris_drill_assignments" ADD CONSTRAINT "aris_drill_assignments_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_vocabulary" ADD CONSTRAINT "assignment_vocabulary_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_vocabulary" ADD CONSTRAINT "assignment_vocabulary_vocabulary_word_id_vocabulary_words_id_fk" FOREIGN KEY ("vocabulary_word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_curriculum_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("curriculum_lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_curriculum_lessons" ADD CONSTRAINT "class_curriculum_lessons_class_unit_id_class_curriculum_units_id_fk" FOREIGN KEY ("class_unit_id") REFERENCES "public"."class_curriculum_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_curriculum_lessons" ADD CONSTRAINT "class_curriculum_lessons_source_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("source_lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_curriculum_units" ADD CONSTRAINT "class_curriculum_units_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_curriculum_units" ADD CONSTRAINT "class_curriculum_units_source_unit_id_curriculum_units_id_fk" FOREIGN KEY ("source_unit_id") REFERENCES "public"."curriculum_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_hour_packages" ADD CONSTRAINT "class_hour_packages_purchaser_id_users_id_fk" FOREIGN KEY ("purchaser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_messages" ADD CONSTRAINT "collaboration_messages_session_id_founder_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compartment_events" ADD CONSTRAINT "compartment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compartment_installation" ADD CONSTRAINT "compartment_installation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_messages" ADD CONSTRAINT "consultation_messages_thread_id_consultation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."consultation_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_messages" ADD CONSTRAINT "consultation_messages_converted_to_sprint_id_feature_sprints_id_fk" FOREIGN KEY ("converted_to_sprint_id") REFERENCES "public"."feature_sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_threads" ADD CONSTRAINT "consultation_threads_sprint_id_feature_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."feature_sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_topics" ADD CONSTRAINT "conversation_topics_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_topics" ADD CONSTRAINT "conversation_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultural_tip_media" ADD CONSTRAINT "cultural_tip_media_cultural_tip_id_cultural_tips_id_fk" FOREIGN KEY ("cultural_tip_id") REFERENCES "public"."cultural_tips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultural_tip_media" ADD CONSTRAINT "cultural_tip_media_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_drill_items" ADD CONSTRAINT "curriculum_drill_items_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_lessons" ADD CONSTRAINT "curriculum_lessons_curriculum_unit_id_curriculum_units_id_fk" FOREIGN KEY ("curriculum_unit_id") REFERENCES "public"."curriculum_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_paths" ADD CONSTRAINT "curriculum_paths_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_unit_can_do_map" ADD CONSTRAINT "curriculum_unit_can_do_map_unit_id_curriculum_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."curriculum_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_unit_can_do_map" ADD CONSTRAINT "curriculum_unit_can_do_map_can_do_statement_id_can_do_statements_id_fk" FOREIGN KEY ("can_do_statement_id") REFERENCES "public"."can_do_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_units" ADD CONSTRAINT "curriculum_units_curriculum_path_id_curriculum_paths_id_fk" FOREIGN KEY ("curriculum_path_id") REFERENCES "public"."curriculum_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_aspirations" ADD CONSTRAINT "daniela_aspirations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_curiosities" ADD CONSTRAINT "daniela_curiosities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_growth_memories" ADD CONSTRAINT "daniela_growth_memories_source_session_id_founder_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_growth_memories" ADD CONSTRAINT "daniela_growth_memories_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_notes" ADD CONSTRAINT "daniela_notes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_personal_shares" ADD CONSTRAINT "daniela_personal_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_recommendations" ADD CONSTRAINT "daniela_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_recommendations" ADD CONSTRAINT "daniela_recommendations_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_recommendations" ADD CONSTRAINT "daniela_recommendations_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_recommendations" ADD CONSTRAINT "daniela_recommendations_evidence_conversation_id_conversations_id_fk" FOREIGN KEY ("evidence_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_recommendations" ADD CONSTRAINT "daniela_recommendations_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_self_reflections" ADD CONSTRAINT "daniela_self_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_session_feelings" ADD CONSTRAINT "daniela_session_feelings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_session_feelings" ADD CONSTRAINT "daniela_session_feelings_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daniela_suggestion_actions" ADD CONSTRAINT "daniela_suggestion_actions_suggestion_id_daniela_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."daniela_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_beacon_queue" ADD CONSTRAINT "editor_beacon_queue_snapshot_id_editor_listening_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."editor_listening_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_listening_snapshots" ADD CONSTRAINT "editor_listening_snapshots_channel_id_collaboration_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."collaboration_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "founder_sessions" ADD CONSTRAINT "founder_sessions_founder_id_users_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_assignment_submissions" ADD CONSTRAINT "grammar_assignment_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_assignments" ADD CONSTRAINT "grammar_assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_errors" ADD CONSTRAINT "grammar_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_errors" ADD CONSTRAINT "grammar_errors_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_snapshots" ADD CONSTRAINT "hive_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_snapshots" ADD CONSTRAINT "hive_snapshots_session_id_founder_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_snapshots" ADD CONSTRAINT "journey_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_memory_candidates" ADD CONSTRAINT "learner_memory_candidates_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_memory_candidates" ADD CONSTRAINT "learner_memory_candidates_db_session_id_voice_sessions_id_fk" FOREIGN KEY ("db_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_personal_facts" ADD CONSTRAINT "learner_personal_facts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_personal_facts" ADD CONSTRAINT "learner_personal_facts_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_milestones" ADD CONSTRAINT "learning_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_milestones" ADD CONSTRAINT "learning_milestones_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_milestones" ADD CONSTRAINT "learning_milestones_voice_session_id_voice_sessions_id_fk" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_motivations" ADD CONSTRAINT "learning_motivations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_motivations" ADD CONSTRAINT "learning_motivations_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_can_do_statements" ADD CONSTRAINT "lesson_can_do_statements_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_can_do_statements" ADD CONSTRAINT "lesson_can_do_statements_can_do_statement_id_can_do_statements_id_fk" FOREIGN KEY ("can_do_statement_id") REFERENCES "public"."can_do_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cultural_tips" ADD CONSTRAINT "lesson_cultural_tips_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cultural_tips" ADD CONSTRAINT "lesson_cultural_tips_cultural_tip_id_cultural_tips_id_fk" FOREIGN KEY ("cultural_tip_id") REFERENCES "public"."cultural_tips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_drafts" ADD CONSTRAINT "lesson_drafts_can_do_statement_id_can_do_statements_id_fk" FOREIGN KEY ("can_do_statement_id") REFERENCES "public"."can_do_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_drafts" ADD CONSTRAINT "lesson_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_drafts" ADD CONSTRAINT "lesson_drafts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_page_events" ADD CONSTRAINT "lesson_page_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_visual_aids" ADD CONSTRAINT "lesson_visual_aids_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_visual_aids" ADD CONSTRAINT "lesson_visual_aids_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_evidence" ADD CONSTRAINT "mastery_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compass_examples" ADD CONSTRAINT "compass_examples_principle_id_compass_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."compass_principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compass_examples" ADD CONSTRAINT "compass_examples_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compass_principles" ADD CONSTRAINT "compass_principles_founder_session_id_founder_sessions_id_fk" FOREIGN KEY ("founder_session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compass_understanding" ADD CONSTRAINT "compass_understanding_principle_id_compass_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."compass_principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compass_understanding" ADD CONSTRAINT "compass_understanding_deepening_session_id_founder_sessions_id_fk" FOREIGN KEY ("deepening_session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedagogical_loop_state" ADD CONSTRAINT "pedagogical_loop_state_session_id_tutor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedagogical_snapshots" ADD CONSTRAINT "pedagogical_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_token_id_auth_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."auth_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_reflections" ADD CONSTRAINT "pending_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_connections" ADD CONSTRAINT "people_connections_person_a_id_users_id_fk" FOREIGN KEY ("person_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_connections" ADD CONSTRAINT "people_connections_person_b_id_users_id_fk" FOREIGN KEY ("person_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_connections" ADD CONSTRAINT "people_connections_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_connections" ADD CONSTRAINT "people_connections_mentioned_by_users_id_fk" FOREIGN KEY ("mentioned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phoneme_struggles" ADD CONSTRAINT "phoneme_struggles_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_flight_reports" ADD CONSTRAINT "post_flight_reports_sprint_id_feature_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."feature_sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_flight_reports" ADD CONSTRAINT "post_flight_reports_beacon_id_daniela_beacons_id_fk" FOREIGN KEY ("beacon_id") REFERENCES "public"."daniela_beacons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predicted_struggles" ADD CONSTRAINT "predicted_struggles_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_config" ADD CONSTRAINT "product_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_history" ADD CONSTRAINT "progress_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_queue" ADD CONSTRAINT "promotion_queue_best_practice_id_self_best_practices_id_fk" FOREIGN KEY ("best_practice_id") REFERENCES "public"."self_best_practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_queue" ADD CONSTRAINT "promotion_queue_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_queue" ADD CONSTRAINT "promotion_queue_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation_audio" ADD CONSTRAINT "pronunciation_audio_audio_file_id_media_files_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation_audio" ADD CONSTRAINT "pronunciation_audio_vocabulary_word_id_vocabulary_words_id_fk" FOREIGN KEY ("vocabulary_word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation_scores" ADD CONSTRAINT "pronunciation_scores_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation_scores" ADD CONSTRAINT "pronunciation_scores_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_module_views" ADD CONSTRAINT "reading_module_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_module_views" ADD CONSTRAINT "reading_module_views_module_id_reading_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."reading_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_struggles" ADD CONSTRAINT "recurring_struggles_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_artifacts" ADD CONSTRAINT "room_artifacts_room_id_team_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."team_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_hand_raises" ADD CONSTRAINT "room_hand_raises_room_id_team_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."team_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_session_summaries" ADD CONSTRAINT "room_session_summaries_room_id_team_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."team_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_voice_messages" ADD CONSTRAINT "room_voice_messages_room_id_team_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."team_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_level_guides" ADD CONSTRAINT "scenario_level_guides_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_props" ADD CONSTRAINT "scenario_props_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_zones" ADD CONSTRAINT "scenario_zones_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_world_ledger" ADD CONSTRAINT "scene_world_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_best_practices" ADD CONSTRAINT "self_best_practices_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_practice_sessions" ADD CONSTRAINT "self_practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_practice_sessions" ADD CONSTRAINT "self_practice_sessions_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_cost_summary" ADD CONSTRAINT "session_cost_summary_tutor_session_id_tutor_sessions_id_fk" FOREIGN KEY ("tutor_session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_cost_summary" ADD CONSTRAINT "session_cost_summary_voice_session_id_voice_sessions_id_fk" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_cost_summary" ADD CONSTRAINT "session_cost_summary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_stage_transitions" ADD CONSTRAINT "sprint_stage_transitions_sprint_id_feature_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."feature_sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_can_do_evidence" ADD CONSTRAINT "student_can_do_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_can_do_evidence" ADD CONSTRAINT "student_can_do_evidence_can_do_statement_id_can_do_statements_id_fk" FOREIGN KEY ("can_do_statement_id") REFERENCES "public"."can_do_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_can_do_progress" ADD CONSTRAINT "student_can_do_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_can_do_progress" ADD CONSTRAINT "student_can_do_progress_can_do_statement_id_can_do_statements_id_fk" FOREIGN KEY ("can_do_statement_id") REFERENCES "public"."can_do_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_can_do_progress" ADD CONSTRAINT "student_can_do_progress_evidence_conversation_id_conversations_id_fk" FOREIGN KEY ("evidence_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_contact_preferences" ADD CONSTRAINT "student_contact_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_goals" ADD CONSTRAINT "student_goals_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_insights" ADD CONSTRAINT "student_insights_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_pedagogical_briefs" ADD CONSTRAINT "student_pedagogical_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_tier_signals" ADD CONSTRAINT "student_tier_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_tier_signals" ADD CONSTRAINT "student_tier_signals_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_tier_signals" ADD CONSTRAINT "student_tier_signals_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgery_turns" ADD CONSTRAINT "surgery_turns_session_id_surgery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."surgery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_evidence_conversation_id_conversations_id_fk" FOREIGN KEY ("evidence_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_curriculum_path_id_curriculum_paths_id_fk" FOREIGN KEY ("curriculum_path_id") REFERENCES "public"."curriculum_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_classes" ADD CONSTRAINT "teacher_classes_hour_package_id_class_hour_packages_id_fk" FOREIGN KEY ("hour_package_id") REFERENCES "public"."class_hour_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_tool_events" ADD CONSTRAINT "teaching_tool_events_voice_session_id_voice_sessions_id_fk" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_tool_events" ADD CONSTRAINT "teaching_tool_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_tool_events" ADD CONSTRAINT "teaching_tool_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_section_progress" ADD CONSTRAINT "textbook_section_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_section_progress" ADD CONSTRAINT "textbook_section_progress_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_user_position" ADD CONSTRAINT "textbook_user_position_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_user_position" ADD CONSTRAINT "textbook_user_position_last_chapter_id_curriculum_units_id_fk" FOREIGN KEY ("last_chapter_id") REFERENCES "public"."curriculum_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_user_position" ADD CONSTRAINT "textbook_user_position_last_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("last_lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_visual_assets" ADD CONSTRAINT "textbook_visual_assets_chapter_id_curriculum_units_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."curriculum_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_visual_assets" ADD CONSTRAINT "textbook_visual_assets_lesson_id_curriculum_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."curriculum_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_competency_observations" ADD CONSTRAINT "topic_competency_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_competency_observations" ADD CONSTRAINT "topic_competency_observations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_competency_observations" ADD CONSTRAINT "topic_competency_observations_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_competency_observations" ADD CONSTRAINT "topic_competency_observations_matched_topic_id_topics_id_fk" FOREIGN KEY ("matched_topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_parking_items" ADD CONSTRAINT "tutor_parking_items_session_id_tutor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session_topics" ADD CONSTRAINT "tutor_session_topics_session_id_tutor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_voice_session_id_voice_sessions_id_fk" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_voice_session_id_voice_sessions_id_fk" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drill_progress" ADD CONSTRAINT "user_drill_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drill_progress" ADD CONSTRAINT "user_drill_progress_drill_item_id_curriculum_drill_items_id_fk" FOREIGN KEY ("drill_item_id") REFERENCES "public"."curriculum_drill_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_grammar_progress" ADD CONSTRAINT "user_grammar_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_language_preferences" ADD CONSTRAINT "user_language_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lesson_items" ADD CONSTRAINT "user_lesson_items_lesson_id_user_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."user_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lesson_items" ADD CONSTRAINT "user_lesson_items_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lesson_items" ADD CONSTRAINT "user_lesson_items_vocabulary_word_id_vocabulary_words_id_fk" FOREIGN KEY ("vocabulary_word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lessons" ADD CONSTRAINT "user_lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_motivation_alerts" ADD CONSTRAINT "user_motivation_alerts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review_items" ADD CONSTRAINT "user_review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review_items" ADD CONSTRAINT "user_review_items_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scenario_history" ADD CONSTRAINT "user_scenario_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scenario_history" ADD CONSTRAINT "user_scenario_history_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_lessons" ADD CONSTRAINT "video_lessons_video_file_id_media_files_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_lessons" ADD CONSTRAINT "video_lessons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_word_topics" ADD CONSTRAINT "vocabulary_word_topics_vocabulary_word_id_vocabulary_words_id_fk" FOREIGN KEY ("vocabulary_word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_word_topics" ADD CONSTRAINT "vocabulary_word_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_class_id_teacher_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."teacher_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wren_commitments" ADD CONSTRAINT "wren_commitments_source_session_id_founder_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."founder_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_actfl_events_user" ON "actfl_assessment_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_actfl_events_language" ON "actfl_assessment_events" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_actfl_events_level" ON "actfl_assessment_events" USING btree ("new_level");--> statement-breakpoint
CREATE INDEX "idx_actfl_events_created" ON "actfl_assessment_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_actfl_level_changes_user_lang" ON "actfl_level_changes" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_actfl_progress_user_language" ON "actfl_progress" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_actor" ON "admin_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_target" ON "admin_audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agenda_queue_status" ON "agenda_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agenda_queue_priority" ON "agenda_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_agenda_queue_type" ON "agenda_queue" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_agenda_queue_created" ON "agenda_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_msg_thread" ON "agent_collab_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_agent_msg_author" ON "agent_collab_messages" USING btree ("author");--> statement-breakpoint
CREATE INDEX "idx_agent_msg_type" ON "agent_collab_messages" USING btree ("message_type");--> statement-breakpoint
CREATE INDEX "idx_agent_msg_created" ON "agent_collab_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_thread_status" ON "agent_collab_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_thread_beacon" ON "agent_collab_threads" USING btree ("origin_beacon_id");--> statement-breakpoint
CREATE INDEX "idx_agent_thread_priority" ON "agent_collab_threads" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_agent_thread_last_message" ON "agent_collab_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_collab_events_from" ON "agent_collaboration_events" USING btree ("from_agent");--> statement-breakpoint
CREATE INDEX "idx_collab_events_to" ON "agent_collaboration_events" USING btree ("to_agent");--> statement-breakpoint
CREATE INDEX "idx_collab_events_type" ON "agent_collaboration_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_collab_events_status" ON "agent_collaboration_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_collab_events_user" ON "agent_collaboration_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_collab_events_created" ON "agent_collaboration_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_collab_events_security" ON "agent_collaboration_events" USING btree ("security_classification");--> statement-breakpoint
CREATE INDEX "idx_agent_observations_category" ON "agent_observations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_agent_observations_status" ON "agent_observations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_observations_priority" ON "agent_observations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_agent_observations_origin" ON "agent_observations" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_agent_observations_intent" ON "agent_observations" USING btree ("intent_hash");--> statement-breakpoint
CREATE INDEX "idx_ai_suggestions_status" ON "ai_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_suggestions_type" ON "ai_suggestions" USING btree ("suggestion_type");--> statement-breakpoint
CREATE INDEX "idx_ai_suggestions_created" ON "ai_suggestions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_architect_notes_conversation" ON "architect_notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_architect_notes_delivered" ON "architect_notes" USING btree ("delivered");--> statement-breakpoint
CREATE INDEX "idx_architect_notes_created" ON "architect_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_adr_status" ON "architectural_decision_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_adr_created" ON "architectural_decision_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_aris_assignments_user" ON "aris_drill_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aris_assignments_status" ON "aris_drill_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_aris_assignments_created" ON "aris_drill_assignments" USING btree ("assigned_at");--> statement-breakpoint
CREATE INDEX "idx_aris_assignments_lifecycle" ON "aris_drill_assignments" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "idx_aris_assignments_lesson" ON "aris_drill_assignments" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_aris_results_assignment" ON "aris_drill_results" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_aris_results_user" ON "aris_drill_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aris_results_created" ON "aris_drill_results" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_audio_library_hash" ON "audio_library" USING btree ("text_hash");--> statement-breakpoint
CREATE INDEX "idx_audio_library_language" ON "audio_library" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_audio_library_source" ON "audio_library" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_audio_library_content_type" ON "audio_library" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_user_id" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_type" ON "auth_tokens" USING btree ("token_type");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_expires" ON "auth_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_brain_metrics_date" ON "brain_daily_metrics" USING btree ("metric_date");--> statement-breakpoint
CREATE INDEX "idx_brain_metrics_user" ON "brain_daily_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_brain_metrics_date_user" ON "brain_daily_metrics" USING btree ("metric_date","user_id");--> statement-breakpoint
CREATE INDEX "idx_brain_events_type" ON "brain_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_brain_events_user" ON "brain_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_brain_events_session" ON "brain_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_brain_events_created" ON "brain_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_class_curriculum_lessons_unit" ON "class_curriculum_lessons" USING btree ("class_unit_id");--> statement-breakpoint
CREATE INDEX "idx_class_curriculum_units_class" ON "class_curriculum_units" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_class_enrollments_student" ON "class_enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_class_enrollments_class" ON "class_enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_collaboration_channels_conversation" ON "collaboration_channels" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_collaboration_channels_user" ON "collaboration_channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_collaboration_channels_phase" ON "collaboration_channels" USING btree ("session_phase");--> statement-breakpoint
CREATE INDEX "idx_collaboration_channels_started" ON "collaboration_channels" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_collaboration_hub_events_type" ON "collaboration_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_collaboration_hub_events_sender" ON "collaboration_events" USING btree ("sender_role");--> statement-breakpoint
CREATE INDEX "idx_collaboration_hub_events_unread" ON "collaboration_events" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_collaboration_hub_events_created" ON "collaboration_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_collab_msg_session" ON "collaboration_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_collab_msg_cursor" ON "collaboration_messages" USING btree ("cursor");--> statement-breakpoint
CREATE INDEX "idx_collab_msg_synced" ON "collaboration_messages" USING btree ("synced");--> statement-breakpoint
CREATE INDEX "idx_collab_msg_created" ON "collaboration_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_collaboration_hub_participants_role" ON "collaboration_participants" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_collaboration_hub_participants_online" ON "collaboration_participants" USING btree ("is_online");--> statement-breakpoint
CREATE INDEX "idx_compartment_events_user_lang" ON "compartment_events" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_compartment_events_pattern" ON "compartment_events" USING btree ("user_id","language","pattern_key");--> statement-breakpoint
CREATE INDEX "idx_compartment_events_session" ON "compartment_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_compartment_events_type" ON "compartment_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_compartment_user_lang_pattern" ON "compartment_installation" USING btree ("user_id","language","pattern_key");--> statement-breakpoint
CREATE INDEX "idx_compartment_user_lang" ON "compartment_installation" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_compartment_status" ON "compartment_installation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_consultation_messages_thread" ON "consultation_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_messages_created" ON "consultation_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_consultation_threads_created_by" ON "consultation_threads" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_consultation_threads_sprint" ON "consultation_threads" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_topics_conv" ON "conversation_topics" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_topics_topic" ON "conversation_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user_id" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user_language" ON "conversations" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_conversations_class" ON "conversations" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_type" ON "conversations" USING btree ("conversation_type");--> statement-breakpoint
CREATE INDEX "idx_conversations_owner_email" ON "conversations" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "idx_creativity_templates_type" ON "creativity_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_creativity_templates_source" ON "creativity_templates" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "idx_creativity_templates_origin" ON "creativity_templates" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_cultural_nuances_language" ON "cultural_nuances" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_cultural_nuances_category" ON "cultural_nuances" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_cultural_nuances_origin" ON "cultural_nuances" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_drill_items_lesson" ON "curriculum_drill_items" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_drill_items_type" ON "curriculum_drill_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_unit_can_do_unit" ON "curriculum_unit_can_do_map" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_unit_can_do_statement" ON "curriculum_unit_can_do_map" USING btree ("can_do_statement_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_absence_nudges_user" ON "daniela_absence_nudges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_absence_nudges_resolved" ON "daniela_absence_nudges" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "idx_aspirations_user" ON "daniela_aspirations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aspirations_session" ON "daniela_aspirations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_aspirations_created" ON "daniela_aspirations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_daniela_beacons_status" ON "daniela_beacons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_daniela_beacons_type" ON "daniela_beacons" USING btree ("beacon_type");--> statement-breakpoint
CREATE INDEX "idx_daniela_beacons_priority" ON "daniela_beacons" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_daniela_beacons_created" ON "daniela_beacons" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_daniela_beacons_digest" ON "daniela_beacons" USING btree ("include_in_digest","digest_sent_at");--> statement-breakpoint
CREATE INDEX "idx_curiosities_user" ON "daniela_curiosities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_curiosities_status" ON "daniela_curiosities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_curiosities_created" ON "daniela_curiosities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_feature_feedback_beacon" ON "daniela_feature_feedback" USING btree ("origin_beacon_id");--> statement-breakpoint
CREATE INDEX "idx_feature_feedback_effective" ON "daniela_feature_feedback" USING btree ("is_effective");--> statement-breakpoint
CREATE INDEX "idx_growth_memories_category" ON "daniela_growth_memories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_growth_memories_source" ON "daniela_growth_memories" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_growth_memories_active" ON "daniela_growth_memories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_growth_memories_committed" ON "daniela_growth_memories" USING btree ("committed_to_neural_network");--> statement-breakpoint
CREATE INDEX "idx_growth_memories_importance" ON "daniela_growth_memories" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_growth_memories_review_status" ON "daniela_growth_memories" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_daniela_notes_type" ON "daniela_notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "idx_daniela_notes_language" ON "daniela_notes" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_daniela_notes_active" ON "daniela_notes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_daniela_notes_created" ON "daniela_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_daniela_notes_type_active" ON "daniela_notes" USING btree ("note_type","is_active");--> statement-breakpoint
CREATE INDEX "idx_daniela_outbound_queue_user" ON "daniela_outbound_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_outbound_queue_delivered" ON "daniela_outbound_queue" USING btree ("delivered_at");--> statement-breakpoint
CREATE INDEX "idx_personal_shares_user" ON "daniela_personal_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_personal_shares_topic" ON "daniela_personal_shares" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "idx_personal_shares_created" ON "daniela_personal_shares" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_daniela_recommendations_user" ON "daniela_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_recommendations_language" ON "daniela_recommendations" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_daniela_recommendations_class" ON "daniela_recommendations" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_recommendations_completed" ON "daniela_recommendations" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "idx_daniela_recommendations_snoozed" ON "daniela_recommendations" USING btree ("snoozed_until");--> statement-breakpoint
CREATE INDEX "idx_self_reflections_user" ON "daniela_self_reflections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_self_reflections_created" ON "daniela_self_reflections" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_self_reflections_source" ON "daniela_self_reflections" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_session_feelings_user" ON "daniela_session_feelings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_feelings_conversation" ON "daniela_session_feelings" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_session_feelings_created" ON "daniela_session_feelings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_suggestion_actions_suggestion" ON "daniela_suggestion_actions" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX "idx_suggestion_actions_type" ON "daniela_suggestion_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_suggestion_actions_origin" ON "daniela_suggestion_actions" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_suggestions_category" ON "daniela_suggestions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_daniela_suggestions_status" ON "daniela_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_daniela_suggestions_priority" ON "daniela_suggestions" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_daniela_suggestions_mode" ON "daniela_suggestions" USING btree ("generated_in_mode");--> statement-breakpoint
CREATE INDEX "idx_daniela_suggestions_origin" ON "daniela_suggestions" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_daniela_suggestions_intent" ON "daniela_suggestions" USING btree ("intent_hash");--> statement-breakpoint
CREATE INDEX "idx_derived_wisdom_type" ON "derived_teaching_wisdom" USING btree ("wisdom_type");--> statement-breakpoint
CREATE INDEX "idx_derived_wisdom_student" ON "derived_teaching_wisdom" USING btree ("discovery_student_id");--> statement-breakpoint
CREATE INDEX "idx_derived_wisdom_origin" ON "derived_teaching_wisdom" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_dialect_variations_language" ON "dialect_variations" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_dialect_variations_region" ON "dialect_variations" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_dialect_variations_origin" ON "dialect_variations" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_beacon_queue_status" ON "editor_beacon_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_beacon_queue_created" ON "editor_beacon_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_beacon_queue_pending" ON "editor_beacon_queue" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "idx_editor_insights_category" ON "editor_insights" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_editor_insights_importance" ON "editor_insights" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_editor_insights_created" ON "editor_insights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_editor_snapshots_channel" ON "editor_listening_snapshots" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_editor_snapshots_beacon_type" ON "editor_listening_snapshots" USING btree ("beacon_type");--> statement-breakpoint
CREATE INDEX "idx_editor_snapshots_adopted" ON "editor_listening_snapshots" USING btree ("adopted_by_daniela");--> statement-breakpoint
CREATE INDEX "idx_editor_snapshots_surfaced" ON "editor_listening_snapshots" USING btree ("surfaced_to_daniela");--> statement-breakpoint
CREATE INDEX "idx_emotional_patterns_state" ON "emotional_patterns" USING btree ("emotional_state");--> statement-breakpoint
CREATE INDEX "idx_emotional_patterns_context" ON "emotional_patterns" USING btree ("learning_context");--> statement-breakpoint
CREATE INDEX "idx_emotional_patterns_origin" ON "emotional_patterns" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_feature_sprints_stage" ON "feature_sprints" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_feature_sprints_created_by" ON "feature_sprints" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_feature_sprints_created_at" ON "feature_sprints" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_founder_sessions_founder" ON "founder_sessions" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "idx_founder_sessions_status" ON "founder_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_founder_sessions_env" ON "founder_sessions" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "idx_grammar_submissions_assignment" ON "grammar_assignment_submissions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_submissions_student" ON "grammar_assignment_submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_assignments_class" ON "grammar_assignments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_assignments_teacher" ON "grammar_assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_competencies_language" ON "grammar_competencies" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_grammar_competencies_actfl" ON "grammar_competencies" USING btree ("actfl_level");--> statement-breakpoint
CREATE INDEX "idx_grammar_competencies_category" ON "grammar_competencies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_grammar_competencies_slug" ON "grammar_competencies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_grammar_errors_user" ON "grammar_errors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_errors_user_lang" ON "grammar_errors" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_grammar_errors_competency" ON "grammar_errors" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_errors_conversation" ON "grammar_errors" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_grammar_exercises_language" ON "grammar_exercises" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_grammar_exercises_competency" ON "grammar_exercises" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "idx_hive_snapshots_type" ON "hive_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "idx_hive_snapshots_user" ON "hive_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hive_snapshots_language" ON "hive_snapshots" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_hive_snapshots_importance" ON "hive_snapshots" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_hive_snapshots_created" ON "hive_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_image_vision_cache_url" ON "image_vision_cache" USING btree ("image_url");--> statement-breakpoint
CREATE INDEX "idx_journey_snapshots_user" ON "journey_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_journey_snapshots_user_language" ON "journey_snapshots" USING btree ("user_id","target_language");--> statement-breakpoint
CREATE INDEX "idx_journey_snapshots_type" ON "journey_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "idx_journey_snapshots_next_update" ON "journey_snapshots" USING btree ("next_update_due");--> statement-breakpoint
CREATE INDEX "idx_language_idioms_language" ON "language_idioms" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_language_idioms_region" ON "language_idioms" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_language_idioms_origin" ON "language_idioms" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_learner_errors_target" ON "learner_error_patterns" USING btree ("target_language");--> statement-breakpoint
CREATE INDEX "idx_learner_errors_pair" ON "learner_error_patterns" USING btree ("target_language","source_language");--> statement-breakpoint
CREATE INDEX "idx_learner_errors_category" ON "learner_error_patterns" USING btree ("error_category");--> statement-breakpoint
CREATE INDEX "idx_learner_errors_origin" ON "learner_error_patterns" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_memory_candidates_student" ON "learner_memory_candidates" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_memory_candidates_session" ON "learner_memory_candidates" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_memory_candidates_status" ON "learner_memory_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_memory_candidates_pending" ON "learner_memory_candidates" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_learner_personal_facts_student" ON "learner_personal_facts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_learner_personal_facts_student_type" ON "learner_personal_facts" USING btree ("student_id","fact_type");--> statement-breakpoint
CREATE INDEX "idx_learner_personal_facts_relevant_date" ON "learner_personal_facts" USING btree ("relevant_date");--> statement-breakpoint
CREATE INDEX "idx_learner_personal_facts_active" ON "learner_personal_facts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_learner_personal_facts_hash" ON "learner_personal_facts" USING btree ("fact_hash");--> statement-breakpoint
CREATE INDEX "idx_learner_personal_facts_current" ON "learner_personal_facts" USING btree ("student_id","valid_to");--> statement-breakpoint
CREATE INDEX "idx_learning_goals_student" ON "learning_goals" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_learning_goals_student_lang" ON "learning_goals" USING btree ("student_id","language");--> statement-breakpoint
CREATE INDEX "idx_learning_goals_active" ON "learning_goals" USING btree ("student_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_learning_milestones_user" ON "learning_milestones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_learning_milestones_user_language" ON "learning_milestones" USING btree ("user_id","target_language");--> statement-breakpoint
CREATE INDEX "idx_learning_milestones_type" ON "learning_milestones" USING btree ("milestone_type");--> statement-breakpoint
CREATE INDEX "idx_learning_milestones_occurred" ON "learning_milestones" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_learning_milestones_conversation" ON "learning_milestones" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_learning_motivations_student" ON "learning_motivations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_learning_motivations_status" ON "learning_motivations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lesson_drafts_status" ON "lesson_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lesson_drafts_language" ON "lesson_drafts" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_lesson_drafts_cando" ON "lesson_drafts" USING btree ("can_do_statement_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_page_events_user" ON "lesson_page_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_page_events_lesson" ON "lesson_page_events" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_page_events_created" ON "lesson_page_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_linguistic_bridges_pair" ON "linguistic_bridges" USING btree ("source_language","target_language");--> statement-breakpoint
CREATE INDEX "idx_linguistic_bridges_type" ON "linguistic_bridges" USING btree ("bridge_type");--> statement-breakpoint
CREATE INDEX "idx_linguistic_bridges_origin" ON "linguistic_bridges" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_mastery_evidence_user_lang" ON "mastery_evidence" USING btree ("user_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mastery_evidence_user_word_lang" ON "mastery_evidence" USING btree ("user_id","word","language");--> statement-breakpoint
CREATE INDEX "idx_media_search_query" ON "media_files" USING btree ("search_query");--> statement-breakpoint
CREATE INDEX "idx_media_prompt_hash" ON "media_files" USING btree ("prompt_hash");--> statement-breakpoint
CREATE INDEX "idx_media_is_reviewed" ON "media_files" USING btree ("is_reviewed");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_memory_embeddings_pair" ON "memory_embeddings" USING btree ("memory_type","memory_id");--> statement-breakpoint
CREATE INDEX "idx_memory_embeddings_user_type" ON "memory_embeddings" USING btree ("user_id","memory_type");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_monitoring_captured_at" ON "monitoring_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "idx_monitoring_metric_type" ON "monitoring_snapshots" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "idx_monitoring_anomaly" ON "monitoring_snapshots" USING btree ("is_anomaly");--> statement-breakpoint
CREATE INDEX "idx_neural_telemetry_session" ON "neural_network_telemetry" USING btree ("voice_session_id");--> statement-breakpoint
CREATE INDEX "idx_neural_telemetry_user" ON "neural_network_telemetry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_neural_telemetry_created" ON "neural_network_telemetry" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_neural_telemetry_language" ON "neural_network_telemetry" USING btree ("target_language");--> statement-breakpoint
CREATE INDEX "idx_compass_examples_principle" ON "compass_examples" USING btree ("principle_id");--> statement-breakpoint
CREATE INDEX "idx_compass_examples_source" ON "compass_examples" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_compass_principles_category" ON "compass_principles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_compass_principles_order" ON "compass_principles" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "idx_compass_understanding_principle" ON "compass_understanding" USING btree ("principle_id");--> statement-breakpoint
CREATE INDEX "idx_compass_understanding_depth" ON "compass_understanding" USING btree ("depth");--> statement-breakpoint
CREATE INDEX "idx_insights_language_topic" ON "pedagogical_insights" USING btree ("language","topic");--> statement-breakpoint
CREATE INDEX "idx_insights_pattern_key" ON "pedagogical_insights" USING btree ("pattern_key");--> statement-breakpoint
CREATE INDEX "idx_insights_active" ON "pedagogical_insights" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pedagogical_loop_session" ON "pedagogical_loop_state" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_pedagogical_loop_student_status" ON "pedagogical_loop_state" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_pedagogical_snapshots_user" ON "pedagogical_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pedagogical_snapshots_session" ON "pedagogical_snapshots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_pedagogical_snapshots_created" ON "pedagogical_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pending_invites_email" ON "pending_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_pending_invites_invited_by" ON "pending_invites" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "idx_pending_invites_token" ON "pending_invites" USING btree ("token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pending_reflections_user_unique" ON "pending_reflections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pending_reflections_created" ON "pending_reflections" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_people_connections_person_a" ON "people_connections" USING btree ("person_a_id");--> statement-breakpoint
CREATE INDEX "idx_people_connections_person_b" ON "people_connections" USING btree ("person_b_id");--> statement-breakpoint
CREATE INDEX "idx_people_connections_pending_name" ON "people_connections" USING btree ("pending_person_name");--> statement-breakpoint
CREATE INDEX "idx_people_connections_status" ON "people_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_phoneme_struggles_student" ON "phoneme_struggles" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_phoneme_struggles_student_lang" ON "phoneme_struggles" USING btree ("student_id","language");--> statement-breakpoint
CREATE INDEX "idx_phoneme_struggles_phoneme" ON "phoneme_struggles" USING btree ("phoneme");--> statement-breakpoint
CREATE INDEX "idx_phoneme_struggles_severity" ON "phoneme_struggles" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_phoneme_struggles_status" ON "phoneme_struggles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_predicted_struggles_student" ON "predicted_struggles" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_predicted_struggles_student_lang" ON "predicted_struggles" USING btree ("student_id","language");--> statement-breakpoint
CREATE INDEX "idx_predicted_struggles_active" ON "predicted_struggles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_predicted_struggles_session" ON "predicted_struggles" USING btree ("for_session_date");--> statement-breakpoint
CREATE INDEX "idx_project_context_active" ON "project_context_snapshots" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_project_context_created" ON "project_context_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_health_component" ON "project_health_metrics" USING btree ("component");--> statement-breakpoint
CREATE INDEX "idx_health_hotspot" ON "project_health_metrics" USING btree ("is_hot_spot");--> statement-breakpoint
CREATE INDEX "idx_health_score" ON "project_health_metrics" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX "idx_promotion_queue_status" ON "promotion_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promotion_queue_best_practice" ON "promotion_queue" USING btree ("best_practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reading_module_views_user_module" ON "reading_module_views" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reading_modules_subject_topic" ON "reading_modules" USING btree ("subject_domain","topic");--> statement-breakpoint
CREATE INDEX "idx_recurring_struggles_student" ON "recurring_struggles" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_struggles_student_lang" ON "recurring_struggles" USING btree ("student_id","language");--> statement-breakpoint
CREATE INDEX "idx_recurring_struggles_status" ON "recurring_struggles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reflection_triggers_type" ON "reflection_triggers" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_reflection_triggers_origin" ON "reflection_triggers" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_relational_temperature_student" ON "relational_temperature" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_relational_temperature_phase" ON "relational_temperature" USING btree ("relationship_phase");--> statement-breakpoint
CREATE INDEX "idx_relational_temperature_origin" ON "relational_temperature" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_resonance_anchors_student" ON "resonance_anchors" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_resonance_anchors_type" ON "resonance_anchors" USING btree ("anchor_type");--> statement-breakpoint
CREATE INDEX "idx_resonance_anchors_origin" ON "resonance_anchors" USING btree ("origin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_zone_order_idx" ON "scenario_zones" USING btree ("scenario_id","zone_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scene_world_ledger_user_scene" ON "scene_world_ledger" USING btree ("user_id","scene_name");--> statement-breakpoint
CREATE INDEX "idx_best_practices_category" ON "self_best_practices" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_best_practices_active" ON "self_best_practices" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_best_practices_sync_status" ON "self_best_practices" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "idx_best_practices_origin_id" ON "self_best_practices" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_self_practice_user" ON "self_practice_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_self_practice_lesson" ON "self_practice_sessions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_self_practice_status" ON "self_practice_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_self_practice_language" ON "self_practice_sessions" USING btree ("target_language");--> statement-breakpoint
CREATE INDEX "idx_self_surgery_status" ON "self_surgery_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_self_surgery_target" ON "self_surgery_proposals" USING btree ("target_table");--> statement-breakpoint
CREATE INDEX "idx_self_surgery_conversation" ON "self_surgery_proposals" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_cost_summary_tutor_session" ON "session_cost_summary" USING btree ("tutor_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cost_summary_voice_session" ON "session_cost_summary" USING btree ("voice_session_id");--> statement-breakpoint
CREATE INDEX "idx_cost_summary_user" ON "session_cost_summary" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cost_summary_class" ON "session_cost_summary" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_session_notes_conversation" ON "session_notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_session_notes_student" ON "session_notes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_situational_patterns_name" ON "situational_patterns" USING btree ("pattern_name");--> statement-breakpoint
CREATE INDEX "idx_situational_patterns_origin_proposal" ON "situational_patterns" USING btree ("origin_proposal_id");--> statement-breakpoint
CREATE INDEX "idx_sofia_reports_user" ON "sofia_issue_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sofia_reports_type" ON "sofia_issue_reports" USING btree ("issue_type");--> statement-breakpoint
CREATE INDEX "idx_sofia_reports_status" ON "sofia_issue_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sofia_reports_created" ON "sofia_issue_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sprint_transitions_sprint" ON "sprint_stage_transitions" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "idx_sprint_templates_type" ON "sprint_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_can_do_evidence_user_lang" ON "student_can_do_evidence" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_can_do_evidence_statement" ON "student_can_do_evidence" USING btree ("can_do_statement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_student_contact_pref_user" ON "student_contact_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_student_insights_student" ON "student_insights" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_student_insights_student_lang" ON "student_insights" USING btree ("student_id","language");--> statement-breakpoint
CREATE INDEX "idx_ped_brief_user_lang" ON "student_pedagogical_briefs" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_student_session_health_user" ON "student_session_health" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_student_session_health_created" ON "student_session_health" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_student_tier_signals_user" ON "student_tier_signals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_student_tier_signals_lesson" ON "student_tier_signals" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_student_tier_signals_class" ON "student_tier_signals" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_student_tier_signals_pending" ON "student_tier_signals" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "idx_student_tool_pref_student" ON "student_tool_preferences" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_student_tool_pref_tool" ON "student_tool_preferences" USING btree ("tool_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subject_syllabi_subject" ON "subject_syllabi" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "idx_subtlety_cues_type" ON "subtlety_cues" USING btree ("cue_type");--> statement-breakpoint
CREATE INDEX "idx_subtlety_cues_category" ON "subtlety_cues" USING btree ("signal_category");--> statement-breakpoint
CREATE INDEX "idx_subtlety_cues_origin" ON "subtlety_cues" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_support_kb_category" ON "support_knowledge_base" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_kb_active" ON "support_knowledge_base" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_support_messages_ticket" ON "support_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_observations_category" ON "support_observations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_observations_status" ON "support_observations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_support_observations_priority" ON "support_observations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_support_observations_escalation" ON "support_observations" USING btree ("escalation_needed");--> statement-breakpoint
CREATE INDEX "idx_support_observations_origin" ON "support_observations" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_support_observations_intent" ON "support_observations" USING btree ("intent_hash");--> statement-breakpoint
CREATE INDEX "idx_support_patterns_type" ON "support_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "idx_support_patterns_status" ON "support_patterns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_support_patterns_signature" ON "support_patterns" USING btree ("signature_hash");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_user" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_priority" ON "support_tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_category" ON "support_tickets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_created" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_surgery_sessions_status" ON "surgery_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_surgery_sessions_created" ON "surgery_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_surgery_turns_session" ON "surgery_turns" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_surgery_turns_speaker" ON "surgery_turns" USING btree ("speaker");--> statement-breakpoint
CREATE INDEX "idx_surgery_turns_number" ON "surgery_turns" USING btree ("turn_number");--> statement-breakpoint
CREATE INDEX "idx_syllabus_progress_student" ON "syllabus_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_syllabus_progress_class" ON "syllabus_progress" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_syllabus_progress_lesson" ON "syllabus_progress" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_syllabus_progress_status" ON "syllabus_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sync_anomalies_type" ON "sync_anomalies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_sync_anomalies_severity" ON "sync_anomalies" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_sync_anomalies_acknowledged" ON "sync_anomalies" USING btree ("acknowledged");--> statement-breakpoint
CREATE INDEX "idx_sync_anomalies_created" ON "sync_anomalies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sync_cursors_client" ON "sync_cursors" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_sync_cursors_session" ON "sync_cursors" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sync_cursors_client_session" ON "sync_cursors" USING btree ("client_id","session_id");--> statement-breakpoint
CREATE INDEX "idx_sync_receipts_batch" ON "sync_import_receipts" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_sync_receipts_source" ON "sync_import_receipts" USING btree ("source_environment");--> statement-breakpoint
CREATE INDEX "idx_sync_receipts_received" ON "sync_import_receipts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_sync_log_operation" ON "sync_log" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "idx_sync_log_table" ON "sync_log" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_sync_log_created" ON "sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_status" ON "sync_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_direction" ON "sync_runs" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_started" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_session" ON "sync_runs" USING btree ("sync_session_id");--> statement-breakpoint
CREATE INDEX "idx_synthesized_insights_category" ON "synthesized_insights" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_synthesized_insights_priority" ON "synthesized_insights" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_synthesized_insights_created" ON "synthesized_insights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_synthesized_insights_origin" ON "synthesized_insights" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_severity" ON "system_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_active" ON "system_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_target" ON "system_alerts" USING btree ("target");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_starts" ON "system_alerts" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_system_alerts_origin" ON "system_alerts" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "idx_teaching_principles_category" ON "teaching_principles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_teaching_principles_origin_proposal" ON "teaching_principles" USING btree ("origin_proposal_id");--> statement-breakpoint
CREATE INDEX "idx_suggestion_effectiveness_type" ON "teaching_suggestion_effectiveness" USING btree ("suggestion_type");--> statement-breakpoint
CREATE INDEX "idx_suggestion_effectiveness_student" ON "teaching_suggestion_effectiveness" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_tool_events_session" ON "teaching_tool_events" USING btree ("voice_session_id");--> statement-breakpoint
CREATE INDEX "idx_tool_events_user" ON "teaching_tool_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tool_events_type" ON "teaching_tool_events" USING btree ("tool_type");--> statement-breakpoint
CREATE INDEX "idx_tool_events_language_topic" ON "teaching_tool_events" USING btree ("language","topic");--> statement-breakpoint
CREATE INDEX "idx_tool_events_occurred" ON "teaching_tool_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tlc_lesson" ON "textbook_lesson_content" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_tlc_language" ON "textbook_lesson_content" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_textbook_section_progress_user" ON "textbook_section_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_textbook_section_progress_user_lesson" ON "textbook_section_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_textbook_user_position_user" ON "textbook_user_position" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_textbook_user_position_user_lang" ON "textbook_user_position" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_textbook_visual_assets_chapter" ON "textbook_visual_assets" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "idx_textbook_visual_assets_lesson" ON "textbook_visual_assets" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_textbook_visual_assets_language" ON "textbook_visual_assets" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tool_knowledge_name" ON "tool_knowledge" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "idx_tool_knowledge_type" ON "tool_knowledge" USING btree ("tool_type");--> statement-breakpoint
CREATE INDEX "idx_tool_knowledge_origin_proposal" ON "tool_knowledge" USING btree ("origin_proposal_id");--> statement-breakpoint
CREATE INDEX "idx_topic_competency_user" ON "topic_competency_observations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_topic_competency_language" ON "topic_competency_observations" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_topic_competency_class" ON "topic_competency_observations" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_topic_competency_topic" ON "topic_competency_observations" USING btree ("topic_name");--> statement-breakpoint
CREATE INDEX "idx_topic_competency_status" ON "topic_competency_observations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_topics_type" ON "topics" USING btree ("topic_type");--> statement-breakpoint
CREATE INDEX "idx_topics_category" ON "topics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_parking_items_session" ON "tutor_parking_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_parking_items_unresolved" ON "tutor_parking_items" USING btree ("carry_forward","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tutor_procedures_title" ON "tutor_procedures" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_tutor_procedures_category" ON "tutor_procedures" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_tutor_procedures_trigger" ON "tutor_procedures" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_tutor_procedures_origin_proposal" ON "tutor_procedures" USING btree ("origin_proposal_id");--> statement-breakpoint
CREATE INDEX "idx_session_topics_session" ON "tutor_session_topics" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_topics_status" ON "tutor_session_topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tutor_sessions_conversation" ON "tutor_sessions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_tutor_sessions_user" ON "tutor_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tutor_sessions_class" ON "tutor_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_tutor_sessions_status" ON "tutor_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tutor_sessions_voice" ON "tutor_sessions" USING btree ("voice_session_id");--> statement-breakpoint
CREATE INDEX "idx_tutor_voices_language_gender" ON "tutor_voices" USING btree ("language","gender");--> statement-breakpoint
CREATE INDEX "idx_tutor_voices_role" ON "tutor_voices" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_usage_ledger_user" ON "usage_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_ledger_created" ON "usage_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_ledger_expires" ON "usage_ledger" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_credentials_user_id" ON "user_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_drill_progress_user" ON "user_drill_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_drill_progress_item" ON "user_drill_progress" USING btree ("drill_item_id");--> statement-breakpoint
CREATE INDEX "idx_drill_progress_mastery" ON "user_drill_progress" USING btree ("mastered");--> statement-breakpoint
CREATE INDEX "idx_drill_progress_review" ON "user_drill_progress" USING btree ("next_review_at");--> statement-breakpoint
CREATE INDEX "idx_user_grammar_progress_user" ON "user_grammar_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_grammar_progress_user_lang" ON "user_grammar_progress" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_user_grammar_progress_competency" ON "user_grammar_progress" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "idx_user_language_prefs_user_lang" ON "user_language_preferences" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_lesson_items_lesson" ON "user_lesson_items" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_user_lessons_user" ON "user_lessons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_lessons_date_range" ON "user_lessons" USING btree ("user_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_motivation_alerts_student" ON "user_motivation_alerts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_motivation_alerts_student_lang" ON "user_motivation_alerts" USING btree ("student_id","language");--> statement-breakpoint
CREATE INDEX "idx_motivation_alerts_status" ON "user_motivation_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_motivation_alerts_severity" ON "user_motivation_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_motivation_alerts_type" ON "user_motivation_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_review_items_user_lang" ON "user_review_items" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "idx_review_items_next_review" ON "user_review_items" USING btree ("next_review_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_env_zone" ON "visual_zones" USING btree ("environment_id","zone_key");--> statement-breakpoint
CREATE INDEX "idx_vocab_topics_word" ON "vocabulary_word_topics" USING btree ("vocabulary_word_id");--> statement-breakpoint
CREATE INDEX "idx_vocab_topics_topic" ON "vocabulary_word_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_vocabulary_user_id" ON "vocabulary_words" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_vocabulary_source_conversation" ON "vocabulary_words" USING btree ("source_conversation_id");--> statement-breakpoint
CREATE INDEX "idx_vocabulary_word_type" ON "vocabulary_words" USING btree ("word_type");--> statement-breakpoint
CREATE INDEX "idx_vocabulary_class" ON "vocabulary_words" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vocabulary_unique_word" ON "vocabulary_words" USING btree ("user_id","word","language");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vdds_date" ON "voice_diag_daily_summaries" USING btree ("summary_date");--> statement-breakpoint
CREATE INDEX "idx_vpe_session" ON "voice_pipeline_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_vpe_user_time" ON "voice_pipeline_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_vpe_type" ON "voice_pipeline_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_vpe_type_time" ON "voice_pipeline_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_voice_sessions_user" ON "voice_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_voice_sessions_started" ON "voice_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_voice_sessions_class" ON "voice_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_voice_sessions_test" ON "voice_sessions" USING btree ("is_test_session");--> statement-breakpoint
CREATE INDEX "idx_voice_sessions_tutor_mode" ON "voice_sessions" USING btree ("tutor_mode");--> statement-breakpoint
CREATE INDEX "idx_voice_sessions_environment" ON "voice_sessions" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "idx_wren_calibration_domain" ON "wren_calibration_stats" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_wren_commitments_status" ON "wren_commitments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wren_commitments_priority" ON "wren_commitments" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_wren_commitments_type" ON "wren_commitments" USING btree ("commitment_type");--> statement-breakpoint
CREATE INDEX "idx_wren_commitments_session" ON "wren_commitments" USING btree ("source_session_id");--> statement-breakpoint
CREATE INDEX "idx_wren_commitments_created" ON "wren_commitments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_wren_confidence_domain" ON "wren_confidence_records" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_wren_confidence_stated" ON "wren_confidence_records" USING btree ("stated_confidence");--> statement-breakpoint
CREATE INDEX "idx_wren_confidence_correct" ON "wren_confidence_records" USING btree ("was_correct");--> statement-breakpoint
CREATE INDEX "idx_wren_insights_category" ON "wren_insights" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_wren_insights_created" ON "wren_insights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_wren_insights_used" ON "wren_insights" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "idx_wren_lessons_type" ON "wren_lessons" USING btree ("lesson_type");--> statement-breakpoint
CREATE INDEX "idx_wren_lessons_active" ON "wren_lessons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_wren_resolutions_mistake" ON "wren_mistake_resolutions" USING btree ("mistake_id");--> statement-breakpoint
CREATE INDEX "idx_wren_mistakes_type" ON "wren_mistakes" USING btree ("mistake_type");--> statement-breakpoint
CREATE INDEX "idx_wren_mistakes_severity" ON "wren_mistakes" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_wren_mistakes_status" ON "wren_mistakes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wren_mistakes_component" ON "wren_mistakes" USING btree ("related_component");--> statement-breakpoint
CREATE INDEX "idx_wren_predictions_type" ON "wren_predictions" USING btree ("prediction_type");--> statement-breakpoint
CREATE INDEX "idx_wren_predictions_status" ON "wren_predictions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wren_predictions_confidence" ON "wren_predictions" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_wren_predictions_correct" ON "wren_predictions" USING btree ("was_correct");--> statement-breakpoint
CREATE INDEX "idx_wren_triggers_status" ON "wren_proactive_triggers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wren_triggers_urgency" ON "wren_proactive_triggers" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "idx_wren_triggers_type" ON "wren_proactive_triggers" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_wren_triggers_component" ON "wren_proactive_triggers" USING btree ("related_component");--> statement-breakpoint
CREATE INDEX "idx_wren_notes_session" ON "wren_session_notes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_wren_notes_type" ON "wren_session_notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "idx_wren_notes_priority" ON "wren_session_notes" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_wren_notes_for_next" ON "wren_session_notes" USING btree ("for_next_session");