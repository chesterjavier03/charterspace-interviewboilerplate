-- Function to begin a transaction
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
END;
$$;

-- Function to commit a transaction
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Commit transaction
  EXECUTE 'COMMIT';
END;
$$;

-- Function to rollback a transaction
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Rollback transaction
  EXECUTE 'ROLLBACK';
END;
$$;

-- Function to create a system with a revision in one transaction
CREATE OR REPLACE FUNCTION create_system_with_revision(
  system_name TEXT,
  system_category TEXT,
  system_parent_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_system_id UUID;
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
  
  -- Generate new UUID
  new_system_id := gen_random_uuid();
  
  -- Insert into systems table
  INSERT INTO systems(id, name, category, parent_id, created_at, updated_at)
  VALUES (new_system_id, system_name, system_category, system_parent_id, NOW(), NOW());
  
  -- Insert into system_revisions table
  INSERT INTO system_revisions(system_id, name, category, parent_id, revision_timestamp)
  VALUES (new_system_id, system_name, system_category, system_parent_id, NOW());
  
  -- Commit transaction
  COMMIT;
  
  RETURN new_system_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction
    EXECUTE 'ROLLBACK';
    RAISE;
END;
$$;

-- Function to update a system with a revision in one transaction
CREATE OR REPLACE FUNCTION update_system_with_revision(
  system_id UUID,
  system_name TEXT,
  system_category TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_parent_id UUID;
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
  
  -- Get current parent_id
  SELECT parent_id INTO current_parent_id FROM systems WHERE id = system_id;
  
  -- Update systems table
  UPDATE systems
  SET name = system_name,
      category = system_category,
      updated_at = NOW()
  WHERE id = system_id;
  
  -- Insert into system_revisions table
  INSERT INTO system_revisions(system_id, name, category, parent_id, revision_timestamp)
  VALUES (system_id, system_name, system_category, current_parent_id, NOW());
  
  -- Commit transaction
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction
    EXECUTE 'ROLLBACK';
    RAISE;
END;
$$;

-- Function to delete a system with its revision in one transaction
CREATE OR REPLACE FUNCTION delete_system_with_revision(
  system_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_system RECORD;
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
  
  -- Get current system data
  SELECT * INTO current_system FROM systems WHERE id = system_id;
  
  -- Insert into system_revisions table
  INSERT INTO system_revisions(system_id, name, category, parent_id, revision_timestamp)
  VALUES (current_system.id, current_system.name, current_system.category, current_system.parent_id, NOW());
  
  -- Delete from systems table
  DELETE FROM systems WHERE id = system_id;
  
  -- Commit transaction
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction
    EXECUTE 'ROLLBACK';
    RAISE;
END;
$$;

-- Interface transaction functions
CREATE OR REPLACE FUNCTION create_interface_with_revision(
  interface_source_id UUID,
  interface_target_id UUID,
  interface_attributes JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_interface_id UUID;
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
  
  -- Generate new UUID
  new_interface_id := gen_random_uuid();
  
  -- Insert into interfaces table
  INSERT INTO interfaces(id, source_system_id, target_system_id, attributes, created_at, updated_at)
  VALUES (new_interface_id, interface_source_id, interface_target_id, interface_attributes, NOW(), NOW());
  
  -- Insert into interface_revisions table
  INSERT INTO interface_revisions(interface_id, source_system_id, target_system_id, attributes, revision_timestamp)
  VALUES (new_interface_id, interface_source_id, interface_target_id, interface_attributes, NOW());
  
  -- Commit transaction
  EXECUTE 'COMMIT';
  
  RETURN new_interface_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction
    EXECUTE 'ROLLBACK';
    RAISE;
END;
$$;

-- Function to update an interface with a revision in one transaction
CREATE OR REPLACE FUNCTION update_interface_with_revision(
  interface_id UUID,
  interface_source_id UUID,
  interface_target_id UUID,
  interface_attributes JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
  
  -- Update interfaces table
  UPDATE interfaces
  SET source_system_id = interface_source_id,
      target_system_id = interface_target_id,
      attributes = interface_attributes,
      updated_at = NOW()
  WHERE id = interface_id;
  
  -- Insert into interface_revisions table
  INSERT INTO interface_revisions(interface_id, source_system_id, target_system_id, attributes, revision_timestamp)
  VALUES (interface_id, interface_source_id, interface_target_id, interface_attributes, NOW());
  
  -- Commit transaction
  EXECUTE 'COMMIT';
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction
    EXECUTE 'ROLLBACK';
    RAISE;
END;
$$;

-- Function to delete an interface with its revision in one transaction
CREATE OR REPLACE FUNCTION delete_interface_with_revision(
  interface_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_interface RECORD;
BEGIN
  -- Begin transaction
  EXECUTE 'BEGIN';
  
  -- Get current interface data
  SELECT * INTO current_interface FROM interfaces WHERE id = interface_id;
  
  -- Insert into interface_revisions table
  INSERT INTO interface_revisions(interface_id, source_system_id, target_system_id, attributes, revision_timestamp)
  VALUES (current_interface.id, current_interface.source_system_id, current_interface.target_system_id, current_interface.attributes, NOW());
  
  -- Delete from interfaces table
  DELETE FROM interfaces WHERE id = interface_id;
  
  -- Commit transaction
  EXECUTE 'COMMIT';
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction
    EXECUTE 'ROLLBACK';
    RAISE;
END;
$$;