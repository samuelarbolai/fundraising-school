"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getInitialAssistantMessage } from "@/lib/friendlyVc/constants";

const LOCAL_STORAGE_KEY = "friendly-vc-conversations";
const LOCAL_PROMPT_VERSION = "local";

function nowIso() {
  return new Date().toISOString();
}

function deriveTitle(content) {
  if (!content) return "Untitled chat";
  const value = content.trim().replace(/\s+/g, " ");
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

function readLocalState(storageKey) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[Friendly VC] Failed to read local storage", error);
    return null;
  }
}

function writeLocalState(storageKey, payload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.warn("[Friendly VC] Failed to persist local storage", error);
  }
}

async function consumeSse(response, handlers) {
  if (!response.body) {
    throw new Error("No response stream available");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n\n");
    buffer = segments.pop() || "";

    for (const segment of segments) {
      const lines = segment.split("\n").filter(Boolean);
      let eventName = "message";
      let dataLine = null;
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.replace("event:", "").trim();
        } else if (line.startsWith("data:")) {
          dataLine = line.replace("data:", "").trim();
        }
      }
      if (!dataLine) continue;
      const data = JSON.parse(dataLine);
      if (eventName === "meta" && handlers.onMeta) {
        handlers.onMeta(data);
      } else if (eventName === "token" && handlers.onToken) {
        handlers.onToken(data);
      } else if (eventName === "done" && handlers.onDone) {
        handlers.onDone(data);
      }
    }
  }
}

