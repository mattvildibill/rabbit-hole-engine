import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';
import TopicNode from './components/TopicNode';

const nodeTypes = { topicNode: TopicNode };

const EXAMPLES = ['octopus cognition', 'medieval dentistry', 'Soviet vending machines', 'bioluminescent fungi'];

// Node dimensions — must be >= actual rendered size so dagre spaces correctly
const NODE_WIDTH = 230;
const NODE_HEIGHT = 250;

function buildEdge(sourceId, targetId) {
  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#4f46e5', strokeWidth: 1.5, opacity: 0.7 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
  };
}

function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

function FlowCanvas({ rootTopic, onReset }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();
  const idRef = useRef(0);
  const initialized = useRef(false);
  // Keep refs in sync so expandNode always sees latest state
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const newId = useCallback(() => `n${++idRef.current}`, []);

  const expandNode = useCallback(async (nodeId, topic, parentTopic, _pos) => {
    setNodes(ns =>
      ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, loading: true, error: null } } : n)
    );

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, parentTopic }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const { subtopics } = json;

      // Build new nodes (positions will be set by dagre, so use 0,0 placeholders)
      const newNodes = subtopics.map((sub) => {
        const id = newId();
        return {
          id,
          type: 'topicNode',
          position: { x: 0, y: 0 },
          data: {
            topic: sub.title,
            connection: sub.connection,
            emoji: sub.curiosity,
            loading: false,
            isRoot: false,
            expanded: false,
            error: null,
            onExpand: () => expandNode(id, sub.title, topic, { x: 0, y: 0 }),
          },
        };
      });

      const newEdges = newNodes.map(n => buildEdge(nodeId, n.id));

      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      const updatedNodes = currentNodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, loading: false, expanded: true } } : n
      );

      const allNodes = [...updatedNodes, ...newNodes];
      const allEdges = [...currentEdges, ...newEdges];

      const layoutedNodes = applyDagreLayout(allNodes, allEdges);

      setNodes(layoutedNodes);
      setEdges(allEdges);
      setTimeout(() => fitView({ duration: 700, padding: 0.12 }), 80);
    } catch (err) {
      console.error('Expand error:', err);
      setNodes(ns =>
        ns.map(n =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, loading: false, error: err.message } }
            : n
        )
      );
    }
  }, [setNodes, setEdges, fitView, newId]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const rootId = newId();
    setNodes([{
      id: rootId,
      type: 'topicNode',
      position: { x: 0, y: 0 },
      data: {
        topic: rootTopic,
        emoji: '🕳️',
        connection: null,
        loading: false,
        isRoot: true,
        expanded: false,
        error: null,
        onExpand: () => expandNode(rootId, rootTopic, null, { x: 0, y: 0 }),
      },
    }]);

    expandNode(rootId, rootTopic, null, { x: 0, y: 0 });
  }, [rootTopic, expandNode, newId, setNodes]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="flow-header">
        <span className="flow-header-topic">🕳️ {rootTopic}</span>
        <button className="flow-header-reset" onClick={onReset}>← New topic</button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1a1a3a" />
        <Controls showInteractive={false} />
        <MiniMap nodeColor="#4f46e5" maskColor="rgba(5,5,12,0.85)" style={{ borderRadius: 10 }} />
      </ReactFlow>
    </div>
  );
}

export default function App() {
  const [rootTopic, setRootTopic] = useState('');
  const [input, setInput] = useState('');
  const exampleRef = useRef(0);

  function pickExample() {
    setInput(EXAMPLES[exampleRef.current % EXAMPLES.length]);
    exampleRef.current++;
  }

  function start(e) {
    e?.preventDefault();
    const val = input.trim();
    if (!val) return;
    setRootTopic(val);
  }

  function reset() {
    setRootTopic('');
    setInput('');
  }

  if (rootTopic) {
    return (
      <ReactFlowProvider>
        <FlowCanvas rootTopic={rootTopic} onReset={reset} />
      </ReactFlowProvider>
    );
  }

  return (
    <div className="intro">
      <div className="intro-eyebrow">✦ Infinite curiosity engine</div>
      <h1>Rabbit Hole Engine</h1>
      <p className="intro-sub">
        Enter any topic — no matter how simple or obscure — and watch it branch into
        a living tree of unexpected connections.
      </p>
      <form className="intro-form" onSubmit={start}>
        <input
          className="intro-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. fermentation, the moon, ancient Rome…"
          autoFocus
        />
        <button className="intro-btn" type="submit" disabled={!input.trim()}>
          Explore →
        </button>
      </form>
      <p className="intro-hint">
        Not sure where to start?{' '}
        <span onClick={pickExample}>Try a random example</span>
      </p>
    </div>
  );
}
