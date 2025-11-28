-- Migration script to update the incident status check constraint
-- to allow 'accepted' and 'rejected' statuses.
--
-- Run this with: psql -U <username> -d <database> -f migrate_status.sql

-- Drop the old constraint
ALTER TABLE incidents
DROP CONSTRAINT IF EXISTS check_status;

-- Add the new constraint with accepted/rejected
ALTER TABLE incidents
ADD CONSTRAINT check_status
CHECK (status IN ('pending', 'under_review', 'investigating', 'resolved', 'closed', 'accepted', 'rejected'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'check_status';
