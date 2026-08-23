-- Auth signup defaults: profile, preferences, and default categories.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, type, color, icon, is_default)
  values
    (new.id, 'Salary', 'income', '#00D68F', 'wallet', true),
    (new.id, 'Bonus', 'income', '#00C26E', 'badge-dollar-sign', true),
    (new.id, 'Other Income', 'income', '#22C55E', 'plus-circle', true),
    (new.id, 'Housing', 'expense', '#EF4444', 'home', true),
    (new.id, 'Food', 'expense', '#F97316', 'utensils', true),
    (new.id, 'Transportation', 'expense', '#F59E0B', 'car', true),
    (new.id, 'Utilities', 'expense', '#EAB308', 'bolt', true),
    (new.id, 'Entertainment', 'expense', '#EC4899', 'ticket', true),
    (new.id, 'Healthcare', 'expense', '#14B8A6', 'heart-pulse', true),
    (new.id, 'Subscriptions', 'expense', '#8B5CF6', 'repeat', true),
    (new.id, 'Miscellaneous', 'expense', '#64748B', 'more-horizontal', true),
    (new.id, 'Emergency Fund', 'savings', '#3B82F6', 'shield', true),
    (new.id, 'Investments', 'savings', '#2563EB', 'trending-up', true),
    (new.id, 'Vacation', 'savings', '#06B6D4', 'plane', true),
    (new.id, 'General Savings', 'savings', '#0EA5E9', 'piggy-bank', true),
    (new.id, 'Credit Card', 'debt', '#F59E0B', 'credit-card', true),
    (new.id, 'Student Loan', 'debt', '#D97706', 'graduation-cap', true),
    (new.id, 'Personal Loan', 'debt', '#B45309', 'landmark', true),
    (new.id, 'Mortgage', 'debt', '#92400E', 'home', true),
    (new.id, 'Auto Loan', 'debt', '#78350F', 'car', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
