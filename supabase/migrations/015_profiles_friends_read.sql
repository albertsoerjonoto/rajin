-- Allow users to read profiles of people they share a friendship with
-- (pending, accepted, or declined). This fixes the bug where friend names
-- show as "User" because RLS blocks reading other users' profiles.
CREATE POLICY "Users can view friend profiles" ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.requester_id = auth.uid() AND f.addressee_id = profiles.id)
         OR (f.addressee_id = auth.uid() AND f.requester_id = profiles.id)
    )
  );
