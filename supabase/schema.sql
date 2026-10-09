-- =====================================================================
--  బాల వ్యాకరణము — consolidated schema
--  Run this once in the Supabase SQL editor of a fresh project.
-- =====================================================================

-- pgvector for the embeddings -----------------------------------------
create extension if not exists vector;

-- ---------------------------------------------------------------------
-- 1. Structured scrape of the grammar
-- ---------------------------------------------------------------------
create table if not exists public.bala_vyakarana_document (
  id        integer primary key default 1,
  work      jsonb,
  stats     jsonb,
  contents  jsonb
);

create table if not exists public.bala_vyakarana_paricchedas (
  id              text primary key,          -- slug, e.g. 'saMdhi'
  ord             integer,
  title_te        text,
  title_translit  text,
  title_en        text,
  url             text,
  sutra_count     integer,
  headings        jsonb,
  items           jsonb
);

create table if not exists public.bala_vyakarana_items (
  id                bigint generated always as identity primary key,
  pariccheda_id     text references public.bala_vyakarana_paricchedas(id),
  item_order        integer,
  type              text,      -- 'sutra' | 'heading' | 'verse' | 'paragraph'
  sutra_number      integer,
  sutra_number_raw  text,
  title             text,
  text              text,
  examples          jsonb
);

create index if not exists bala_vyakarana_items_pariccheda_idx
  on public.bala_vyakarana_items(pariccheda_id);

-- ---------------------------------------------------------------------
-- 2. Unified RAG corpus: one row per retrievable chunk.
--    source = 'bala_vyakarana'  -> one sutra
--    source = 'pdf'             -> one chunk of a commentary page
-- ---------------------------------------------------------------------
create table if not exists public.bala_vyakarana_chunks (
  id             bigint generated always as identity primary key,
  item_id        bigint references public.bala_vyakarana_items(id) on delete cascade,
  pariccheda_id  text,
  chapter_title  text,
  sutra_number   integer,
  content        text not null,
  embedding      vector(768),                -- gemini-embedding-001 @ 768 dims
  created_at     timestamptz not null default now(),
  source         text not null default 'bala_vyakarana',
  doc            text,                        -- book / chapter title
  ref            text                         -- 'sutra 12' | 'page 34'
);

create index if not exists bala_vyakarana_chunks_item_idx
  on public.bala_vyakarana_chunks(item_id);

create index if not exists bala_vyakarana_chunks_source_idx
  on public.bala_vyakarana_chunks(source);

create index if not exists bala_vyakarana_chunks_embedding_idx
  on public.bala_vyakarana_chunks using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- 3. Retrieval
-- ---------------------------------------------------------------------
create or replace function public.match_rag(
  query_embedding vector(768),
  match_count     integer default 8,
  source_filter   text    default null       -- 'pdf' | 'bala_vyakarana' | null
) returns table (
  id bigint, source text, doc text, ref text, content text, similarity double precision
) language sql stable as $$
  select c.id, c.source, c.doc, c.ref, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.bala_vyakarana_chunks c
  where c.embedding is not null
    and (source_filter is null or c.source = source_filter)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

-- Bulk write of vectors (used by bala-embed and the CLI).
-- payload = [{"id": 123, "embedding": "[0.1,0.2,...]"}, ...]
create or replace function public.set_chunk_embeddings(payload jsonb)
returns integer
language plpgsql
as $$
declare n integer;
begin
  with data as (
    select (e->>'id')::bigint as id, (e->>'embedding')::vector as embedding
    from jsonb_array_elements(payload) as e
  )
  update public.bala_vyakarana_chunks c
  set embedding = d.embedding
  from data d
  where c.id = d.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 4. Optional: lock things down
--    (left commented — enabling RLS without policies blocks all access)
-- ---------------------------------------------------------------------
-- alter table public.bala_vyakarana_chunks      enable row level security;
-- alter table public.bala_vyakarana_items       enable row level security;
-- alter table public.bala_vyakarana_paricchedas enable row level security;
-- alter table public.bala_vyakarana_document    enable row level security;
