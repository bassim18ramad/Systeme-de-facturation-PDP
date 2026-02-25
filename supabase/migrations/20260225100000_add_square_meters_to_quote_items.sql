
/*
  # Add square_meters to quote_items
  
  1. Changes
    - Add `square_meters` column to `quote_items` table
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'quote_items' 
    AND column_name = 'square_meters'
  ) THEN
    ALTER TABLE quote_items ADD COLUMN square_meters numeric DEFAULT NULL;
  END IF;
END $$;
