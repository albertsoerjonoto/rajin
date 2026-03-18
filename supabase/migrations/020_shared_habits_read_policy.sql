-- Allow friends to read habits that are shared with them
-- This fixes: shared habit invitations showing blank name/emoji,
-- and accepted shared habits appearing without details
CREATE POLICY "Friends can view shared habits" ON habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_habits sh
      WHERE sh.habit_id = habits.id
      AND (sh.friend_id = auth.uid() OR sh.owner_id = auth.uid())
    )
  );
