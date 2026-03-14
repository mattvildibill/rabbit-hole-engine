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
import 'reactflow/dist/style.css';
import TopicNode from './components/TopicNode';

const nodeTypes = { topicNode: TopicNode };

const EXAMPLES = [
  'octopus cognition', 'medieval dentistry', 'Soviet vending machines', 'bioluminescent fungi',
  'competitive eating history', 'abandoned theme parks', 'Byzantine bureaucracy', 'whale songs',
  'the color blue in ancient languages', 'elevator music', 'left-handedness', 'cursed objects',
  'competitive lockpicking', 'potato famine economics', 'cloud seeding', 'mirror superstitions',
  'Viking nail hygiene', 'the smell of rain', 'chess piece origins', 'laughing epidemics',
  'phantom islands', 'competitive dog grooming', 'the postal system', 'mud architecture',
  'yawning contagion', 'tongue maps', 'forgotten programming languages',
  'bread riots', 'tulip mania', 'ice harvesting', 'competitive crossword puzzles',
  'the appendix', 'fermentation', 'sky burial', 'neon signs', 'dead languages',
  'antimatter', 'Victorian mourning fashion', 'salt trade routes', 'competitive marble racing',
];

// Color palette by depth level
export const DEPTH_COLORS = [
  '#a78bfa', // 0 - root: purple
  '#818cf8', // 1 - indigo
  '#38bdf8', // 2 - sky blue
  '#34d399', // 3 - emerald
  '#fbbf24', // 4 - amber
  '#f472b6', // 5 - pink
  '#fb923c', // 6 - orange
];

export function depthColor(depth) {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

const EXPAND_RADIUS = 310; // px from parent to children
const SPREAD = Math.PI * 0.85; // 153° arc for children

function getChildPositions(parentPos, count, rootPos) {
  const dx = parentPos.x - rootPos.x;
  const dy = parentPos.y - rootPos.y;
  const isRoot = Math.hypot(dx, dy) < 1;

  // Point away from root; root fans in full circle
  const baseAngle = isRoot ? -Math.PI / 2 : Math.atan2(dy, dx);
  const totalSpread = isRoot ? Math.PI * 2 * 0.92 : SPREAD;
  const half = totalSpread / 2;

  return Array.from({ length: count }, (_, i) => {
    const angle = count === 1
      ? baseAngle
      : baseAngle - half + (totalSpread / (count - 1)) * i;
    return {
      x: parentPos.x + Math.cos(angle) * EXPAND_RADIUS,
      y: parentPos.y + Math.sin(angle) * EXPAND_RADIUS,
    };
  });
}

function buildEdge(sourceId, targetId, depth) {
  const color = depthColor(depth);
  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    type: 'default',
    animated: true,
    style: { stroke: color, strokeWidth: 1.5, opacity: 0.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}

function FlowCanvas({ rootTopic, onReset }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();
  const idRef = useRef(0);
  const initialized = useRef(false);
  const nodesRef = useRef([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

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
      const current = nodesRef.current;
      const parentNode = current.find(n => n.id === nodeId);
      const rootNode = current.find(n => n.data.isRoot);
      const parentDepth = parentNode?.data.depth ?? 0;
      const parentPos = parentNode?.position ?? { x: 0, y: 0 };
      const rootPos = rootNode?.position ?? { x: 0, y: 0 };

      const positions = getChildPositions(parentPos, subtopics.length, rootPos);

      const newNodes = subtopics.map((sub, i) => {
        const id = newId();
        const depth = parentDepth + 1;
        return {
          id,
          type: 'topicNode',
          position: positions[i],
          data: {
            topic: sub.title,
            connection: sub.connection,
            emoji: sub.curiosity,
            loading: false,
            isRoot: false,
            expanded: false,
            error: null,
            depth,
            onExpand: () => expandNode(id, sub.title, topic, positions[i]),
          },
        };
      });

      const newEdges = newNodes.map(n => buildEdge(nodeId, n.id, parentDepth));

      setNodes(ns => [
        ...ns.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, loading: false, expanded: true } } : n
        ),
        ...newNodes,
      ]);
      setEdges(es => [...es, ...newEdges]);
      setTimeout(() => fitView({ duration: 700, padding: 0.1 }), 80);
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
        depth: 0,
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
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="#1e1e3a" />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={n => depthColor(n.data?.depth ?? 0)} maskColor="rgba(5,5,12,0.88)" style={{ borderRadius: 10 }} />
      </ReactFlow>
    </div>
  );
}

function randomExample() {
  return EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
}

export default function App() {
  const [rootTopic, setRootTopic] = useState('');
  const [input, setInput] = useState('');

  function pickExample() {
    let ex;
    do { ex = randomExample(); } while (ex === input);
    setInput(ex);
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