export function FriendlyVcChatModal({
  open,
  onClose,
  agentSlug = "sales-coach",
  assistantLabel = "Sebas",
  title = "Friendly VC Agent",
  subtitle = "Chat with the selected agent.",
}) {
  const supabase = createClient();
  const [authStatus, setAuthStatus] = useState("unknown"); // unknown | authenticated | guest | unauthenticated
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messagesById, setMessagesById] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const previousOverflow = useRef("");

  const initialAssistantMessage = useMemo(() => getInitialAssistantMessage(agentSlug), [agentSlug]);
  const storageKey = useMemo(() => `${LOCAL_STORAGE_KEY}-${agentSlug}`, [agentSlug]);

  const hasAccess = emailSubmitted || authStatus === "authenticated" || guestMode;

  const activeMessages = useMemo(() => {
    if (!activeConversationId) {
      return [initialAssistantMessage];
    }
    const messages = messagesById[activeConversationId];
    return messages && messages.length ? messages : [initialAssistantMessage];
  }, [activeConversationId, messagesById, initialAssistantMessage]);

  useEffect(() => {
    if (!open) return;
    const attach = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setAuthStatus("authenticated");
        setEmailSubmitted(true);
      } else {
        setAuthStatus("unauthenticated");
      }
    };
    attach();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthStatus("authenticated");
        setEmailSubmitted(true);
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [open, supabase]);

  useEffect(() => {
    setConversations([]);
    setMessagesById({});
    setActiveConversationId(null);
    setDraft("");
  }, [agentSlug]);

  useEffect(() => {
    if (open) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      inputRef.current?.focus();
    } else {
      document.body.style.overflow = previousOverflow.current;
      setEmail("");
      setEmailSubmitted(false);
      setGuestMode(false);
      setDraft("");
      setErrorMessage("");
      setToast(null);
    }
    return () => {
      document.body.style.overflow = previousOverflow.current;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = event => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !hasAccess) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, open, hasAccess]);

  useEffect(() => {
    if (!open || !hasAccess) return;
    if (authStatus === "authenticated") {
      refreshRemoteConversations();
    } else {
      loadLocalConversations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, hasAccess, open]);

  const loadLocalConversations = useCallback(() => {
    const stored = readLocalState(storageKey);
    if (!stored) {
      setConversations([]);
      setMessagesById({});
      setActiveConversationId(null);
      return;
    }
    const { conversations: savedConversations = [], messages: savedMessages = {} } = stored;
    setConversations(savedConversations);
    setMessagesById(savedMessages);
    setActiveConversationId(savedConversations[0]?.id || null);
  }, [storageKey, initialAssistantMessage]);

  const persistLocalState = useCallback(
    (nextConversations, nextMessages) => {
      if (authStatus === "authenticated") return;
      writeLocalState(storageKey, { conversations: nextConversations, messages: nextMessages });
    },
    [authStatus, storageKey]
  );

  const refreshRemoteConversations = useCallback(async () => {
    try {
      const response = await fetch(`/api/friendly-vc/conversations?agent=${agentSlug}`, { cache: "no-store" });
      if (response.status === 401) {
        setAuthStatus("unauthenticated");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }
      const payload = await response.json();
      const list = Array.isArray(payload?.conversations) ? payload.conversations : [];
      setConversations(list);
      if (list.length && !activeConversationId) {
        setActiveConversationId(list[0].id);
      }
    } catch (error) {
      console.error("[Friendly VC] conversation list error", error);
      setToast({ type: "error", message: "Could not load chats." });
    }
  }, [activeConversationId, agentSlug]);

  useEffect(() => {
    if (!open || authStatus !== "authenticated") return;
    refreshRemoteConversations();
  }, [agentSlug, open, authStatus, refreshRemoteConversations]);

  const fetchConversationMessages = useCallback(
    async conversationId => {
      if (messagesById[conversationId]) return;
      try {
        const response = await fetch(`/api/friendly-vc/conversations/${conversationId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load conversation");
        }
        const payload = await response.json();
        const records = Array.isArray(payload?.messages) ? payload.messages : [];
        const formatted = records.map(record => ({
          id: record.id,
          role: record.role,
          content: record.content,
          sequence: record.sequence,
          model: record.model,
          tokenUsage: record.tokenUsage,
        }));
        setMessagesById(prev => ({ ...prev, [conversationId]: formatted.length ? formatted : [initialAssistantMessage] }));
      } catch (error) {
        console.error("[Friendly VC] load conversation error", error);
        setToast({ type: "error", message: "Could not load that chat." });
      }
    },
    [messagesById]
  );

  useEffect(() => {
    if (authStatus === "authenticated" && activeConversationId) {
      fetchConversationMessages(activeConversationId);
    }
  }, [authStatus, activeConversationId, fetchConversationMessages]);

  const handleEmailSubmit = async event => {
    event.preventDefault();
    setErrorMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.href,
      },
    });

    if (error) {
      setErrorMessage(`Error: ${error.message}`);
    } else {
      setEmailSubmitted(true);
      setToast({ type: "info", message: "Check your email for a magic link to unlock history." });
    }
  };

  const beginGuestMode = () => {
    setGuestMode(true);
    setEmailSubmitted(true);
    setAuthStatus("guest");
    loadLocalConversations();
  };

  const handleStartNewConversation = () => {
    if (isStreaming) return;
    setActiveConversationId(null);
    setDraft("");
  };

  const selectConversation = async conversationId => {
    if (conversationId === activeConversationId) return;
    setActiveConversationId(conversationId);
    if (authStatus === "authenticated") {
      await fetchConversationMessages(conversationId);
    }
  };

  const updateMessages = useCallback((conversationId, updater) => {
    setMessagesById(prev => {
      const current = prev[conversationId] || [initialAssistantMessage];
      const next = updater(current);
      return { ...prev, [conversationId]: next };
    });
  }, [initialAssistantMessage]);

  const promoteConversationId = useCallback(
    (pendingId, actualId, meta) => {
      setMessagesById(prev => {
        const pendingMessages = prev[pendingId] || [initialAssistantMessage];
        const next = { ...prev };
        delete next[pendingId];
        next[actualId] = pendingMessages;
        return next;
      });
      setConversations(prev => {
        const filtered = prev.filter(item => item.id !== pendingId && item.id !== actualId);
        const now = meta?.createdAt || nowIso();
        const entry = {
          id: actualId,
          title: meta?.title || deriveTitle(meta?.lastMessage || ""),
          promptVersion: meta?.promptVersion || LOCAL_PROMPT_VERSION,
          createdAt: now,
          lastInteractedAt: now,
          agentSlug: meta?.agentSlug || agentSlug,
        };
        return [entry, ...filtered];
      });
      setActiveConversationId(actualId);
    },
    [agentSlug, initialAssistantMessage]
  );

  const handleSendMessage = async event => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isStreaming) return;

    setDraft("");
    setErrorMessage("");
    setToast(null);

    if (authStatus !== "authenticated") {
      const localId = activeConversationId || `local-${Date.now()}`;
      const timestamp = nowIso();
      const existingMessages = messagesById[localId]?.length ? messagesById[localId] : [initialAssistantMessage];
      const userRecord = { id: `user-${timestamp}`, role: "user", content: trimmed, createdAt: timestamp };
      const nextMessages = [...existingMessages, userRecord];
      const nextConversations = (() => {
        const base = conversations.filter(item => item.id !== localId);
        const meta = {
          id: localId,
          title: deriveTitle(trimmed),
          promptVersion: LOCAL_PROMPT_VERSION,
          createdAt: conversations.find(item => item.id === localId)?.createdAt || timestamp,
          lastInteractedAt: timestamp,
          agentSlug,
        };
        return [meta, ...base];
      })();

      setActiveConversationId(localId);
      setConversations(nextConversations);
      setMessagesById(prev => {
        const nextMap = { ...prev, [localId]: nextMessages };
        persistLocalState(nextConversations, nextMap);
        return nextMap;
      });
      setToast({ type: "info", message: "Sign in to sync this chat." });
      return;
    }

    let workingId = activeConversationId;
    let pendingId = null;
    const timestamp = nowIso();

    if (!workingId) {
      pendingId = `pending-${Date.now()}`;
      workingId = pendingId;
      setConversations(prev => [
        {
          id: pendingId,
          title: deriveTitle(trimmed),
          promptVersion: LOCAL_PROMPT_VERSION,
          createdAt: timestamp,
          lastInteractedAt: timestamp,
          isPending: true,
        },
        ...prev,
      ]);
      setActiveConversationId(pendingId);
    }

    const assistantMessageId = `assistant-${Date.now()}`;
    updateMessages(workingId, current => ([
      ...(current.length ? current : [initialAssistantMessage]),
      { id: `user-${timestamp}`, role: "user", content: trimmed, createdAt: timestamp },
      { id: assistantMessageId, role: "assistant", content: "", pending: true },
    ]));

    setIsStreaming(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("friendlyvc:request", {
        detail: {
          conversationId: workingId,
          contentLength: trimmed.length,
          timestamp,
          agentSlug,
        },
      })
    );
  }

    try {
      const response = await fetch("/api/friendly-vc/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: workingId.startsWith("pending-") ? null : workingId,
          content: trimmed,
          agentSlug,
        }),
      });

      if (!response.ok) {
        let detail = "Sebas is unavailable. Try again soon.";
        try {
          const payload = await response.json();
          detail = payload?.error || detail;
          if (response.status === 429 && payload?.code) {
            const retryAfter = response.headers.get("Retry-After");
            setToast({ type: "error", message: detail, retryAfter });
          }
        } catch (error) {
          // ignore parse issues
        }
        throw new Error(detail);
      }

      let liveConversationId = workingId;

      await consumeSse(response, {
        onMeta: data => {
          if (pendingId && data.conversationId) {
            promoteConversationId(pendingId, data.conversationId, { ...data, lastMessage: trimmed });
            liveConversationId = data.conversationId;
          }
        },
        onToken: data => {
          updateMessages(liveConversationId, current => current.map(message => (
            message.id === assistantMessageId
              ? { ...message, content: `${message.content || ""}${data.content || ""}` }
              : message
          )));
        },
        onDone: data => {
          updateMessages(liveConversationId, current => current.map(message => (
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: data?.content || message.content,
                  pending: false,
                  tokenUsage: data?.usage,
                }
              : message
          )));
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("friendlyvc:response", {
                detail: {
                  conversationId: liveConversationId,
                  tokenUsage: data?.usage,
                  agentSlug,
                },
              })
            );
          }
        },
      });

      await refreshRemoteConversations();
    } catch (error) {
      console.error("[Friendly VC] send error", error);
      setErrorMessage(error.message || "Unexpected error. Try again.");
      setDraft(trimmed);
      updateMessages(workingId, current => current.filter(message => message.id !== assistantMessageId));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("friendlyvc:error", {
            detail: {
              conversationId: workingId,
              message: error.message,
              agentSlug,
            },
          })
        );
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleOverlayClick = event => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const renderGate = () => (
    <div className="friendly-vc-modal__auth">
      <form onSubmit={handleEmailSubmit}>
        <label htmlFor="email-input">Enter your email to start and save your chat history.</label>
        <input
          id="email-input"
          ref={inputRef}
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="you@startup.com"
          required
        />
        <button type="submit">Send magic link</button>
        <button type="button" className="friendly-vc-modal__secondary" onClick={beginGuestMode}>
          Continue without signing in
        </button>
        {errorMessage && <p className="friendly-vc-modal__error">{errorMessage}</p>}
      </form>
    </div>
  );

  return (
    <div
      className={`friendly-vc-modal ${open ? "is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="friendly-vc-title"
      aria-hidden={open ? "false" : "true"}
      onClick={handleOverlayClick}
    >
      <section className="friendly-vc-modal__dialog">
        <header className="friendly-vc-modal__header">
          <div>
            <h2 id="friendly-vc-title">{title}</h2>
            <p className="friendly-vc-modal__subtitle">{subtitle}</p>
          </div>
          <button type="button" className="friendly-vc-modal__close" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        </header>

        {!hasAccess ? (
          renderGate()
        ) : (
          <div className="friendly-vc-modal__body">
            <aside className="friendly-vc-sidebar" aria-label="Previous conversations">
              <div className="friendly-vc-sidebar__header">
                <h3>History</h3>
                <button type="button" onClick={handleStartNewConversation} disabled={isStreaming}>
                  New chat
                </button>
              </div>
              <ul className="friendly-vc-sidebar__list">
                {conversations.map(conversation => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      className={`friendly-vc-sidebar__item ${conversation.id === activeConversationId ? "is-active" : ""}`}
                      onClick={() => selectConversation(conversation.id)}
                    >
                      <span>{conversation.title || "Untitled chat"}</span>
                    </button>
                  </li>
                ))}
                {conversations.length === 0 && (
                  <li className="friendly-vc-sidebar__empty">No saved chats yet.</li>
                )}
              </ul>
            </aside>

            <div className="friendly-vc-modal__conversation">
              <div className="friendly-vc-modal__messages">
                {activeMessages.map(message => (
                  <div
                    key={message.id || `${message.role}-${message.content.slice(0, 16)}`}
                    className={`friendly-vc-message friendly-vc-message--${message.role}`}
                  >
                  <span className="friendly-vc-message__label">
                    {message.role === "assistant" ? assistantLabel : "You"}
                  </span>
                    <p>{message.content}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {(errorMessage || toast) && (
                <div className="friendly-vc-modal__status">
                  {errorMessage && <p className="friendly-vc-modal__error">{errorMessage}</p>}
                  {toast && <p className={`friendly-vc-modal__toast friendly-vc-modal__toast--${toast.type}`}>{toast.message}</p>}
                </div>
              )}

              <form className="friendly-vc-modal__form" onSubmit={handleSendMessage}>
                <label htmlFor="friendly-vc-input" className="friendly-vc-modal__label">
                  What are you diagnosing?
                </label>
                <div className="friendly-vc-modal__input-group">
                  <textarea
                    id="friendly-vc-input"
                    ref={inputRef}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="Spell it out. What did the customer say? What's the blocker?"
                    rows={3}
                    disabled={isStreaming}
                    required
                  />
                  <button type="submit" className="friendly-vc-modal__submit" disabled={isStreaming}>
                    {isStreaming ? "Pressuring..." : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
