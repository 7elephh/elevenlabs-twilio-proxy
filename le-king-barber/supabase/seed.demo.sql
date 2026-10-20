-- DONNÉES DE DÉMONSTRATION — à remplacer depuis l'espace /admin avant une mise en service réelle.
-- Seul le tarif « Coupe + barbe : 20 € » provient du salon ; les autres valeurs
-- (durées, prestations, horaires) sont des exemples destinés à la présentation.

insert into public.services (name, description, price_cents, duration_minutes, is_active, sort_order) values
  ('Coupe + barbe', 'Coupe sur mesure et taille de barbe précise, finitions soignées.', 2000, 45, true, 1),
  ('Coupe', 'Coupe aux ciseaux ou à la tondeuse, adaptée à votre style.', 1500, 30, true, 2),
  ('Taille de barbe', 'Mise en forme, contours nets et soin.', 1000, 20, true, 3);

-- Mardi à samedi, 9h30–12h30 puis 14h–19h (pause déjeuner)
insert into public.business_hours (weekday, opens_at, closes_at)
select d, t.o::time, t.c::time
from generate_series(2, 6) d
cross join (values ('09:30', '12:30'), ('14:00', '19:00')) as t(o, c);

update public.business_settings set
  hero_subtitle = 'Coupe, barbe et soin dans un salon pensé pour l''homme moderne.',
  about_title = 'Une maison de grooming',
  about_text = 'Chez Le King Barber, chaque rendez-vous est un moment pour soi. Un diagnostic attentif, des gestes précis et des finitions nettes : le style se construit avec méthode, sans précipitation.',
  experience_text = 'Accueil, conseil, coupe et finitions : une expérience calme et maîtrisée, du premier échange au dernier détail.'
where id = 1;
