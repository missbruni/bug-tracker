


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_pending_invitations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  inv record;
begin
  for inv in
    select id, team_id, role
    from team_invitations
    where lower(email) = lower(new.email)
      and status = 'pending'
  loop
    insert into team_members (team_id, user_id, role, status)
    values (inv.team_id, new.id, inv.role, 'active')
    on conflict (team_id, user_id) do update
      set role = excluded.role, status = 'active';

    update team_invitations
    set status = 'accepted'
    where id = inv.id;
  end loop;

  return new;
exception when others then
  raise warning 'accept_pending_invitations failed: %', sqlerrm;
  return new;
end;
$$;


ALTER FUNCTION "public"."accept_pending_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_team_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into team_members (team_id, user_id, role, status)
  values (new.id, auth.uid(), 'team_admin', 'active')
  on conflict (team_id, user_id) do update
    set role = 'team_admin', status = 'active';
  return new;
exception when others then
  raise warning 'assign_team_creator failed: %', sqlerrm;
  return new;
end;
$$;


ALTER FUNCTION "public"."assign_team_creator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_users"() RETURNS TABLE("id" "uuid", "email" "text", "display_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    au.id,
    au.email::text,
    coalesce(
      nullif(au.raw_user_meta_data->>'name', ''),
      nullif(au.raw_user_meta_data->>'full_name', ''),
      nullif(au.raw_user_meta_data->>'preferred_username', ''),
      initcap(replace(split_part(au.email::text, '@', 1), '.', ' '))
    ) as display_name
  from auth.users au
  where au.email ilike '%@theaccessgroup.com'
  order by au.email;
$$;


ALTER FUNCTION "public"."get_org_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_app_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from app_owners where user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_app_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin_or_owner"("_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select is_app_owner() or exists (
    select 1 from team_members
    where team_id = _team_id
      and user_id = auth.uid()
      and role = 'team_admin'
      and status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_team_admin_or_owner"("_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from team_members
    where team_id = _team_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_team_member"("_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_tester_on_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.testers t
  set user_id = new.id
  from public.tester_email_mapping tem
  where lower(tem.microsoft_email) = lower(new.email)
    and lower(t.name) = lower(tem.tester_name)
    and t.user_id is null;
  return new;
exception when others then
  raise warning 'link_tester_on_login failed: %', sqlerrm;
  return new;
end;
$$;


ALTER FUNCTION "public"."link_tester_on_login"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_owners" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "scenario_id" "uuid" NOT NULL,
    "tester_id" "uuid" NOT NULL,
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" bigint NOT NULL,
    "bug_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "note" "text",
    "url" "text",
    "type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


ALTER TABLE "public"."attachments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."attachments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bugs" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "tester" "text" DEFAULT 'Unknown'::"text" NOT NULL,
    "device" "text" DEFAULT '—'::"text",
    "page" "text" DEFAULT '—'::"text",
    "severity" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed" boolean DEFAULT false,
    "backlog_url" "text",
    "session_id" "uuid",
    "devin_url" "text",
    "tester_id" "uuid",
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL,
    CONSTRAINT "bugs_severity_check" CHECK (("severity" = ANY (ARRAY['critical'::"text", 'high'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."bugs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" bigint NOT NULL,
    "bug_id" "text" NOT NULL,
    "text" "text" NOT NULL,
    "author" "text",
    "time" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


ALTER TABLE "public"."comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."open_questions" (
    "id" "text" NOT NULL,
    "text" "text" NOT NULL,
    "tester" "text" NOT NULL,
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL
);


ALTER TABLE "public"."open_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "link" "text",
    "links" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "letter" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "device_requirement" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL
);


ALTER TABLE "public"."scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "length_feel" "text" NOT NULL,
    "clarity" integer NOT NULL,
    "helpfulness" "text" NOT NULL,
    "worked_well" "text",
    "to_improve" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL,
    CONSTRAINT "session_feedback_clarity_check" CHECK ((("clarity" >= 1) AND ("clarity" <= 5))),
    CONSTRAINT "session_feedback_helpfulness_check" CHECK (("helpfulness" = ANY (ARRAY['not_at_all'::"text", 'somewhat'::"text", 'very'::"text"]))),
    CONSTRAINT "session_feedback_length_feel_check" CHECK (("length_feel" = ANY (ARRAY['too_short'::"text", 'just_right'::"text", 'too_long'::"text"]))),
    CONSTRAINT "session_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."session_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "date" "date",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL,
    "product_id" "uuid",
    "duration_seconds" integer,
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_invitations_role_check" CHECK (("role" = ANY (ARRAY['team_admin'::"text", 'member'::"text"]))),
    CONSTRAINT "team_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."team_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['team_admin'::"text", 'member'::"text"]))),
    CONSTRAINT "team_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tester_email_mapping" (
    "tester_name" "text" NOT NULL,
    "microsoft_email" "text" NOT NULL
);


ALTER TABLE "public"."tester_email_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "devices" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "uuid" DEFAULT '11111111-1111-1111-1111-111111111111'::"uuid" NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."testers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_owners"
    ADD CONSTRAINT "app_owners_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_session_id_scenario_id_key" UNIQUE ("session_id", "scenario_id");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_questions"
    ADD CONSTRAINT "open_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_team_id_slug_key" UNIQUE ("team_id", "slug");



ALTER TABLE ONLY "public"."scenarios"
    ADD CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_feedback"
    ADD CONSTRAINT "session_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_team_id_email_key" UNIQUE ("team_id", "email");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_organization_id_slug_key" UNIQUE ("organization_id", "slug");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tester_email_mapping"
    ADD CONSTRAINT "tester_email_mapping_microsoft_email_key" UNIQUE ("microsoft_email");



ALTER TABLE ONLY "public"."tester_email_mapping"
    ADD CONSTRAINT "tester_email_mapping_pkey" PRIMARY KEY ("tester_name");



ALTER TABLE ONLY "public"."testers"
    ADD CONSTRAINT "testers_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_assignments_team_id" ON "public"."assignments" USING "btree" ("team_id");



CREATE INDEX "idx_attachments_team_id" ON "public"."attachments" USING "btree" ("team_id");



CREATE INDEX "idx_bugs_team_id" ON "public"."bugs" USING "btree" ("team_id");



CREATE INDEX "idx_bugs_tester_id" ON "public"."bugs" USING "btree" ("tester_id");



CREATE INDEX "idx_comments_team_id" ON "public"."comments" USING "btree" ("team_id");



CREATE INDEX "idx_open_questions_team_id" ON "public"."open_questions" USING "btree" ("team_id");



CREATE INDEX "idx_products_team_id" ON "public"."products" USING "btree" ("team_id");



CREATE INDEX "idx_scenarios_team_id" ON "public"."scenarios" USING "btree" ("team_id");



CREATE INDEX "idx_session_feedback_team_id" ON "public"."session_feedback" USING "btree" ("team_id");



CREATE INDEX "idx_sessions_product_id" ON "public"."sessions" USING "btree" ("product_id");



CREATE INDEX "idx_sessions_team_id" ON "public"."sessions" USING "btree" ("team_id");



CREATE INDEX "idx_team_invitations_email" ON "public"."team_invitations" USING "btree" ("email");



CREATE INDEX "idx_team_invitations_team" ON "public"."team_invitations" USING "btree" ("team_id");



CREATE INDEX "idx_team_members_team" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_members_user" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_testers_team_id" ON "public"."testers" USING "btree" ("team_id");



CREATE INDEX "idx_testers_user_id" ON "public"."testers" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_assign_team_creator" AFTER INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."assign_team_creator"();



ALTER TABLE ONLY "public"."app_owners"
    ADD CONSTRAINT "app_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_tester_id_fkey" FOREIGN KEY ("tester_id") REFERENCES "public"."testers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bugs"
    ADD CONSTRAINT "bugs_tester_id_fkey" FOREIGN KEY ("tester_id") REFERENCES "public"."testers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scenarios"
    ADD CONSTRAINT "scenarios_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_feedback"
    ADD CONSTRAINT "session_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testers"
    ADD CONSTRAINT "testers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Admin or owner delete invitations" ON "public"."team_invitations" FOR DELETE TO "authenticated" USING ("public"."is_team_admin_or_owner"("team_id"));



CREATE POLICY "Admin or owner delete members" ON "public"."team_members" FOR DELETE TO "authenticated" USING ("public"."is_team_admin_or_owner"("team_id"));



CREATE POLICY "Admin or owner delete teams" ON "public"."teams" FOR DELETE TO "authenticated" USING ("public"."is_team_admin_or_owner"("id"));



CREATE POLICY "Admin or owner insert invitations" ON "public"."team_invitations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_team_admin_or_owner"("team_id"));



