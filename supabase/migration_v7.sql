-- Migration v7: sync paid payments into the accounting ledger
alter table acc_transactions
  add column if not exists payment_id uuid unique references payments(id) on delete cascade;

create or replace function sync_payment_to_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  if new.status = 'paid' then
    select name into cname from clients where id = new.client_id;
    insert into acc_transactions (payment_id, tx_date, kind, category, description, amount, method, client_id)
    values (new.id, coalesce(new.paid_date, current_date), 'income', 'Client payment',
            coalesce(cname,'Client') || ' — ' || new.period, new.amount, 'bank', new.client_id)
    on conflict (payment_id) do update
      set tx_date = excluded.tx_date, amount = excluded.amount,
          description = excluded.description, client_id = excluded.client_id;
  elsif old.status = 'paid' and new.status is distinct from 'paid' then
    delete from acc_transactions where payment_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_payment_ledger on payments;
create trigger trg_sync_payment_ledger
  after insert or update of status, amount, paid_date on payments
  for each row execute function sync_payment_to_ledger();

-- Backfill: existing paid payments not yet in the ledger
insert into acc_transactions (payment_id, tx_date, kind, category, description, amount, method, client_id)
select p.id, coalesce(p.paid_date, current_date), 'income', 'Client payment',
       coalesce(c.name,'Client') || ' — ' || p.period, p.amount, 'bank', p.client_id
from payments p left join clients c on c.id = p.client_id
where p.status = 'paid'
  and not exists (select 1 from acc_transactions t where t.payment_id = p.id);

notify pgrst, 'reload schema';
