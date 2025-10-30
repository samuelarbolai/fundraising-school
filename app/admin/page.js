"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FriendlyVcChatModal } from "@/components/FriendlyVcChatModal";

const supabase = createClient();
const ADMIN_REDIRECT_URL = "https://fundraising-school.onrender.com/admin";

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
  const [authStatus, setAuthStatus] = useState("loading"); // loading | signedOut | pending | ready | forbidden
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(DEFAULT_AGENT_SLUG);
  const [prompts, setPrompts] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [promptVersion, setPromptVersion] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const agentConfig = useMemo(() => AGENT_CONFIG[selectedAgentSlug] || AGENT_CONFIG[DEFAULT_AGENT_SLUG], [selectedAgentSlug]);
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

  const fetchPrompts = useCallback(async (agent = selectedAgentSlug) => {
    resetFeedback();
    const response = await fetch(`/api/admin/prompts?agent=${agent}`, { cache: "no-store" });
    if (response.status === 401) {
      setAuthStatus("signedOut");
      return { isSuperAdmin: false };
    }
    if (response.status === 403) {
      setAuthStatus("forbidden");
      return { isSuperAdmin: false };
    }
    if (!response.ok) {
      setFeedback({ type: "error", message: "Failed to load prompts." });
      return { isSuperAdmin: false };
    }
    const payload = await response.json();
    setPrompts(Array.isArray(payload?.prompts) ? payload.prompts : []);
    setCurrentPrompt(payload?.currentPrompt || null);
    const superFlag = Boolean(payload?.isSuperAdmin);
    setIsSuperAdmin(superFlag);
    if (!superFlag) {
      setAdmins([]);
    }
    if (Array.isArray(payload?.agents)) {
      setAgents(payload.agents);
    }
    if (payload?.agentSlug) {
      setSelectedAgentSlug(payload.agentSlug);
    }
    return { isSuperAdmin: superFlag };
  }, [selectedAgentSlug]);

  const fetchAdmins = useCallback(async (force = false) => {
    if (!force && !isSuperAdmin) return;
    resetFeedback();
    const response = await fetch("/api/admin/admins", { cache: "no-store" });
    if (!response.ok) {
      setFeedback({ type: "error", message: "Failed to load admin users." });
      return;
    }
    const payload = await response.json();
    setAdmins(Array.isArray(payload?.admins) ? payload.admins : []);
  }, [isSuperAdmin]);

  const initialize = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      setAuthStatus("ready");
      const result = await fetchPrompts(selectedAgentSlug);
      if (result?.isSuperAdmin) {
        await fetchAdmins(true);
      }
    } else {
      setAuthStatus("signedOut");
    }
  }, [fetchAdmins, fetchPrompts, selectedAgentSlug]);

  useEffect(() => {
    initialize();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setAuthStatus("ready");
        setOtpSent(false);
        const result = await fetchPrompts(selectedAgentSlug);
        if (result?.isSuperAdmin) {
          await fetchAdmins(true);
        }
      } else {
        setAuthStatus("signedOut");
        setPrompts([]);
        setAdmins([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [fetchAdmins, fetchPrompts, initialize, selectedAgentSlug]);

  const handleEmailSubmit = async event => {
    event.preventDefault();
    resetFeedback();
    setOtpSent(false);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: ADMIN_REDIRECT_URL,
      },
    });
    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setOtpSent(true);
      setFeedback({ type: "info", message: "Check your inbox for the magic link." });
    }
  };

  const handleCreatePrompt = async event => {
    event.preventDefault();
    resetFeedback();
    const response = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentSlug: selectedAgentSlug, version: promptVersion, content: promptContent }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setFeedback({ type: "error", message: payload?.error || "Failed to create prompt." });
      return;
    }
    setPromptVersion("");
    setPromptContent("");
    setFeedback({ type: "success", message: "Prompt saved." });
    await fetchPrompts(selectedAgentSlug);
  };

  const handleAddAdmin = async event => {
    event.preventDefault();
    resetFeedback();
    const response = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newAdminEmail }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFeedback({ type: "error", message: payload?.error || "Could not add admin." });
      return;
    }
    setNewAdminEmail("");
    setFeedback({ type: "success", message: "Admin added." });
    await fetchAdmins();
  };

  const handleSignOut = async () => {
    resetFeedback();
    await supabase.auth.signOut();
    setAuthStatus("signedOut");
    setPrompts([]);
    setAdmins([]);
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

  if (authStatus === "loading") {
    return <main className="admin-page"><p>Loading…</p></main>;
  }

  if (authStatus === "signedOut") {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <h1>Admin Sign In</h1>
          <form onSubmit={handleEmailSubmit} className="admin-form">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
            <button type="submit">Send Magic Link</button>
          </form>
          {otpSent && <p className="admin-hint">Magic link sent. Check your inbox.</p>}
          {feedback && <p className={`admin-msg admin-msg--${feedback.type}`}>{feedback.message}</p>}
        </section>
      </main>
    );
  }

  if (authStatus === "forbidden") {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <h1>Access denied</h1>
          <p>This account is not an admin. Please contact the super admin.</p>
          <button type="button" onClick={handleSignOut}>Sign out</button>
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
            <button type="button" onClick={handleSignOut}>Sign out</button>
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