CREATE POLICY "Admin or owner manage members" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_team_admin_or_owner"("team_id"));



CREATE POLICY "Admin or owner update invitations" ON "public"."team_invitations" FOR UPDATE TO "authenticated" USING ("public"."is_team_admin_or_owner"("team_id"));



CREATE POLICY "Admin or owner update members" ON "public"."team_members" FOR UPDATE TO "authenticated" USING ("public"."is_team_admin_or_owner"("team_id"));



CREATE POLICY "Admin or owner update teams" ON "public"."teams" FOR UPDATE TO "authenticated" USING ("public"."is_team_admin_or_owner"("id"));



CREATE POLICY "Authenticated insert teams" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated read app_owners" ON "public"."app_owners" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated select teams" ON "public"."teams" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Team member select invitations" ON "public"."team_invitations" FOR SELECT TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team member select own team" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped assignments" ON "public"."assignments" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped attachments" ON "public"."attachments" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped bugs" ON "public"."bugs" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped comments" ON "public"."comments" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped open_questions" ON "public"."open_questions" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped products" ON "public"."products" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped scenarios" ON "public"."scenarios" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped session_feedback" ON "public"."session_feedback" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped sessions" ON "public"."sessions" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



CREATE POLICY "Team scoped testers" ON "public"."testers" TO "authenticated" USING (("public"."is_app_owner"() OR "public"."is_team_member"("team_id"))) WITH CHECK (("public"."is_app_owner"() OR "public"."is_team_member"("team_id")));



