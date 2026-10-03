-- Membership & loyalty economics — reprice plans and rewards so neither can
-- cost the house money (see lib/ecosystem/economics.ts, `npm run test:membership`).
--
--   · Points: 1 per LKR 10 of table time; a point costs us LKR 0.50, so each
--     reward is sold for at least (its cost ÷ 0.5) points.
--   · Paid plans: discount + bonus points apply to a capped amount of table
--     time each month, so the most a member can get back is below the fee.
--
-- Overwrites the benefits/pricing of the three plans and the cost of the six
-- seeded rewards. If you have edited those in the admin console, review first.
-- Idempotent:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-04-membership-economics.sql

UPDATE membership_plans SET
  price = 0, discount_pct = 0, loyalty_multiplier = 1,
  tagline = 'Free. Your Cue Point account.',
  benefits = '["Book tables online","Player profile with your stats and match history","A place on the rankings","1 point for every LKR 10 of table time"]'
WHERE id = 'basic';

UPDATE membership_plans SET
  price = 1500, discount_pct = 10, loyalty_multiplier = 1.5,
  tagline = 'For regulars who play most weeks.',
  benefits = '["10% off table time","1.5× points on table time","Pro badge on your player profile","Everything in Basic"]'
WHERE id = 'pro';

UPDATE membership_plans SET
  price = 3500, discount_pct = 18, loyalty_multiplier = 2,
  tagline = 'For players who are here all the time.',
  benefits = '["18% off table time","2× points on table time","Elite badge on your player profile","Everything in Basic"]'
WHERE id = 'elite';

UPDATE rewards SET cost = 800,  name = '30 minutes free play', description = 'On any table' WHERE id = 'rw_play30';
UPDATE rewards SET cost = 1600, name = '1 hour free play', description = 'On any table' WHERE id = 'rw_play60';
UPDATE rewards SET cost = 1000, name = 'Snack pack', description = 'A Milo and a pack of cassava chips' WHERE id = 'rw_food';
UPDATE rewards SET cost = 750,  description = 'One booking, up to 3 hours' WHERE id = 'rw_disc15';
UPDATE rewards SET cost = 3000, description = 'LKR 1,500 toward any entry fee' WHERE id = 'rw_tourney';
UPDATE rewards SET cost = 3000 WHERE id = 'rw_merch';
