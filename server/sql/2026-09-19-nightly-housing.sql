-- Run before starting the new API only when DB_SYNCHRONIZE=false.
-- Legacy rows keep their identifiers and room IDs. The API fills their night
-- from WEDDING_DATE during bootstrap, before accepting requests.
BEGIN;
LOCK TABLE "room_guests" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "room_guests" ADD COLUMN IF NOT EXISTS "night" date;

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'room_guests'::regclass AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1 AND a.attname = 'guestId'
  LOOP
    EXECUTE format('ALTER TABLE "room_guests" DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'room_guests'::regclass
    AND conname = 'UQ_room_guests_person_night') THEN
    ALTER TABLE "room_guests" ADD CONSTRAINT "UQ_room_guests_person_night" UNIQUE ("guestId", "night");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "housing_stays" (
  "guestId" text PRIMARY KEY,
  "arrivalDate" date NOT NULL,
  "departureDate" date NOT NULL
);
COMMIT;
