-- Chat message persistence (per day)
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  parsed_foods jsonb,
  parsed_exercises jsonb,
  food_edits jsonb,
  exercise_edits jsonb,
  saved boolean default false,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;

create policy "Users can read own chat messages"
  on chat_messages for select using (auth.uid() = user_id);

create policy "Users can insert own chat messages"
  on chat_messages for insert with check (auth.uid() = user_id);

create policy "Users can update own chat messages"
  on chat_messages for update using (auth.uid() = user_id);

create index chat_messages_user_date on chat_messages(user_id, date);
