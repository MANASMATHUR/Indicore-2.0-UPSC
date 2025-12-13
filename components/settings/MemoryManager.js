import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Memory Manager Component - ChatGPT Style
 * Allows users to view, edit, and delete saved memories
 */
export default function MemoryManager() {
    const { data: session } = useSession();
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [message, setMessage] = useState('');
    const [showAddNew, setShowAddNew] = useState(false);
    const [newMemory, setNewMemory] = useState('');

    useEffect(() => {
        if (session) {
            fetchMemories();
        }
    }, [session]);

    const fetchMemories = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/memory');
            if (res.ok) {
                const data = await res.json();
                setMemories(data.memories || []);
            }
        } catch (error) {
            console.error('Failed to fetch memories:', error);
        } finally {
            setLoading(false);
        }
    };

    const addMemory = async () => {
        if (!newMemory.trim()) return;

        try {
            const res = await fetch('/api/user/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memory: newMemory.trim()
                })
            });

            if (res.ok) {
                setMessage('✅ Memory added successfully!');
                setNewMemory('');
                setShowAddNew(false);
                await fetchMemories();
                setTimeout(() => setMessage(''), 3000);
            } else {
                const data = await res.json();
                if (data.duplicate) {
                    setMessage('⚠️ This memory already exists');
                } else {
                    setMessage('❌ Failed to add memory');
                }
            }
        } catch (error) {
            console.error('Failed to add memory:', error);
            setMessage('❌ Error adding memory');
        }
    };

    const updateMemory = async (memoryId) => {
        if (!editContent.trim()) return;

        try {
            const res = await fetch('/api/user/memory', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memoryId,
                    updates: { content: editContent.trim() }
                })
            });

            if (res.ok) {
                setMessage('✅ Memory updated!');
                setEditingId(null);
                await fetchMemories();
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('❌ Failed to update memory');
            }
        } catch (error) {
            console.error('Failed to update memory:', error);
            setMessage('❌ Error updating memory');
        }
    };

    const deleteMemory = async (memoryId) => {
        if (!confirm('Are you sure you want to delete this memory?')) return;

        try {
            const res = await fetch('/api/user/memory', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memoryId })
            });

            if (res.ok) {
                setMessage('✅ Memory deleted');
                await fetchMemories();
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('❌ Failed to delete memory');
            }
        } catch (error) {
            console.error('Failed to delete memory:', error);
            setMessage('❌ Error deleting memory');
        }
    };

    const clearAllMemories = async () => {
        if (!confirm('Are you sure you want to clear ALL memories? This cannot be undone.')) return;

        try {
            const res = await fetch('/api/user/memory', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clearAll: true })
            });

            if (res.ok) {
                setMessage('✅ All memories cleared');
                await fetchMemories();
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('❌ Failed to clear memories');
            }
        } catch (error) {
            console.error('Failed to clear memories:', error);
            setMessage('❌ Error clearing memories');
        }
    };

    const getCategoryIcon = (category) => {
        const icons = {
            'goal': '🎯',
            'preference': '❤️',
            'study_habit': '📚',
            'exam': '📝',
            'subject': '📖',
            'personal': '👤',
            'general': '💡'
        };
        return icons[category] || '💡';
    };

    const getCategoryColor = (category) => {
        const colors = {
            'goal': '#ff6b6b',
            'preference': '#ee5a6f',
            'study_habit': '#4ecdc4',
            'exam': '#95e1d3',
            'subject': '#ffd93d',
            'personal': '#6bcf7f',
            'general': '#a8dadc'
        };
        return colors[category] || '#a8dadc';
    };

    if (!session) {
        return (
            <div className="memory-manager">
                <p>Please sign in to manage your memories.</p>
            </div>
        );
    }

    return (
        <div className="memory-manager">
            <div className="header">
                <div className="title-section">
                    <h2>🧠 Memory</h2>
                    <p className="subtitle">
                        Information the AI remembers about you to personalize responses
                    </p>
                </div>
                {memories.length > 0 && (
                    <div className="actions">
                        <button
                            className="btn-primary"
                            onClick={() => setShowAddNew(!showAddNew)}
                        >
                            + Add Memory
                        </button>
                        <button
                            className="btn-danger"
                            onClick={clearAllMemories}
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            {message && (
                <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {showAddNew && (
                <div className="add-memory-box">
                    <textarea
                        placeholder="What would you like the AI to remember? (e.g., 'My goal is to become an IPS officer')"
                        value={newMemory}
                        onChange={(e) => setNewMemory(e.target.value)}
                        rows={3}
                    />
                    <div className="button-group">
                        <button className="btn-primary" onClick={addMemory}>
                            Save Memory
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setShowAddNew(false);
                                setNewMemory('');
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Loading memories...</p>
                </div>
            ) : memories.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🧠</div>
                    <h3>No memories yet</h3>
                    <p>
                        Tell the AI what to remember about you. It will use these memories
                        to personalize all future conversations.
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => setShowAddNew(true)}
                    >
                        Add Your First Memory
                    </button>
                    <div className="examples">
                        <p className="examples-title">Examples:</p>
                        <ul>
                            <li>"My goal is to crack UPSC in first attempt"</li>
                            <li>"I prefer concise explanations over long responses"</li>
                            <li>"My optional subject is Public Administration"</li>
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="memories-list">
                    {memories.map((memory) => (
                        <div
                            key={memory._id}
                            className="memory-card"
                            style={{ borderLeftColor: getCategoryColor(memory.category) }}
                        >
                            <div className="memory-header">
                                <div className="memory-meta">
                                    <span className="category-icon">
                                        {getCategoryIcon(memory.category)}
                                    </span>
                                    <span className="category-name">
                                        {memory.category.replace('_', ' ')}
                                    </span>
                                    {memory.useCount > 0 && (
                                        <span className="use-count">
                                            Used {memory.useCount} {memory.useCount === 1 ? 'time' : 'times'}
                                        </span>
                                    )}
                                </div>
                                <div className="memory-actions">
                                    {editingId === memory._id ? (
                                        <>
                                            <button
                                                className="btn-icon btn-save"
                                                onClick={() => updateMemory(memory._id)}
                                                title="Save changes"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                className="btn-icon btn-cancel"
                                                onClick={() => setEditingId(null)}
                                                title="Cancel"
                                            >
                                                ✕
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className="btn-icon"
                                                onClick={() => {
                                                    setEditingId(memory._id);
                                                    setEditContent(memory.content);
                                                }}
                                                title="Edit memory"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn-icon btn-delete"
                                                onClick={() => deleteMemory(memory._id)}
                                                title="Delete memory"
                                            >
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {editingId === memory._id ? (
                                <textarea
                                    className="edit-textarea"
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    rows={3}
                                    autoFocus
                                />
                            ) : (
                                <div className="memory-content">
                                    {memory.content}
                                </div>
                            )}

                            <div className="memory-footer">
                                <span className="saved-date">
                                    Saved {new Date(memory.savedAt).toLocaleDateString()}
                                </span>
                                {memory.importance === 'high' && (
                                    <span className="importance-badge">⭐ High Priority</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
        .memory-manager {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          gap: 2rem;
        }

        .title-section h2 {
          font-size: 1.75rem;
          margin: 0 0 0.5rem 0;
        }

        .subtitle {
          color: #666;
          margin: 0;
          font-size: 0.95rem;
        }

        .actions {
          display: flex;
          gap: 0.75rem;
        }

        .message {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }

        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .add-memory-box {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          border: 2px dashed #dee2e6;
        }

        .add-memory-box textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ced4da;
          border-radius: 6px;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 1rem;
        }

        .button-group {
          display: flex;
          gap: 0.75rem;
        }

        .loading {
          text-align: center;
          padding: 3rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .empty-state h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
        }

        .empty-state p {
          color: #666;
          max-width: 500px;
          margin: 0 auto 2rem;
        }

        .examples {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #dee2e6;
        }

        .examples-title {
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: #333;
        }

        .examples ul {
          list-style: none;
          padding: 0;
          text-align: left;
          max-width: 500px;
          margin: 0 auto;
        }

        .examples li {
          padding: 0.5rem 1rem;
          background: white;
          border-left: 3px solid #007bff;
          margin-bottom: 0.5rem;
          border-radius: 4px;
          font-size: 0.9rem;
          color: #555;
        }

        .memories-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .memory-card {
          background: white;
          border: 1px solid #dee2e6;
          border-left: 4px solid #007bff;
          border-radius: 8px;
          padding: 1.25rem;
          transition: all 0.2s;
        }

        .memory-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .memory-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .memory-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .category-icon {
          font-size: 1.25rem;
        }

        .category-name {
          font-size: 0.85rem;
          color: #666;
          text-transform: capitalize;
        }

        .use-count {
          font-size: 0.75rem;
          color: #999;
          background: #f1f3f5;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
        }

        .memory-actions {
          display: flex;
          gap: 0.5rem;
        }

        .memory-content {
          font-size: 1.05rem;
          line-height: 1.6;
          color: #333;
          padding: 0.5rem 0;
        }

        .edit-textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #007bff;
          border-radius: 6px;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
        }

        .memory-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.75rem;
          font-size: 0.85rem;
          color: #999;
        }

        .saved-date {
          font-size: 0.8rem;
        }

        .importance-badge {
          background: #fff3cd;
          color: #856404;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
        }

        button {
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #007bff;
          color: white;
          border: none;
          padding: 0.625rem 1.25rem;
          border-radius: 6px;
          font-weight: 500;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
          border: none;
          padding: 0.625rem 1.25rem;
          border-radius: 6px;
        }

        .btn-secondary:hover {
          background: #5a6268;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
          border: none;
          padding: 0.625rem 1.25rem;
          border-radius: 6px;
          font-weight: 500;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        .btn-icon {
          background: transparent;
          border: none;
          font-size: 1.1rem;
          padding: 0.25rem 0.5rem;
          opacity: 0.7;
        }

        .btn-icon:hover {
          opacity: 1;
        }

        .btn-save {
          color: #28a745;
          font-weight: bold;
          font-size: 1.5rem;
        }

        .btn-cancel {
          color: #dc3545;
          font-weight: bold;
          font-size: 1.25rem;
        }

        .btn-delete:hover {
          transform: scale(1.1);
        }
      `}</style>
        </div>
    );
}
