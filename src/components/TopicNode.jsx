import { Handle, Position } from 'reactflow';

export default function TopicNode({ data }) {
  const { topic, connection, emoji, onExpand, loading, isRoot, expanded } = data;

  return (
    <div className={`topic-node${isRoot ? ' root-node' : ''}${loading ? ' is-loading' : ''}`}>
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className="node-header">
        <span className="node-emoji">{emoji || '🔮'}</span>
        <div className="node-title">{topic}</div>
      </div>

      {connection && (
        <div className="node-connection">{connection}</div>
      )}

      {!expanded ? (
        <button
          className="node-expand-btn"
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-icon" />
              Exploring…
            </>
          ) : (
            <>+ Dive deeper</>
          )}
        </button>
      ) : (
        <div className="node-expanded-badge">
          ↓ branches below
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}
