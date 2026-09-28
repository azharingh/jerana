-- JerAna: add / update accepted waste types
-- Run in Supabase → SQL Editor (safe if rows already exist — skips duplicate names)

create unique index if not exists waste_types_name_key on public.waste_types (name);

insert into public.waste_types (name, description, rate_gems, is_active)
select v.name, v.description, v.rate_gems, true
from (values
  ('Овощные очистки', 'Кожура картофеля, моркови, лука, капусты и других овощей', 8),
  ('Фруктовые очистки', 'Кожура яблок, груш, бананов, цитрусовых', 10),
  ('Садовые отходы', 'Скошенная трава, листья, цветы, мелкие ветки без лака', 6),
  ('Кофейная гуща', 'Использованный молотый кофе и фильтры без пластика', 12),
  ('Чайная заварка', 'Заварка и чайные листья, пакетики только без металлической скобы', 8),
  ('Яичная скорлупа', 'Промытая и слегка измельчённая скорлупа', 9),
  ('Хлеб и сухари', 'Несолёный хлеб, сухари, сухое печенье без начинки и глазури', 7),
  ('Каши и крупы (варёные)', 'Остатки без масла, мяса и соусов — рис, гречка, овсянка', 7),
  ('Ореховая скорлупа', 'Скорлупа грецкого ореха, фундука, миндаля (не кокос)', 6),
  ('Комнатные растения', 'Увядшие листья и обрезки домашних растений без болезней', 8),
  ('Сено и солома', 'Небольшие объёмы сена, соломы, лузги подсолнечника', 5),
  ('Картон и бумага', 'Рваный картон, неклееная бумага, бумажные салфетки без печати', 6),
  ('Древесная зола', 'Пепел от чистого древесного угля или дров — тонкий слой', 4)
) as v(name, description, rate_gems)
where not exists (
  select 1 from public.waste_types w where w.name = v.name
);

-- Optional: deactivate a type without deleting history
-- update public.waste_types set is_active = false where name = '...';
