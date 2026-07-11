-- Store free-text clarification answers separately from approve/reject status.
ALTER TABLE pending_confirmations ADD COLUMN answer_text TEXT;
