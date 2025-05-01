/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface System {
  id: string;
  name: string;
  category: string;
  parent_id: string | null;
}

interface SystemDetailsPanelProps {
  systemId: string | null;
  onSystemUpdate: () => void;
}

export default function SystemDetailsPanel({
  systemId,
  onSystemUpdate,
}: SystemDetailsPanelProps) {
  const [system, setSystem] = useState<System | null>(null);
  const [childSystems, setChildSystems] = useState<System[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '' });
  const [newChildSystem, setNewChildSystem] = useState({
    name: '',
    category: '',
  });
  const [isCreatingChild, setIsCreatingChild] = useState(false);

  // Fetch current system details
  const fetchSystemDetails = useCallback(async () => {
    console.debug('Fetching system details for:', systemId);
    if (!systemId) {
      setSystem(null);
      setChildSystems([]);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch current system
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .eq('id', systemId)
        .single();

      if (error) {
        console.error('Error fetching system details:', error);
        return;
      }

      setSystem(data);
      setFormData({
        name: data.name,
        category: data.category || '',
      });

      // Fetch child systems
      const { data: children, error: childrenError } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', systemId);

      if (childrenError) {
        console.error('Error fetching child systems:', childrenError);
        return;
      }

      setChildSystems(children || []);
    } catch (error) {
      console.error('Error in fetchSystemDetails:', error);
    } finally {
      setIsLoading(false);
    }
  }, [systemId]);

  useEffect(() => {
    fetchSystemDetails();
  }, [fetchSystemDetails, systemId]);

  // Handle form changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle new child system form changes
  const handleNewChildInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setNewChildSystem((prev) => ({ ...prev, [name]: value }));
  };

  // Execute transaction for system update
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

  // Update system
  const handleUpdateSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemId) return;

    try {
      await executeTransaction(async () => {
        // First update the main systems table
        const { error } = await supabase
          .from('systems')
          .update({
            name: formData.name,
            category: formData.category,
            updated_at: new Date().toISOString(),
          })
          .eq('id', systemId);

        if (error) throw error;

        // Then create a revision record
        const { error: revisionError } = await supabase
          .from('system_revisions')
          .insert({
            system_id: systemId,
            name: formData.name,
            category: formData.category,
            parent_id: system?.parent_id,
            revision_timestamp: new Date().toISOString(),
          });

        if (revisionError) throw revisionError;
      });

      setIsEditing(false);
      onSystemUpdate();
    } catch (error) {
      console.error('Error updating system:', error);
    }
  };

  // Create child system
  const handleCreateChildSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemId) return;

    try {
      await executeTransaction(async () => {
        // Generate new UUID for the system
        const newSystemId = crypto.randomUUID();

        // First insert into systems table
        const { error } = await supabase.from('systems').insert({
          id: newSystemId,
          name: newChildSystem.name,
          category: newChildSystem.category,
          parent_id: systemId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        // Then create a revision record
        const { error: revisionError } = await supabase
          .from('system_revisions')
          .insert({
            system_id: newSystemId,
            name: newChildSystem.name,
            category: newChildSystem.category,
            parent_id: systemId,
            revision_timestamp: new Date().toISOString(),
          });

        if (revisionError) throw revisionError;
      });

      // Reset form and state
      setNewChildSystem({ name: '', category: '' });
      setIsCreatingChild(false);
      onSystemUpdate();
    } catch (error) {
      console.error('Error creating child system:', error);
    }
  };

  // Delete system
  const handleDeleteSystem = async (childId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this system? This will also delete all child systems and interfaces.'
      )
    ) {
      return;
    }

    try {
      await executeTransaction(async () => {
        // First, recursively get all descendant system IDs
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

        const descendantIds = await getAllDescendantIds(childId);
        const allSystemIds = [childId, ...descendantIds];

        // Delete interfaces where these systems are source or target
        if (allSystemIds.length > 0) {
          // Get interface IDs to create revisions
          const { data: interfacesToDelete, error: interfaceQueryError } =
            await supabase
              .from('interfaces')
              .select('*')
              .or(
                `source_system_id.in.(${allSystemIds.join(
                  ','
                )}),target_system_id.in.(${allSystemIds.join(',')})`
              );

          if (interfaceQueryError) throw interfaceQueryError;

          // Create interface revision records before deletion
          if (interfacesToDelete && interfacesToDelete.length > 0) {
            const interfaceRevisions = interfacesToDelete.map((iface) => ({
              interface_id: iface.id,
              source_system_id: iface.source_system_id,
              target_system_id: iface.target_system_id,
              attributes: iface.attributes,
              revision_timestamp: new Date().toISOString(),
            }));

            const { error: revisionError } = await supabase
              .from('interface_revisions')
              .insert(interfaceRevisions);

            if (revisionError) throw revisionError;

            // Delete the interfaces
            const { error: deleteInterfaceError } = await supabase
              .from('interfaces')
              .delete()
              .or(
                `source_system_id.in.(${allSystemIds.join(
                  ','
                )}),target_system_id.in.(${allSystemIds.join(',')})`
              );

            if (deleteInterfaceError) throw deleteInterfaceError;
          }
        }

        // Create system revision records before deletion
        for (const sysId of allSystemIds) {
          const { data: sysData, error: sysError } = await supabase
            .from('systems')
            .select('*')
            .eq('id', sysId)
            .single();

          if (sysError) throw sysError;

          const { error: revisionError } = await supabase
            .from('system_revisions')
            .insert({
              system_id: sysId,
              name: sysData.name,
              category: sysData.category,
              parent_id: sysData.parent_id,
              revision_timestamp: new Date().toISOString(),
            });

          if (revisionError) throw revisionError;
        }

        for (let i = allSystemIds.length - 1; i >= 0; i--) {
          const { error: deleteError } = await supabase
            .from('systems')
            .delete()
            .eq('id', allSystemIds[i]);

          if (deleteError) throw deleteError;
        }
      });

      onSystemUpdate();
    } catch (error) {
      console.error('Error deleting system:', error);
    }
  };

  // If no system is selected
  if (!systemId) {
    return (
      <div className='mb-8 p-4 bg-white text-black rounded shadow'>
        <h2 className='text-xl font-bold mb-4 text-black'>System Details</h2>
        <p>Select a system to view details</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='mb-8 p-4 bg-white rounded shadow'>
        <h2 className='text-xl font-bold mb-4'>System Details</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className='mb-8 p-4 bg-white rounded shadow text-black'>
      <h2 className='text-xl font-bold mb-4 text-black'>System Details</h2>

      {system && (
        <div className='mb-6'>
          {isEditing ? (
            <form onSubmit={handleUpdateSystem} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-blue-700 mb-1'>
                  Name:
                </label>
                <input
                  type='text'
                  name='name'
                  value={formData.name}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-black-300 rounded'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-black mb-1'>
                  Category:
                </label>
                <input
                  type='text'
                  name='category'
                  value={formData.category}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded'
                />
              </div>

              <div className='flex space-x-2'>
                <button
                  type='submit'
                  className='px-4 py-2 bg-blue-500 text-black rounded hover:bg-blue-600'
                >
                  Save
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: system.name,
                      category: system.category || '',
                    });
                  }}
                  className='px-4 py-2 text-black bg-gray-300 rounded hover:bg-gray-400'
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className='mb-4'>
                <p className='text-sm font-medium text-gray-500'>Name:</p>
                <p className='text-lg'>{system.name}</p>
              </div>

              <div className='mb-4'>
                <p className='text-sm font-medium text-gray-500'>Category:</p>
                <p className='text-lg'>{system.category || 'N/A'}</p>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className='px-4 py-2 bg-blue-500 text-black rounded hover:bg-blue-600'
              >
                Edit System
              </button>
            </div>
          )}
        </div>
      )}

      {/* Child Systems */}
      <div className='mt-8'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-lg font-semibold'>Subsystems</h3>
          {!isCreatingChild && (
            <button
              onClick={() => setIsCreatingChild(true)}
              className='px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm'
            >
              Add Child System
            </button>
          )}
        </div>

        {isCreatingChild && (
          <form
            onSubmit={handleCreateChildSystem}
            className='mb-6 p-4 border border-gray-200 rounded bg-gray-50'
          >
            <h4 className='font-medium mb-3'>New Child System</h4>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Name:
                </label>
                <input
                  type='text'
                  name='name'
                  value={newChildSystem.name}
                  onChange={handleNewChildInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Category:
                </label>
                <input
                  type='text'
                  name='category'
                  value={newChildSystem.category}
                  onChange={handleNewChildInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded'
                />
              </div>

              <div className='flex space-x-2'>
                <button
                  type='submit'
                  className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
                >
                  Create
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setIsCreatingChild(false);
                    setNewChildSystem({ name: '', category: '' });
                  }}
                  className='px-4 py-2 bg-gray-300 rounded hover:bg-gray-400'
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {childSystems.length === 0 ? (
          <p className='text-gray-500'>No subsystems found</p>
        ) : (
          <ul className='divide-y divide-gray-200'>
            {childSystems.map((child) => (
              <li
                key={child.id}
                className='py-3 flex justify-between items-center'
              >
                <div>
                  <button
                    onClick={() => onSystemUpdate()}
                    className='text-blue-600 hover:underline font-medium'
                  >
                    {child.name}
                  </button>
                  {child.category && (
                    <span className='ml-2 text-sm text-gray-500'>
                      ({child.category})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSystem(child.id)}
                  className='text-red-500 hover:text-red-700'
                  title='Delete system'
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
