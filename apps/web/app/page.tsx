'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface Flag {
  name: string;
  enabled: boolean;
  description: string;
}

interface Document {
  id: string;
  content: string;
  metadata: any;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 Welcome to **CogniFlow**! I am your AI Knowledge Agent. Upload documents and ask me anything about them.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [showFlags, setShowFlags] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchFlags() {
    try {
      const res = await fetch(`${API_URL}/flags`);
      const data = await res.json();
      setFlags(data);
    } catch (e) {
      console.error('Failed to load flags', e);
    }
  }

  async function fetchMetrics() {
    try {
      const res = await fetch(`${API_URL}/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error('Failed to load metrics', e);
    }
  }

  async function toggleFlag(name: string) {
    try {
      await fetch(`${API_URL}/flags/${name}`, { method: 'POST' });
      fetchFlags();
    } catch (e) {
      console.error('Failed to toggle flag', e);
    }
  }

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API_URL}/documents`);
      const data = await res.json();
      console.log('Fetched documents:', data.length, 'documents');
      setDocuments(data);
    } catch (e) {
      console.error('Failed to load documents', e);
    }
  }

  async function uploadDocument(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('Upload successful:', data);
        
        // Refresh documents list - new document will be at the top (most recent)
        await fetchDocuments();
        console.log('Documents list refreshed');
        
        // Show success message
        alert(`✅ Document "${file.name}" uploaded successfully!\n\n📄 Check the top of the documents list.`);
      } else {
        const errorText = await res.text();
        console.error('Upload failed. Status:', res.status, 'Response:', errorText);
        alert(`❌ Upload failed (${res.status}): ${errorText.substring(0, 100)}`);
      }
    } catch (e: any) {
      console.error('Failed to upload document', e);
      alert(`❌ Upload failed: ${e.message || 'Please check your connection.'}`);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function deleteDocument(id: string) {
    try {
      const res = await fetch(`${API_URL}/documents/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (e) {
      console.error('Failed to delete document', e);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadDocument(file);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${API_URL}/documents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: accumulated, isStreaming: true }
              : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: accumulated, isStreaming: false } : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `❌ Error: ${err.message}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function renderContent(content: string) {
    // Simple markdown: bold
    return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="logo">⚡</div>
          <div>
            <h1 className="header-title">CogniFlow</h1>
            <p className="header-sub">AI Knowledge Agent</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`action-btn ${showDocs ? 'active' : ''}`}
            onClick={() => {
              setShowDocs(!showDocs);
              if (!showDocs) fetchDocuments();
              setShowMetrics(false);
              setShowFlags(false);
            }}
          >
            📄 Documents
          </button>
          <button
            className={`action-btn ${showMetrics ? 'active' : ''}`}
            onClick={() => {
              setShowMetrics(!showMetrics);
              if (!showMetrics) fetchMetrics();
              setShowFlags(false);
              setShowDocs(false);
            }}
          >
            📊 Metrics
          </button>
          <button
            className={`action-btn ${showFlags ? 'active' : ''}`}
            onClick={() => {
              setShowFlags(!showFlags);
              setShowMetrics(false);
              setShowDocs(false);
            }}
          >
            🚩 Flags
          </button>
        </div>
      </header>

      {/* Documents Panel */}
      {showDocs && (
        <div className="panel">
          <h2 className="panel-title">📄 Document Management</h2>
          <p className="panel-sub">Upload and manage your knowledge base documents.</p>
          
          {/* Upload Area */}
          <div 
            className="upload-area"
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div className="upload-icon">📁</div>
            <p className="upload-text">
              {uploading ? 'Uploading...' : 'Click or drag files to upload'}
            </p>
            <p className="upload-hint">Supports: .txt, .md, .pdf, .doc, .docx</p>
          </div>

          {/* Documents List */}
          <div className="docs-list">
            <h3 className="docs-list-title">Uploaded Documents ({documents.length})</h3>
            {documents.length === 0 ? (
              <p className="docs-empty">No documents uploaded yet.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <div className="doc-info">
                    <span className="doc-icon">📄</span>
                    <div className="doc-details">
                      <span className="doc-name">
                        {doc.metadata?.originalName || `Document ${doc.id.slice(0, 8)}`}
                      </span>
                      <span className="doc-meta">
                        {new Date(doc.createdAt).toLocaleDateString()} • 
                        {doc.content.length} chars
                      </span>
                    </div>
                  </div>
                  <button
                    className="doc-delete-btn"
                    onClick={() => deleteDocument(doc.id)}
                    title="Delete document"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Flags Panel */}
      {showFlags && (
        <div className="panel">
          <h2 className="panel-title">⚙️ Feature Flags</h2>
          <p className="panel-sub">Toggle features at runtime — no restart needed.</p>
          <div className="flags-list">
            {flags.map((flag) => (
              <div key={flag.name} className="flag-item">
                <div className="flag-info">
                  <span className="flag-name">{flag.name}</span>
                  <span className="flag-desc">{flag.description}</span>
                </div>
                <button
                  className={`toggle ${flag.enabled ? 'on' : 'off'}`}
                  onClick={() => toggleFlag(flag.name)}
                >
                  {flag.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Panel */}
      {showMetrics && metrics && (
        <div className="panel">
          <h2 className="panel-title">📊 Observability</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{metrics.uptime_seconds}s</div>
              <div className="metric-label">Uptime</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics.total_requests}</div>
              <div className="metric-label">Total Requests</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics.chat_requests}</div>
              <div className="metric-label">Chat Requests</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics.errors_total}</div>
              <div className="metric-label">Errors</div>
            </div>
          </div>
          {Object.keys(metrics.endpoints).length > 0 && (
            <div className="endpoints-table">
              <h3 className="table-title">Endpoint Breakdown</h3>
              <table>
                <thead>
                  <tr><th>Path</th><th>Requests</th><th>Avg Duration</th></tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.endpoints).map(([path, stat]: any) => (
                    <tr key={path}>
                      <td className="path-cell">{path}</td>
                      <td>{stat.requests}</td>
                      <td>{stat.avg_duration_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button className="refresh-btn" onClick={fetchMetrics}>↻ Refresh</button>
        </div>
      )}

      {/* Chat Messages */}
      <main className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="avatar">{msg.role === 'user' ? '👤' : '⚡'}</div>
            <div className="bubble">
              <p
                dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
              />
              {msg.isStreaming && <span className="cursor">▋</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="input-bar">
        <textarea
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your documents…"
          rows={1}
          disabled={isLoading}
        />
        <button
          className={`send-btn ${isLoading ? 'loading' : ''}`}
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? '⏳' : '➤'}
        </button>
      </footer>
    </div>
  );
}
