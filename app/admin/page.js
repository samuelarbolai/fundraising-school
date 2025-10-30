"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FriendlyVcChatModal } from "@/components/FriendlyVcChatModal";

const ADMIN_PASSWORD = "1234";
const DEFAULT_AGENT_SLUG = "sales-coach";

const AGENT_CONFIG = {
  "sales-coach": {
    label: "Sales Coach",
    assistantLabel: "Sebas",
    title: "Sales Coach — Sebas",
    subtitle: "Brutal sales coach energy. Bring receipts, get unstuck, leave with homework.",
  },
  "friendly-vc-analyst": {
    label: "Friendly VC Analyst",
    assistantLabel: "Friendly VC Analyst",
    title: "Friendly VC Analyst",
    subtitle: "Screen startups against the 30x thesis and surface actionable warm intros.",
  },
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [agents, setAgents] = useState([]);
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(DEFAULT_AGENT_SLUG);
  const [prompts, setPrompts] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [promptVersion, setPromptVersion] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const agentConfig = useMemo(
    () => AGENT_CONFIG[selectedAgentSlug] || AGENT_CONFIG[DEFAULT_AGENT_SLUG],
    [selectedAgentSlug]
  );

  const agentOptions = useMemo(() => {
    if (agents.length) {
      return agents.map(agent => ({
        slug: agent.slug,
        label: AGENT_CONFIG[agent.slug]?.label || agent.name || agent.slug,
      }));
    }
    return Object.entries(AGENT_CONFIG).map(([slug, config]) => ({ slug, label: config.label }));
  }, [agents]);

  const resetFeedback = () => setFeedback(null);

  const fetchPrompts = useCallback(
    async (agent = selectedAgentSlug) => {
      if (!isAuthenticated) return { isSuperAdmin };
      resetFeedback();
      try {
        const response = await fetch(`/api/admin/prompts?agent=${agent}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load prompts.");
        }
        const payload = await response.json();
        setPrompts(Array.isArray(payload?.prompts) ? payload.prompts : []);
        setCurrentPrompt(payload?.currentPrompt || null);
        const superFlag = payload?.isSuperAdmin ?? true;
        setIsSuperAdmin(superFlag);
        if (Array.isArray(payload?.agents)) {
          setAgents(payload.agents);
        }
        if (payload?.agentSlug) {
          setSelectedAgentSlug(payload.agentSlug);
        }
        return { isSuperAdmin: superFlag };
      } catch (error) {
        setFeedback({ type: "error", message: error.message || "Failed to load prompts." });
        return { isSuperAdmin };
      }
    },
    [isAuthenticated, isSuperAdmin, selectedAgentSlug]
  );

  const fetchAdmins = useCallback(
    async (force = false) => {
      if (!isAuthenticated) return;
      if (!force && !isSuperAdmin) return;
      resetFeedback();
      try {
        const response = await fetch("/api/admin/admins", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load admin users.");
        }
        const payload = await response.json();
        setAdmins(Array.isArray(payload?.admins) ? payload.admins : []);
      } catch (error) {
        setFeedback({ type: "error", message: error.message || "Failed to load admin users." });
      }
    },
    [isAuthenticated, isSuperAdmin]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const result = await fetchPrompts(selectedAgentSlug);
      if (result?.isSuperAdmin) {
        await fetchAdmins(true);
      }
    })();
  }, [fetchAdmins, fetchPrompts, isAuthenticated, selectedAgentSlug]);

  const handleLogin = async event => {
    event.preventDefault();
    if (password.trim() === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError("");
      setPassword("");
    } else {
      setAuthError("Incorrect password. Try 1234.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAgents([]);
    setPrompts([]);
    setCurrentPrompt(null);
    setAdmins([]);
    setFeedback(null);
  };

  const handleCreatePrompt = async event => {
    event.preventDefault();
    resetFeedback();
    try {
      const response = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSlug: selectedAgentSlug, version: promptVersion, content: promptContent }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create prompt.");
      }
      setPromptVersion("");
      setPromptContent("");
      setFeedback({ type: "success", message: "Prompt saved." });
      await fetchPrompts(selectedAgentSlug);
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to create prompt." });
    }
  };

  const handleAddAdmin = async event => {
    event.preventDefault();
    resetFeedback();
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Could not add admin.");
      }
      setNewAdminEmail("");
      setFeedback({ type: "success", message: "Admin added." });
      await fetchAdmins(true);
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Could not add admin." });
    }
  };

  const handleAgentChange = async event => {
    const value = event.target.value;
    setSelectedAgentSlug(value);
    setPromptVersion("");
    setPromptContent("");
    const result = await fetchPrompts(value);
    if (result?.isSuperAdmin) {
      await fetchAdmins(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <h1>Admin Sign In</h1>
          <form onSubmit={handleLogin} className="admin-form">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Enter admin password"
              required
            />
            <button type="submit">Sign in</button>
          </form>
          {authError && <p className="admin-msg admin-msg--error">{authError}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <header className="admin-header">
          <div>
            <h1>Friendly VC Admin Console</h1>
            <p>Switch agents, update system prompts, and manage access.</p>
          </div>
          <div className="admin-actions">
            <label className="admin-agent-picker">
              <span>Agent</span>
              <select value={selectedAgentSlug} onChange={handleAgentChange}>
                {agentOptions.map(option => (
                  <option key={option.slug} value={option.slug}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <a className="admin-link-button" href="/table">View analyst table</a>
            <button type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        {feedback && <p className={`admin-msg admin-msg--${feedback.type}`}>{feedback.message}</p>}

        <section className="admin-section">
          <h2>Current Prompt — {agentConfig.label}</h2>
          {currentPrompt ? (
            <article className="prompt-preview">
              <h3>Version {currentPrompt.version}</h3>
              <time dateTime={currentPrompt.createdAt}>Created {new Date(currentPrompt.createdAt).toLocaleString()}</time>
              <pre>{currentPrompt.content}</pre>
            </article>
          ) : (
            <p>No prompt stored yet.</p>
          )}
        </section>

        <section className="admin-section">
          <h2>Prompt History — {agentConfig.label}</h2>
          {prompts.length === 0 && <p>No prompts stored yet.</p>}
          {prompts.length > 0 && (
            <ul className="prompt-history">
              {prompts.map(prompt => (
                <li key={prompt.id}>
                  <span>
                    <strong>{prompt.version}</strong> — {new Date(prompt.createdAt).toLocaleString()}
                  </span>
                  {prompt.createdByEmail && <span className="prompt-author">by {prompt.createdByEmail}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <div className="admin-main">
        <section className="admin-section">
          <div className="admin-header">
            <div>
              <h2>Prompt Builder</h2>
              <p>Create and iterate on prompts per agent.</p>
            </div>
            <div className="admin-actions">
              <button type="button" onClick={() => setChatOpen(true)}>Open {agentConfig.label} Chat</button>
            </div>
          </div>
          <form className="admin-form" onSubmit={handleCreatePrompt}>
            <div className="admin-agent-context">Editing prompt for <strong>{agentConfig.label}</strong></div>
            <label htmlFor="prompt-version">Version</label>
            <input
              id="prompt-version"
              value={promptVersion}
              onChange={event => setPromptVersion(event.target.value)}
              placeholder="e.g. v2"
              required
            />
            <label htmlFor="prompt-content">Prompt Content</label>
            <textarea
              id="prompt-content"
              value={promptContent}
              onChange={event => setPromptContent(event.target.value)}
              placeholder="Paste the full system prompt here"
              rows={10}
              required
            />
            <button type="submit">Save prompt</button>
          </form>
        </section>

        {isSuperAdmin && (
          <section className="admin-section">
            <h2>Admin Users</h2>
            <form className="admin-form" onSubmit={handleAddAdmin}>
              <label htmlFor="new-admin-email">Invite admin</label>
              <input
                id="new-admin-email"
                type="email"
                value={newAdminEmail}
                onChange={event => setNewAdminEmail(event.target.value)}
                placeholder="new-admin@example.com"
                required
              />
              <button type="submit">Add admin</button>
            </form>
            <ul className="admin-list">
              {admins.map(record => (
                <li key={record.email}>
                  <span>{record.email}</span>
                  <span className="admin-role">{record.role || 'admin'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <FriendlyVcChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          agentSlug={selectedAgentSlug}
          assistantLabel={agentConfig.assistantLabel}
          title={agentConfig.title}
          subtitle={agentConfig.subtitle}
        />
      </div>
    </main>
  );
}
