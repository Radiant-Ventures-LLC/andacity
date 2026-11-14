-- Allow trip items sourced from an external supplier (e.g. Duffel), which have
-- no row in the seeded inventory tables. A trip item still may only reference
-- the inventory table of its own vertical; that reference is now optional.
ALTER TABLE andacity_app.trip_items DROP CONSTRAINT IF EXISTS trip_items_inventory_ref_ck;
--> statement-breakpoint
ALTER TABLE andacity_app.trip_items ADD CONSTRAINT trip_items_inventory_ref_ck CHECK ((
  item_type = 'hotel' AND flight_itinerary_id IS NULL AND car_inventory_id IS NULL
) OR (
  item_type = 'flight' AND hotel_id IS NULL AND car_inventory_id IS NULL
) OR (
  item_type = 'car' AND hotel_id IS NULL AND flight_itinerary_id IS NULL
));
