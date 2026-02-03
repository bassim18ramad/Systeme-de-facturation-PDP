/*
  # Add TVA and Stamp Duty to Quotes

  1. Changes
    - Add `include_tva` column to `quotes` table
    - Add `stamp_duty` column to `quotes` table
*/

ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS include_tva boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stamp_duty numeric DEFAULT 0;
