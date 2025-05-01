-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Systems table
CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  parent_id UUID REFERENCES systems(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System revisions table (for point-in-time history)
CREATE TABLE IF NOT EXISTS system_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  parent_id UUID,
  revision_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interfaces table
CREATE TABLE IF NOT EXISTS interfaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
  target_system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interface revisions table
CREATE TABLE IF NOT EXISTS interface_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interface_id UUID REFERENCES interfaces(id) ON DELETE CASCADE,
  source_system_id UUID,
  target_system_id UUID,
  attributes JSONB,
  revision_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_systems_parent_id ON systems(parent_id);
CREATE INDEX IF NOT EXISTS idx_system_revisions_system_id ON system_revisions(system_id);
CREATE INDEX IF NOT EXISTS idx_interfaces_source_system_id ON interfaces(source_system_id);
CREATE INDEX IF NOT EXISTS idx_interfaces_target_system_id ON interfaces(target_system_id);
CREATE INDEX IF NOT EXISTS idx_interface_revisions_interface_id ON interface_revisions(interface_id);