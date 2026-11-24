-- Multi-box: an account pairs several boxes, told apart by agent.label (set by
-- the relay at pairing, renamed from the Deck through the relay). The relay
-- sanitizes it; this bounds it in the database too. Apply after 0005 and 0006:
-- 0005 is what keeps owners from writing agent rows (label, revoked_at) directly.

do $$ begin
  alter table public.agent add constraint agent_label_len check (char_length(label) <= 64);
exception when duplicate_object then null; end $$;
