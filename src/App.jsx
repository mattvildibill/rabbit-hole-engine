import { useState, useCallback, useRef } from 'react';
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
import 'reactflow/dist/style.css';
import TopicNode from './components/TopicNode';

const nodeTypes = { topicNode: TopicNode };

const EXAMPLES = ['octopus cognition', 'medieval dentistry', 'Soviet vending machines', 'bioluminescent fungi'];

const CHILD_SPACING = 250;
const CHILD_Y_OFFSET = 210;

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

function childPositions(parentX, parentY, count) {
  const totalWidth = (count - 1) * CHILD_SPACING;
  const startX = parentX - totalWidth / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * CHILD_SPACING,
    y: parentY + CHILD_Y_OFFSET,
  }));
}

function FlowCanvas({ rootTopic, onReset }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const idRef = useRef(0);
  const { fitView } = useReactFlow();
  const initialized = useRef(false);

  const newId = () => `n${++idRef.current}`;

  const expandNode = useCallback(async (nodeId, topic, parentTopic, pos) => {
    setNodes(ns =>
      ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, loading: true } } : n)
    );

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, parentTopic }),
      });
      const { subtopics, error } = await res.json();
      if (error) throw new Error(error);

      const positions = childPositions(pos.x, pos.y, subtopics.length);

      const newNodes = subtopics.map((sub, i) => {
        const id = newId();
        return {
          id,
          type: 'topicNode',
          position: positions[i],
          data: {
            topic: sub.title,
            connection: sub.connection,
            emoji: sub.curiosity,
            onExpand: () => expandNode(id, sub.title, topic, positions[i]),
            loading: false,
            isRoot: false,
            expanded: false,
          },
        };
      });

      const newEdges = newNodes.map(n => buildEdge(nodeId, n.id));

      setNodes(ns => [
        ...ns.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, loading: false, expanded: true } } : n
        ),
        ...newNodes,
      ]);
      setEdges(es => [...es, ...newEdges]);

      setTimeout(() => fitView({ duration: 600, padding: 0.15 }), 80);
    } catch (err) {
      console.error(err);
      setNodes(ns =>
        ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, loading: false } } : n)
      );
    }
  }, [setNodes, setEdges, fitView]);

  // Bootstrap root node once
  if (!initialized.current) {
    initialized.current = true;
    const rootId = newId();
    const rootPos = { x: 0, y: 0 };
    const rootNode = {
      id: rootId,
      type: 'topicNode',
      position: rootPos,
      data: {
        topic: rootTopic,
        connection: null,
        emoji: '🕳️',
        onExpand: () => expandNode(rootId, rootTopic, null, rootPos),
        loading: false,
        isRoot: true,
        expanded: false,
      },
    };
    // Seed state synchronously before first render
    nodes.push(rootNode);
    // Auto-expand after mount
    setTimeout(() => expandNode(rootId, rootTopic, null, rootPos), 50);
  }

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
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#1a1a3a"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor="#4f46e5"
          maskColor="rgba(5,5,12,0.85)"
          style={{ borderRadius: 10 }}
        />
      </ReactFlow>
    </div>
  );
}

export default function App() {
  const [rootTopic, setRootTopic] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const exampleRef = useRef(0);

  function pickExample() {
    const ex = EXAMPLES[exampleRef.current % EXAMPLES.length];
    exampleRef.current++;
    setInput(ex);
  }

  function start(e) {
    e?.preventDefault();
    const val = input.trim();
    if (!val || loading) return;
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
