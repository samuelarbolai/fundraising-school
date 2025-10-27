"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function LatamSourcingModal({ open, onClose }) {
  const previousOverflow = useRef("");

  useEffect(() => {
    if (open) {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
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

  const handleOverlayClick = event => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`latam-modal ${open ? "is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="latam-modal-title"
      aria-hidden={open ? "false" : "true"}
      onClick={handleOverlayClick}
    >
      <section className="latam-modal__dialog">
        <header className="latam-modal__header">
          <div>
            <h2 id="latam-modal-title">LATAM Lead Sourcing Hub</h2>
            <p className="latam-modal__subtitle">
              Rapid intel on who to contact, how to reach them, and where to press for momentum across the region.
            </p>
          </div>
          <button type="button" className="latam-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </header>

        <div className="latam-modal__body">
          <ul>
            <li>Precision filters on industry, vertical, headcount, and seniority.</li>
            <li>Enrichment-ready exports with verified contact details.</li>
            <li>Weekly refresh so your pipeline stays warm.</li>
          </ul>
        </div>

        <footer className="latam-modal__footer">
          <Link href="/latam-sourcing" className="latam-modal__cta" onClick={onClose}>
            Enter sourcing workspace
          </Link>
          <p className="latam-modal__helper">No signup needed. Explore with sample data right away.</p>
        </footer>
      </section>
    </div>
  );
}
