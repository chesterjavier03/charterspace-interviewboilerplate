/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Interface {
  id: string;
  source_system_id: string;
  target_system_id: string;
  attributes: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface System {
  id: string;
  name: string;
  category?: string;
}

interface InterfacePanelProps {
  systemId: string | null;
  onInterfaceUpdate: () => void;
}

export default function InterfacePanel({
  systemId,
  onInterfaceUpdate,
}: InterfacePanelProps) {
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    source_system_id: '',
    target_system_id: '',
    attributes: {},
  });

  const [attributeKey, setAttributeKey] = useState('');
  const [attributeValue, setAttributeValue] = useState('');

  // Fetch interfaces and available systems
  const fetchInterfaces = useCallback(async () => {
    console.debug('Fetching interfaces for system:', systemId);
    if (!systemId) {
      setInterfaces([]);
      return;
    }

    setIsLoading(true);

    try {
      // Get current system and all its descendants
      const getAllDescendantIds = async (
        parentId: string
      ): Promise<string[]> => {
        const { data, error } = await supabase
          .from('systems')
          .select('id')
          .eq('parent_id', parentId);

        if (error) throw error;

        if (!data || data.length === 0) return [];

        const directChildIds = data.map((child) => child.id);
        const nestedChildIds = await Promise.all(
          directChildIds.map((id) => getAllDescendantIds(id))
        );

        return [...directChildIds, ...nestedChildIds.flat()];
      };

      const descendantIds = await getAllDescendantIds(systemId);
      const allSystemIds = [systemId, ...descendantIds];

      // Get interfaces where these systems are source or target
      const { data: interfaceData, error: interfaceError } = await supabase
        .from('interfaces')
        .select('*')
        .or(
          `source_system_id.in.(${allSystemIds.join(
            ','
          )}),target_system_id.in.(${allSystemIds.join(',')})`
        );

      if (interfaceError) {
        console.error('Error fetching interfaces:', interfaceError);
        return;
      }

      setInterfaces(interfaceData || []);

      // Fetch all systems for the dropdowns
      const { data: systemsData, error: systemsError } = await supabase
        .from('systems')
        .select('id, name, category');

      if (systemsError) {
        console.error('Error fetching systems:', systemsError);
        return;
      }

      setSystems(systemsData || []);
    } catch (error) {
      console.error('Error in fetchInterfaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [systemId]);

  useEffect(() => {
    fetchInterfaces();
  }, [fetchInterfaces, systemId]);

  // Execute transaction for interface operations
  const executeTransaction = async (callback: () => Promise<any>) => {
    try {
      // Begin transaction
      await supabase.rpc('begin_transaction');

      // Execute the callback with transaction context
      const result = await callback();

      // Commit transaction
      await supabase.rpc('commit_transaction');

      return result;
    } catch (error) {
      // Rollback on error
      await supabase.rpc('rollback_transaction');
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  // Handle form changes
  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Add attribute to the form
  const handleAddAttribute = () => {
    if (!attributeKey.trim()) return;

    setFormData((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attributeKey]: attributeValue,
      },
    }));

    setAttributeKey('');
    setAttributeValue('');
  };

  // Remove attribute from the form
  const handleRemoveAttribute = (key: string) => {
    setFormData((prev) => {
      const newAttributes = { ...prev.attributes } as Record<string, unknown>;
      delete newAttributes[key];
      return { ...prev, attributes: newAttributes };
    });
  };

  // Create new interface
  const handleCreateInterface = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.source_system_id === formData.target_system_id) {
      alert('Source and target systems cannot be the same');
      return;
    }

    try {
      await executeTransaction(async () => {
        // Generate new UUID for the interface
        const newInterfaceId = crypto.randomUUID();

        // Insert into interfaces table
        const { error } = await supabase.from('interfaces').insert({
          id: newInterfaceId,
          source_system_id: formData.source_system_id,
          target_system_id: formData.target_system_id,
          attributes: formData.attributes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        // Create interface revision
        const { error: revisionError } = await supabase
          .from('interface_revisions')
          .insert({
            interface_id: newInterfaceId,
            source_system_id: formData.source_system_id,
            target_system_id: formData.target_system_id,
            attributes: formData.attributes,
            revision_timestamp: new Date().toISOString(),
          });

        if (revisionError) throw revisionError;
      });

      // Reset form and state
      setFormData({
        source_system_id: '',
        target_system_id: '',
        attributes: {},
      });
      setIsCreating(false);
      fetchInterfaces();
      onInterfaceUpdate();
    } catch (error) {
      console.error('Error creating interface:', error);
    }
  };

  // Update interface
  const handleUpdateInterface = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditing) return;

    if (formData.source_system_id === formData.target_system_id) {
      alert('Source and target systems cannot be the same');
      return;
    }

    try {
      await executeTransaction(async () => {
        // Update the interfaces table
        const { error } = await supabase
          .from('interfaces')
          .update({
            source_system_id: formData.source_system_id,
            target_system_id: formData.target_system_id,
            attributes: formData.attributes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', isEditing);

        if (error) throw error;

        // Create interface revision
        const { error: revisionError } = await supabase
          .from('interface_revisions')
          .insert({
            interface_id: isEditing,
            source_system_id: formData.source_system_id,
            target_system_id: formData.target_system_id,
            attributes: formData.attributes,
            revision_timestamp: new Date().toISOString(),
          });

        if (revisionError) throw revisionError;
      });

      // Reset form and state
      setFormData({
        source_system_id: '',
        target_system_id: '',
        attributes: {},
      });
      setIsEditing(null);
      fetchInterfaces();
      onInterfaceUpdate();
    } catch (error) {
      console.error('Error updating interface:', error);
    }
  };

  // Delete interface
  const handleDeleteInterface = async (interfaceId: string) => {
    if (!confirm('Are you sure you want to delete this interface?')) {
      return;
    }

    try {
      await executeTransaction(async () => {
        // Get the interface data first to store in revision
        const { data: interfaceData, error: fetchError } = await supabase
          .from('interfaces')
          .select('*')
          .eq('id', interfaceId)
          .single();

        if (fetchError) throw fetchError;

        // Create interface revision record before deletion
        const { error: revisionError } = await supabase
          .from('interface_revisions')
          .insert({
            interface_id: interfaceId,
            source_system_id: interfaceData.source_system_id,
            target_system_id: interfaceData.target_system_id,
            attributes: interfaceData.attributes,
            revision_timestamp: new Date().toISOString(),
          });

        if (revisionError) throw revisionError;

        // Delete the interface
        const { error: deleteError } = await supabase
          .from('interfaces')
          .delete()
          .eq('id', interfaceId);

        if (deleteError) throw deleteError;
      });

      fetchInterfaces();
      onInterfaceUpdate();
    } catch (error) {
      console.error('Error deleting interface:', error);
    }
  };

  // Start editing an interface
  const handleStartEditing = (interfaceObj: Interface) => {
    setFormData({
      source_system_id: interfaceObj.source_system_id,
      target_system_id: interfaceObj.target_system_id,
      attributes: interfaceObj.attributes || {},
    });
    setIsEditing(interfaceObj.id);
  };

  // Find system name by ID
  const getSystemName = (id: string) => {
    const system = systems.find((s) => s.id === id);
    return system ? system.name : 'Unknown System';
  };

  if (!systemId) {
    return (
      <div className='p-4 bg-white rounded shadow'>
        <h2 className='text-xl font-bold mb-4'>Interfaces</h2>
        <p>Select a system to view interfaces</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='p-4 bg-white rounded shadow'>
        <h2 className='text-xl font-bold mb-4'>Interfaces</h2>
        <p>Loading interfaces...</p>
      </div>
    );
  }

  return (
    <div className='p-4 bg-white rounded shadow'>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-xl font-bold'>Interfaces</h2>
        {!isCreating && !isEditing && (
          <button
            onClick={() => setIsCreating(true)}
            className='px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm'
          >
            Add Interface
          </button>
        )}
      </div>

      {/* Interface Form (Create/Edit) */}
      {(isCreating || isEditing) && (
        <form
          onSubmit={isCreating ? handleCreateInterface : handleUpdateInterface}
          className='mb-6 p-4 border border-gray-200 rounded bg-gray-50'
        >
          <h3 className='font-medium mb-3'>
            {isCreating ? 'Create New Interface' : 'Edit Interface'}
          </h3>

          <div className='space-y-4 mb-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Source System:
              </label>
              <select
                name='source_system_id'
                value={formData.source_system_id}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded'
                required
              >
                <option value=''>Select Source System</option>
                {systems.map((system) => (
                  <option key={`source-${system.id}`} value={system.id}>
                    {system.name}{' '}
                    {system.category ? `(${system.category})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Target System:
              </label>
              <select
                name='target_system_id'
                value={formData.target_system_id}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded'
                required
              >
                <option value=''>Select Target System</option>
                {systems.map((system) => (
                  <option key={`target-${system.id}`} value={system.id}>
                    {system.name}{' '}
                    {system.category ? `(${system.category})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Attributes section */}
          <div className='mb-4'>
            <h4 className='font-medium mb-2'>Interface Attributes</h4>

            {/* Current attributes */}
            {Object.keys(formData.attributes).length > 0 && (
              <div className='mb-4'>
                <h5 className='text-sm font-medium mb-2'>
                  Current Attributes:
                </h5>
                <ul className='space-y-2'>
                  {Object.entries(formData.attributes).map(([key, value]) => (
                    <li
                      key={key}
                      className='flex items-center justify-between p-2 bg-white rounded border border-gray-200'
                    >
                      <div>
                        <span className='font-medium'>{key}:</span>{' '}
                        {String(value)}
                      </div>
                      <button
                        type='button'
                        onClick={() => handleRemoveAttribute(key)}
                        className='text-red-500 hover:text-red-700'
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add new attribute */}
            <div className='flex space-x-2 mb-2'>
              <input
                type='text'
                placeholder='Attribute Name'
                value={attributeKey}
                onChange={(e) => setAttributeKey(e.target.value)}
                className='flex-1 px-3 py-2 border border-gray-300 rounded'
              />
              <input
                type='text'
                placeholder='Attribute Value'
                value={attributeValue}
                onChange={(e) => setAttributeValue(e.target.value)}
                className='flex-1 px-3 py-2 border border-gray-300 rounded'
              />
              <button
                type='button'
                onClick={handleAddAttribute}
                className='px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
              >
                Add
              </button>
            </div>
          </div>

          <div className='flex space-x-2'>
            <button
              type='submit'
              className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
            >
              {isCreating ? 'Create Interface' : 'Update Interface'}
            </button>
            <button
              type='button'
              onClick={() => {
                setIsCreating(false);
                setIsEditing(null);
                setFormData({
                  source_system_id: '',
                  target_system_id: '',
                  attributes: {},
                });
              }}
              className='px-4 py-2 bg-gray-300 rounded hover:bg-gray-400'
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Interface List */}
      {interfaces.length === 0 ? (
        <p className='text-gray-500'>No interfaces found</p>
      ) : (
        <div className='space-y-4'>
          {interfaces.map((iface) => (
            <div key={iface.id} className='p-4 border border-gray-200 rounded'>
              <div className='flex justify-between items-center mb-2'>
                <h3 className='font-medium'>
                  {getSystemName(iface.source_system_id)} →{' '}
                  {getSystemName(iface.target_system_id)}
                </h3>
                <div className='flex space-x-2'>
                  <button
                    onClick={() => handleStartEditing(iface)}
                    className='px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm'
                    disabled={isCreating || isEditing !== null}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteInterface(iface.id)}
                    className='px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm'
                    disabled={isCreating || isEditing !== null}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div>
                <h4 className='text-sm font-medium mb-1'>Attributes:</h4>
                {Object.keys(iface.attributes || {}).length > 0 ? (
                  <ul className='pl-4 list-disc'>
                    {Object.entries(iface.attributes || {}).map(
                      ([key, value]) => (
                        <li key={key} className='text-sm'>
                          <span className='font-medium'>{key}:</span>{' '}
                          {String(value)}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className='text-sm text-gray-500'>No attributes</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
