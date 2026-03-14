import { Handle, Position } from 'reactflow';
import { depthColor } from '../App';

export default function TopicNode({ data }) {
  const { topic, connection, emoji, onExpand, loading, isRoot, expanded, error, depth = 0 } = data;
  const color = depthColor(depth);

  return (
    <div
      className={`topic-node${isRoot ? ' root-node' : ''}${loading ? ' is-loading' : ''}`}
      style={{
        borderColor: `${color}44`,
        '--glow': color,
      }}
    >
      <Handle type="target" position={Position.Top} className="node-handle" style={{ background: color }} />

      <div className="node-header">
        <span className="node-emoji">{emoji || '🔮'}</span>
        <div className="node-title">{topic}</div>
      </div>

      {connection && <div className="node-connection">{connection}</div>}

      {error && <div className="node-error">⚠️ {error}</div>}

      {!expanded ? (
        <button
          className="node-expand-btn"
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          disabled={loading}
          style={{ borderColor: `${color}44`, color }}
        >
          {loading ? (
            <><span className="spinner-icon" style={{ borderTopColor: color }} /> Exploring…</>
          ) : error ? (
            <>↺ Retry</>
          ) : (
            <>+ Dive deeper</>
          )}
        </button>
      ) : (
        <div className="node-expanded-badge">↓ branches below</div>
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" style={{ background: color }} />
    </div>
  );
}
