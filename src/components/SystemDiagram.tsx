'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  ConnectionLineType,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';
import SystemDetailsPanel from './SystemDetailsPanel';
import InterfacePanel from './InterfacePanel';

// Custom node types
const nodeTypes = {};

export default function SystemDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [currentSystemId, setCurrentSystemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch systems and their relationships
  const fetchSystemHierarchy = useCallback(
    async (systemId: string | null = null) => {
      console.debug('Fetching system hierarchy for:', systemId);
      setIsLoading(true);

      try {
        // Default to root systems if no system ID provided
        const { data: currentSystem, error: currentSystemError } = systemId
          ? await supabase
              .from('systems')
              .select('*')
              .eq('id', systemId)
              .single()
          : { data: null, error: null };

        if (currentSystemError && systemId) {
          console.error('Error fetching current system:', currentSystemError);
          return;
        }

        // Query to get children and grandchildren
        const query = systemId
          ? supabase.from('systems').select('*').eq('parent_id', systemId)
          : supabase.from('systems').select('*').is('parent_id', null);

        const { data: children, error: childrenError } = await query;

        if (childrenError) {
          console.error('Error fetching children:', childrenError);
          return;
        }

        // Get all potential grandchildren
        const childrenIds = children?.map((child) => child.id) || [];
        const { data: grandchildren, error: grandchildrenError } =
          childrenIds.length > 0
            ? await supabase
                .from('systems')
                .select('*')
                .in('parent_id', childrenIds)
            : { data: [], error: null };

        if (grandchildrenError) {
          console.error('Error fetching grandchildren:', grandchildrenError);
          return;
        }

        // Get interfaces between all these systems
        const allSystemIds = [
          ...(currentSystem ? [currentSystem.id] : []),
          ...childrenIds,
          ...(grandchildren?.map((gc) => gc.id) || []),
        ];

        const { data: interfaces, error: interfacesError } =
          allSystemIds.length > 0
            ? await supabase
                .from('interfaces')
                .select('*')
                .or(
                  `source_system_id.in.(${allSystemIds.join(
                    ','
                  )}),target_system_id.in.(${allSystemIds.join(',')})`
                )
            : { data: [], error: null };

        if (interfacesError) {
          console.error('Error fetching interfaces:', interfacesError);
          return;
        }

        // Transform the data into nodes and edges for React Flow
        const systemNodes: Node[] = [
          // Add current system as the root node if it exists
          ...(currentSystem
            ? [
                {
                  id: currentSystem.id,
                  data: {
                    label: currentSystem.name,
                    category: currentSystem.category,
                  },
                  position: { x: 0, y: 0 },
                  type: 'default',
                  style: {
                    background: '#f0f9ff',
                    border: '1px solid #0284c7',
                    borderRadius: '8px',
                    padding: '10px',
                  },
                },
              ]
            : []),

          // Add children nodes
          ...(children?.map((child, index) => ({
            id: child.id,
            data: {
              label: child.name,
              category: child.category,
            },
            position: { x: index * 200 - (children.length - 1) * 100, y: 150 },
            type: 'default',
            style: {
              background: '#f0fdf4',
              border: '1px solid #16a34a',
              borderRadius: '8px',
              padding: '10px',
            },
          })) || []),

          // Add grandchildren nodes
          ...(grandchildren?.map((grandchild, index) => ({
            id: grandchild.id,
            data: {
              label: grandchild.name,
              category: grandchild.category,
              parentId: grandchild.parent_id,
            },
            position: {
              x: index * 180 - (grandchildren.length - 1) * 90,
              y: 300,
            },
            type: 'default',
            style: {
              background: '#f8fafc',
              border: '1px solid #64748b',
              borderRadius: '8px',
              padding: '10px',
            },
          })) || []),
        ];

        // Create parent-child edges
        const hierarchyEdges: Edge[] = [
          // Parent to children edges
          ...(currentSystem
            ? children?.map((child) => ({
                id: `e-${currentSystem.id}-${child.id}`,
                source: currentSystem.id,
                target: child.id,
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#16a34a' },
              })) || []
            : []),

          // Children to grandchildren edges
          ...(grandchildren?.map((grandchild) => ({
            id: `e-${grandchild.parent_id}-${grandchild.id}`,
            source: grandchild.parent_id,
            target: grandchild.id,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#64748b' },
          })) || []),
        ];

        // Create interface edges
        const interfaceEdges: Edge[] =
          interfaces?.map((iface) => ({
            id: `iface-${iface.id}`,
            source: iface.source_system_id,
            target: iface.target_system_id,
            type: 'straight',
            animated: true,
            style: { stroke: '#ef4444' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#ef4444',
            },
            data: {
              interfaceId: iface.id,
              attributes: iface.attributes,
            },
          })) || [];

        console.debug('Generated nodes:', systemNodes);
        console.debug('Generated edges:', [
          ...hierarchyEdges,
          ...interfaceEdges,
        ]);

        setNodes(systemNodes);
        setEdges([...hierarchyEdges, ...interfaceEdges]);
        setCurrentSystemId(currentSystem?.id || null);
      } catch (error) {
        console.error('Error in fetchSystemHierarchy:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [setNodes, setEdges]
  );

  // Initial data load
  useEffect(() => {
    fetchSystemHierarchy();
  }, [fetchSystemHierarchy]);

  // Handle node double-click for navigation
  const onNodeDoubleClick = useCallback(
    (event, node) => {
      console.debug('Node double-clicked:', node);
      fetchSystemHierarchy(node.id);
    },
    [fetchSystemHierarchy]
  );

  // Handle back navigation to parent
  const handleNavigateToParent = useCallback(async () => {
    if (!currentSystemId) return;

    try {
      // Get current system to find its parent
      const { data: system, error } = await supabase
        .from('systems')
        .select('parent_id')
        .eq('id', currentSystemId)
        .single();

      if (error) {
        console.error('Error fetching parent system:', error);
        return;
      }

      // Navigate to parent or root if no parent
      fetchSystemHierarchy(system.parent_id);
    } catch (error) {
      console.error('Error navigating to parent:', error);
    }
  }, [currentSystemId, fetchSystemHierarchy]);

  // Handle system update (refresh data after changes)
  const handleSystemUpdate = useCallback(() => {
    fetchSystemHierarchy(currentSystemId);
  }, [currentSystemId, fetchSystemHierarchy]);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex' }}>
      <div style={{ flex: '3', height: '100%' }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition='bottom-right'
            connectionLineType={ConnectionLineType.SmoothStep}
          >
            <Controls />
            <Background />
            <Panel position='top-left'>
              <div className='p-2 bg-white rounded shadow'>
                <h3 className='font-bold mb-2'>
                  {isLoading
                    ? 'Loading...'
                    : currentSystemId
                    ? 'Current System View'
                    : 'Root Systems'}
                </h3>
                {currentSystemId && (
                  <button
                    onClick={handleNavigateToParent}
                    className='px-2 py-1 bg-gray-200 rounded hover:bg-gray-300'
                  >
                    ← Back to Parent
                  </button>
                )}
                <div className='mt-2 text-sm text-gray-500'>
                  Double-click a node to navigate
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      <div
        style={{
          flex: '2',
          height: '100%',
          overflow: 'auto',
          padding: '16px',
          borderLeft: '1px solid #e2e8f0',
        }}
      >
        <SystemDetailsPanel
          systemId={currentSystemId}
          onSystemUpdate={handleSystemUpdate}
        />

        <InterfacePanel
          systemId={currentSystemId}
          onInterfaceUpdate={handleSystemUpdate}
        />
      </div>
    </div>
  );
}