ALTER TABLE "public"."app_owners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bugs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scenarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tester_email_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."attachments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bugs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_pending_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."accept_pending_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_pending_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_team_creator"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_team_creator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_team_creator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_app_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_app_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_app_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_admin_or_owner"("_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_admin_or_owner"("_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin_or_owner"("_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_tester_on_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_tester_on_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_tester_on_login"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_owners" TO "anon";
GRANT ALL ON TABLE "public"."app_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."app_owners" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."attachments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."attachments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."attachments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bugs" TO "anon";
GRANT ALL ON TABLE "public"."bugs" TO "authenticated";
GRANT ALL ON TABLE "public"."bugs" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."open_questions" TO "anon";
GRANT ALL ON TABLE "public"."open_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."open_questions" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."scenarios" TO "anon";
GRANT ALL ON TABLE "public"."scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."session_feedback" TO "anon";
GRANT ALL ON TABLE "public"."session_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."session_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."team_invitations" TO "anon";
GRANT ALL ON TABLE "public"."team_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."tester_email_mapping" TO "anon";
GRANT ALL ON TABLE "public"."tester_email_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."tester_email_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."testers" TO "anon";
GRANT ALL ON TABLE "public"."testers" TO "authenticated";
GRANT ALL ON TABLE "public"."testers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER trg_accept_pending_invitations AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.accept_pending_invitations();

CREATE TRIGGER trg_link_tester_on_login AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.link_tester_on_login();


  create policy "Authenticated delete attachments"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'attachments'::text));



  create policy "Authenticated upload attachments"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'attachments'::text));



  create policy "Public read attachments"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'attachments'::text));



