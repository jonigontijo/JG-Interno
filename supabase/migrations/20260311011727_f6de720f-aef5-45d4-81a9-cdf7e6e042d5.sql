
ALTER TABLE client_team_assignments 
ADD CONSTRAINT unique_client_member UNIQUE (client_id, member_id);
