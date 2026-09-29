-- Bookings occupy calendar nights, with check-out exclusive. Existing timestamp
-- values are converted to their calendar date before the overlap rule is added.
ALTER TABLE "Booking"
  ALTER COLUMN "checkIn" TYPE DATE USING "checkIn"::date,
  ALTER COLUMN "checkOut" TYPE DATE USING "checkOut"::date;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- This is the final authority for concurrent writes and direct SQL inserts.
-- Deploys fail safely if pre-existing active bookings overlap; resolve those rows
-- before retrying rather than silently cancelling or changing a reservation.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_room_stay_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));
