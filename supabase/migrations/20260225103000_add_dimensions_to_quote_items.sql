
/*
  # Add width and length to quote_items
  
  1. Changes
    - Add `width` column to `quote_items` table
    - Add `length` column to `quote_items` table
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'quote_items' 
    AND column_name = 'width'
  ) THEN
    ALTER TABLE quote_items ADD COLUMN width numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'quote_items' 
    AND column_name = 'length'
  ) THEN
    ALTER TABLE quote_items ADD COLUMN length numeric DEFAULT NULL;
  END IF;
END $$;
