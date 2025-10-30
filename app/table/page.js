"use client";

import { useEffect, useMemo, useState } from "react";

const AGENT = "friendly-vc-analyst";
const FIT_OPTIONS = ["Strong Fit", "Promising", "Monitor", "Not a Fit"];

async function fetchOutputs() {
  const response = await fetch(`/api/agent-outputs?agent=${AGENT}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load analyst outputs");
  }
  const payload = await response.json();
  return Array.isArray(payload?.outputs) ? payload.outputs : [];
}

async function updateOutput(id, data) {
  const response = await fetch(`/api/agent-outputs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update output");
  }
}

async function rebuildOutput(id, instructions) {
  const response = await fetch(`/api/agent-outputs/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Failed to regenerate summary");
  }
}

export default function TablePage() {
  const [outputs, setOutputs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sidebarInstructions, setSidebarInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [drafts, setDrafts] = useState({});

  const selected = useMemo(() => outputs.find(row => row.id === selectedId) || null, [outputs, selectedId]);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchOutputs();
      setOutputs(data);
      if (data.length && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDraftChange = (id, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = async id => {
    const patch = drafts[id];
    if (!patch) {
      setMessage({ type: "info", text: "No changes to save." });
      return;
    }
    try {
      await updateOutput(id, patch);
      setMessage({ type: "success", text: "Saved." });
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const handleRebuild = async () => {
    if (!selectedId) return;
    setMessage(null);
    try {
      await rebuildOutput(selectedId, sidebarInstructions);
      setMessage({ type: "success", text: "Summary regenerated." });
      setSidebarInstructions("");
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const handleExport = () => {
    window.location.href = `/api/agent-outputs?agent=${AGENT}&format=csv`;
  };

  return (
    <main className="table-page">
      <aside className="table-sidebar">
        <div className="sidebar-card">
          <h1>Friendly VC Analyst Table</h1>
          <p className="sidebar-meta">Review analyst-generated summaries, adjust fit labels, and capture warm intro targets.</p>
          <button type="button" className="sidebar-export" onClick={handleExport}>
            Export CSV
          </button>
        </div>

        <div className="sidebar-card">
          <h2>Regenerate summary</h2>
          <p className="sidebar-hint">Add optional guidance before regenerating the analyst summary.</p>
          <textarea
            value={sidebarInstructions}
            onChange={event => setSidebarInstructions(event.target.value)}
            placeholder="Example: Emphasize traction metrics or YC Demo Day interest."
            rows={6}
          />
          <button type="button" onClick={handleRebuild} disabled={!selectedId}>Rebuild summary</button>
        </div>
      </aside>

      <section className="table-main">
        {message && <p className={`table-flash table-flash--${message.type}`}>{message.text}</p>}
        <div className="table-wrapper">
          <table className="clay-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Founder</th>
                <th>Contact</th>
                <th>Fit</th>
                <th>Potential connectors</th>
                <th>Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!outputs.length && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {loading ? "Loading analyst runs…" : "No analyst runs yet."}
                  </td>
                </tr>
              )}
              {outputs.map(row => {
                const draft = drafts[row.id] || {};
                return (
                  <tr
                    key={row.id}
                    className={row.id === selectedId ? "is-selected" : ''}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td>
                      <input
                        value={(draft.companyName ?? row.companyName) || ''}
                        onChange={event => handleDraftChange(row.id, 'companyName', event.target.value)}
                        placeholder="Company name"
                      />
                      <div className="table-timestamp">{new Date(row.createdAt).toLocaleString()}</div>
                    </td>
                    <td>
                      <div>{(draft.founderName ?? row.founderName) || '—'}</div>
                      <input
                        value={(draft.founderName ?? row.founderName) || ''}
                        onChange={event => handleDraftChange(row.id, 'founderName', event.target.value)}
                        placeholder="Founder name"
                      />
                    </td>
                    <td>
                      <input
                        value={(draft.founderEmail ?? row.founderEmail) || ''}
                        onChange={event => handleDraftChange(row.id, 'founderEmail', event.target.value)}
                        placeholder="Email"
                        type="email"
                      />
                      <input
                        value={(draft.founderPhone ?? row.founderPhone) || ''}
                        onChange={event => handleDraftChange(row.id, 'founderPhone', event.target.value)}
                        placeholder="Phone"
                      />
                    </td>
                    <td>
                      <select
                        value={(draft.fitLabel ?? row.fitLabel) || ''}
                        onChange={event => handleDraftChange(row.id, 'fitLabel', event.target.value)}
                      >
                        <option value="">Select fit</option>
                        {FIT_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <textarea
                        value={(draft.connectors ?? row.connectors) || ''}
                        onChange={event => handleDraftChange(row.id, 'connectors', event.target.value)}
                        placeholder="Add warm intro targets"
                        rows={3}
                      />
                    </td>
                    <td>
                      <div className="summary-card">
                        <pre>{row.summary || '—'}</pre>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          handleSave(row.id);
                        }}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
