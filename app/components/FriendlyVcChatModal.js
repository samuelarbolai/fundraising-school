"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_ASSISTANT_MESSAGE = {
  role: "assistant",
  content:
    "Sebas here. What's breaking in your sales conversations? Give me the specifics so we can fix the right gate.",
};

export function FriendlyVcChatModal({ open, onClose }) {
  const [messages, setMessages] = useState([INITIAL_ASSISTANT_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const previousOverflow = useRef("");

  useEffect(() => {
    if (open) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      inputRef.current?.focus();
    } else {
      document.body.style.overflow = previousOverflow.current;
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
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (!inputValue.trim() || isSending) {
      return;
    }

    const userMessage = { role: "user", content: inputValue.trim() };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInputValue("");
    setIsSending(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/friendly-vc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.reply) {
        throw new Error(payload?.error || "Failed to reach Sebas. Try again.");
      }

      setMessages(prev => [...prev, { role: "assistant", content: payload.reply }]);
    } catch (error) {
      console.error("[Friendly VC] send error", error);
      setErrorMessage(error.message || "Unexpected error. Try again.");
      setMessages(prev => prev.slice(0, -1));
      setInputValue(userMessage.content);
    } finally {
      setIsSending(false);
    }
  };

  const handleOverlayClick = event => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

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
            <h2 id="friendly-vc-title">Friendly VC — Sebas</h2>
            <p className="friendly-vc-modal__subtitle">
              Brutal sales coach energy. Bring receipts, get unstuck, leave with homework.
            </p>
          </div>
          <button type="button" className="friendly-vc-modal__close" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        </header>

        <div className="friendly-vc-modal__messages">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`friendly-vc-message friendly-vc-message--${message.role}`}
            >
              <span className="friendly-vc-message__label">
                {message.role === "assistant" ? "Sebas" : "You"}
              </span>
              <p>{message.content}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {errorMessage && <p className="friendly-vc-modal__error">{errorMessage}</p>}

        <form className="friendly-vc-modal__form" onSubmit={handleSubmit}>
          <label htmlFor="friendly-vc-input" className="friendly-vc-modal__label">
            What are you diagnosing?
          </label>
          <div className="friendly-vc-modal__input-group">
            <textarea
              id="friendly-vc-input"
              ref={inputRef}
              value={inputValue}
              onChange={event => setInputValue(event.target.value)}
              placeholder="Spell it out. What did the customer say? What's the blocker?"
              rows={3}
              disabled={isSending}
              required
            />
            <button type="submit" className="friendly-vc-modal__submit" disabled={isSending}>
              {isSending ? "Pressuring..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
