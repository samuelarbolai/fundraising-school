"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
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
  const storageKey = useMemo(() => {
    const normalized = emailSubmitted ? email.trim().toLowerCase() : "guest";
    return `${LOCAL_STORAGE_KEY}-${agentSlug}-${normalized}`;
  }, [agentSlug, email, emailSubmitted]);

  const hasAccess = emailSubmitted;

  const activeMessages = useMemo(() => {
    if (!activeConversationId) {
      return [initialAssistantMessage];
    }
    const messages = messagesById[activeConversationId];
    return messages && messages.length ? messages : [initialAssistantMessage];
  }, [activeConversationId, messagesById, initialAssistantMessage]);

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
    loadLocalConversations();
  }, [hasAccess, loadLocalConversations, open]);

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
  }, [storageKey]);

  const persistLocalState = useCallback(
    (nextConversations, nextMessages) => {
      writeLocalState(storageKey, { conversations: nextConversations, messages: nextMessages });
    },
    [storageKey]
  );

  const handleEmailSubmit = async event => {
    event.preventDefault();
    setEmailSubmitted(true);
    setErrorMessage("");
    setToast(null);
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
  };

  const updateMessages = useCallback(
    (conversationId, updater) => {
      setMessagesById(prev => {
        const current = prev[conversationId] || [initialAssistantMessage];
        const next = updater(current);
        const nextMap = { ...prev, [conversationId]: next };
        persistLocalState(conversations, nextMap);
        return nextMap;
      });
    },
    [conversations, initialAssistantMessage, persistLocalState]
  );

  const promoteConversationId = useCallback(
    (pendingId, actualId, meta) => {
      setMessagesById(prev => {
        const pendingMessages = prev[pendingId] || [initialAssistantMessage];
        const nextMessages = { ...prev };
        delete nextMessages[pendingId];
        nextMessages[actualId] = pendingMessages;

        setConversations(prevConversations => {
          const filtered = prevConversations.filter(item => item.id !== pendingId && item.id !== actualId);
          const now = meta?.createdAt || nowIso();
          const entry = {
            id: actualId,
            title: meta?.title || deriveTitle(meta?.lastMessage || ""),
            promptVersion: meta?.promptVersion || LOCAL_PROMPT_VERSION,
            createdAt: now,
            lastInteractedAt: now,
            agentSlug: meta?.agentSlug || agentSlug,
          };
          const nextConversations = [entry, ...filtered];
          persistLocalState(nextConversations, nextMessages);
          return nextConversations;
        });

        return nextMessages;
      });
      setActiveConversationId(actualId);
    },
    [agentSlug, initialAssistantMessage, persistLocalState]
  );

  const handleSendMessage = async event => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isStreaming) return;

    if (!emailSubmitted) {
      setErrorMessage("Enter your email to start chatting.");
      return;
    }

    const timestamp = nowIso();
    const assistantMessageId = `assistant-${Date.now()}`;

    let workingId = activeConversationId;
    let pendingId = null;

    if (!workingId) {
      pendingId = `pending-${Date.now()}`;
      workingId = pendingId;
    }

    setDraft("");
    setErrorMessage("");
    setToast(null);

    setMessagesById(prev => {
      const history = Array.isArray(prev[workingId]) && prev[workingId].length ? prev[workingId] : [initialAssistantMessage];
      const userMessage = { id: `user-${timestamp}`, role: "user", content: trimmed, createdAt: timestamp };
      const assistantPlaceholder = { id: assistantMessageId, role: "assistant", content: "", pending: true };
      const nextMessages = [...history, userMessage, assistantPlaceholder];
      const nextMap = { ...prev, [workingId]: nextMessages };

      setConversations(prevConversations => {
        const existing = prevConversations.find(item => item.id === workingId);
        const meta = existing
          ? {
              ...existing,
              title: existing.title || deriveTitle(trimmed),
              lastInteractedAt: timestamp,
              isPending: existing.isPending || Boolean(pendingId),
            }
          : {
              id: workingId,
              title: deriveTitle(trimmed),
              promptVersion: LOCAL_PROMPT_VERSION,
              createdAt: timestamp,
              lastInteractedAt: timestamp,
              agentSlug,
              isPending: Boolean(pendingId),
            };
        const filtered = prevConversations.filter(item => item.id !== workingId);
        const nextConversations = [meta, ...filtered];
        persistLocalState(nextConversations, nextMap);
        return nextConversations;
      });

      return nextMap;
    });

    setActiveConversationId(workingId);

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
          email: email.trim(),
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
      setConversations(prev => {
        const next = prev.map(conversation =>
          conversation.id === liveConversationId
            ? { ...conversation, lastInteractedAt: nowIso(), isPending: false }
            : conversation
        );
        setMessagesById(prevMessages => {
          persistLocalState(next, prevMessages);
          return prevMessages;
        });
        return next;
      });
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
        <label htmlFor="email-input">Enter your email to start the chat.</label>
        <input
          id="email-input"
          ref={inputRef}
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="you@startup.com"
          required
        />
        <button type="submit">Start chat</button>
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
