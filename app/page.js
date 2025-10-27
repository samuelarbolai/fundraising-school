"use client";

import { useEffect, useState } from "react";
import { FriendlyVcChatModal } from "./components/FriendlyVcChatModal";
import { LatamSourcingModal } from "./components/LatamSourcingModal";

function useRevealAnimations() {
  useEffect(() => {
    const revealEls = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const delay = entry.target.dataset.delay || 0;
            const timer = setTimeout(() => entry.target.classList.add("is-visible"), Number(delay));
            entry.target.dataset.timer = timer.toString();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -20% 0px" }
    );
    revealEls.forEach(el => observer.observe(el));
    return () => {
      revealEls.forEach(el => {
        if (el.dataset.timer) {
          clearTimeout(Number(el.dataset.timer));
        }
      });
      observer.disconnect();
    };
  }, []);
}

function useParallax() {
  useEffect(() => {
    const parallaxSection = document.querySelector(".parallax-narrative");
    const parallaxBackdrop = parallaxSection?.querySelector(".parallax-backdrop");
    if (!parallaxSection || !parallaxBackdrop) return;
    const handleParallax = () => {
      const rect = parallaxSection.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
      const offset = (progress - 0.5) * 120;
      parallaxBackdrop.style.transform = `translateY(${offset}px)`;
    };
    handleParallax();
    window.addEventListener("scroll", handleParallax);
    return () => window.removeEventListener("scroll", handleParallax);
  }, []);
}

function useTestimonialSlider() {
  useEffect(() => {
    const sliderTrack = document.querySelector(".slider-track");
    const sliderCards = sliderTrack ? Array.from(sliderTrack.children) : [];
    const prevBtn = document.querySelector(".slider-control.prev");
    const nextBtn = document.querySelector(".slider-control.next");
    if (!sliderTrack || !sliderCards.length) return;

    let sliderIndex = 0;
    let sliderTimer = null;

    const updateSlider = () => {
      const cardWidth = sliderCards[0]?.getBoundingClientRect().width || 0;
      const trackStyles = getComputedStyle(sliderTrack);
      const gapValue = parseFloat(trackStyles.columnGap || trackStyles.gap || "0");
      const offset = sliderIndex * (cardWidth + gapValue);
      sliderTrack.style.transform = `translateX(${-offset}px)`;
    };

    const cycleSlider = delta => {
      sliderIndex = (sliderIndex + delta + sliderCards.length) % sliderCards.length;
      updateSlider();
    };

    const startTimer = () => {
      if (sliderTimer) clearInterval(sliderTimer);
      sliderTimer = setInterval(() => cycleSlider(1), 6000);
    };

    const handlePrev = () => {
      cycleSlider(-1);
      startTimer();
    };
    const handleNext = () => {
      cycleSlider(1);
      startTimer();
    };
    const handleMouseEnter = () => {
      if (sliderTimer) clearInterval(sliderTimer);
    };
    const handleMouseLeave = () => startTimer();

    prevBtn?.addEventListener("click", handlePrev);
    nextBtn?.addEventListener("click", handleNext);
    sliderTrack.addEventListener("mouseenter", handleMouseEnter);
    sliderTrack.addEventListener("mouseleave", handleMouseLeave);

    updateSlider();
    startTimer();

    return () => {
      prevBtn?.removeEventListener("click", handlePrev);
      nextBtn?.removeEventListener("click", handleNext);
      sliderTrack.removeEventListener("mouseenter", handleMouseEnter);
      sliderTrack.removeEventListener("mouseleave", handleMouseLeave);
      if (sliderTimer) clearInterval(sliderTimer);
    };
  }, []);
}

function useTabs() {
  useEffect(() => {
    const tabs = document.querySelectorAll(".tab-button");
    const panels = document.querySelectorAll(".tab-panel");

    const handleClick = event => {
      const targetTab = event.currentTarget;
      const target = targetTab.dataset.tab;
      tabs.forEach(btn => {
        const isActive = btn === targetTab;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
      });
      panels.forEach(panel => {
        const isMatch = panel.id === target;
        panel.classList.toggle("active", isMatch);
        panel.setAttribute("aria-hidden", String(!isMatch));
      });
    };

    tabs.forEach(tab => tab.addEventListener("click", handleClick));

    return () => tabs.forEach(tab => tab.removeEventListener("click", handleClick));
  }, []);
}

function useAccordions() {
  useEffect(() => {
    const accordions = document.querySelectorAll(".accordion");
    const handleClick = event => {
      const trigger = event.currentTarget;
      const panel = trigger.nextElementSibling;
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!isOpen));
      panel.classList.toggle("open", !isOpen);
    };

    accordions.forEach(accordion => {
      const trigger = accordion.querySelector(".accordion-trigger");
      trigger?.addEventListener("click", handleClick);
    });

    return () =>
      accordions.forEach(accordion => {
        const trigger = accordion.querySelector(".accordion-trigger");
        trigger?.removeEventListener("click", handleClick);
      });
  }, []);
}

function useForms() {
  useEffect(() => {
    const forms = document.querySelectorAll("form");
    const handleSubmit = event => {
      event.preventDefault();
      const form = event.currentTarget;
      form.reset();
      const button = form.querySelector("button[type='submit']");
      if (!button) return;
      const original = button.textContent;
      button.textContent = "Message sent!";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 2500);
    };

    forms.forEach(form => form.addEventListener("submit", handleSubmit));
    return () => forms.forEach(form => form.removeEventListener("submit", handleSubmit));
  }, []);
}

export default function HomePage() {
  const [isFriendlyVcOpen, setIsFriendlyVcOpen] = useState(false);
  const [isLatamHubOpen, setIsLatamHubOpen] = useState(false);
  useRevealAnimations();
  useParallax();
  useTestimonialSlider();
  useTabs();
  useAccordions();
  useForms();

  const openFriendlyVc = () => setIsFriendlyVcOpen(true);
  const handleFriendlyVcKeyDown = event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsFriendlyVcOpen(true);
    }
  };
  const openLatamHub = () => setIsLatamHubOpen(true);
  const handleLatamKeyDown = event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsLatamHubOpen(true);
    }
  };

  return (
    <>
      <FriendlyVcChatModal open={isFriendlyVcOpen} onClose={() => setIsFriendlyVcOpen(false)} />
      <LatamSourcingModal open={isLatamHubOpen} onClose={() => setIsLatamHubOpen(false)} />
      <header className="site-header">
        <div className="logo-lockup">
          <img src="/assets/logo-negro.svg" alt="Fundraising School" className="logo" />
          <span className="ecosystem-badge reveal" data-reveal="fade-up">
            Andrés Bilbao Ecosystem
          </span>
        </div>
        <nav className="primary-nav">
          <a href="#why" className="nav-link">
            Why this program
          </a>
          <a href="#master" className="nav-link">
            What you’ll master
          </a>
          <a href="#success" className="nav-link">
            Success stories
          </a>
          <a href="#faculty" className="nav-link">
            Founders &amp; mentors
          </a>
          <a href="#faq" className="nav-link">
            FAQ
          </a>
        </nav>
        <div className="nav-cta">
          <a href="#cross-program" className="pill-link">
            Explore 30x.org
          </a>
          <a href="#apply" className="primary-btn apply-btn">
            Start your application
          </a>
        </div>
      </header>

      <main>
        <section id="hero" className="hero section">
          <div className="hero-grid">
            <div className="hero-copy reveal" data-reveal="slide-up">
              <p className="section-eyebrow">Fundraising School</p>
              <h1>Raise capital with the builders behind Rappi.</h1>
              <p className="hero-subhead">
                A six-week, founder-led sprint to sharpen your story, meet tier-1 investors, and keep building
                momentum while you close your round.
              </p>
              <div className="cta-stack">
                <a href="#apply" className="primary-btn">
                  Start your application
                </a>
                <span className="cta-note">Takes ~5 minutes • Selected founders unlock $50K+ in perks</span>
                <a href="#cross-program" className="secondary-link">
                  Leading a corporate team? Explore 30x.org →
                </a>
              </div>
            </div>
            <div className="hero-visual">
              <div className="portrait-card reveal" data-reveal="fade-up">
                <div className="portrait portrait-andres" role="img" aria-label="Portrait of Andrés Bilbao" />
                <div className="portrait portrait-laura" role="img" aria-label="Portrait of Laura Gaviria Halaby" />
                <blockquote>
                  “We built this to give LATAM founders the unfair advantage we wished we’d had.”
                  <cite>— Andrés Bilbao &amp; Laura Gaviria Halaby</cite>
                </blockquote>
              </div>
              <div className="floatingaccent floatingaccent-one" />
              <div className="floatingaccent floatingaccent-two" />
            </div>
          </div>
          <div className="proof-bar reveal" data-reveal="fade-in">
            <span>
              <strong>$185M+</strong> capital raised by alumni
            </span>
            <span>
              <strong>17 countries</strong> represented across cohorts
            </span>
            <span>
              <strong>70+</strong> operator mentors on speed dial
            </span>
          </div>
        </section>

        <section id="why" className="section parallax-narrative">
          <div className="parallax-track">
            <article className="narrative-card reveal" data-reveal="slide-up">
              <p className="label">Pain</p>
              <h2>Fundraising alone is costly.</h2>
              <p>
                Months of rejections, playbooks built for Silicon Valley, and runway burned chasing first meetings
                instead of shipping.
              </p>
            </article>
            <article className="narrative-card reveal" data-reveal="slide-up" data-delay="100">
              <p className="label">Solution</p>
              <h2>A builder-led playbook.</h2>
              <p>
                Six weeks with the operators behind Rappi, tactical office hours to pressure-test your deck, and a peer
                circle trading investor intel in real time.
              </p>
            </article>
            <article className="narrative-card reveal" data-reveal="slide-up" data-delay="200">
              <p className="label">Outcome</p>
              <h2>Investor-ready in weeks.</h2>
              <p>
                Leave with a story investors buy, warm paths into tier-1 funds, and momentum to grow while the round
                comes together.
              </p>
              <a href="#master" className="inline-cta">
                See what you’ll master →
              </a>
            </article>
          </div>
          <div className="parallax-backdrop" />
        </section>

        <section id="master" className="section skills">
          <div className="section-heading reveal" data-reveal="fade-up">
            <p className="section-eyebrow">Curriculum pillars</p>
            <h2>What you’ll master</h2>
            <p className="section-intro">
              Each cohort ships real investor materials with live mentor feedback, async playbooks, and
              founder-to-founder accountability.
            </p>
          </div>
          <div className="skills-grid">
            <article className="skill-card reveal" data-reveal="fade-in">
              <h3>Story investors buy</h3>
              <p>Align vision, traction, and ambition for a narrative that resonates across global and LATAM funds.</p>
              <footer>Deck workshop · Messaging sprint · Investor critique</footer>
            </article>
            <article className="skill-card reveal" data-reveal="fade-in" data-delay="80">
              <h3>Targeting the right funds</h3>
              <p>Map warm paths, mandates, and timing so every intro compounds instead of starting cold.</p>
              <footer>Fund mapping lab · Investor dossiers · Outreach systems</footer>
            </article>
            <article className="skill-card reveal" data-reveal="fade-in" data-delay="160">
              <h3>Data room readiness</h3>
              <p>
                Assemble diligence-proof metrics, ops dashboards, and financials that answer questions before they’re
                asked.
              </p>
              <footer>Metrics teardown · Data room template · Legal checklist</footer>
            </article>
            <article className="skill-card reveal" data-reveal="fade-in" data-delay="240">
              <h3>Closing confidently</h3>
              <p>Rehearse terms, communication cadences, and follow-ups to negotiate while keeping the company running.</p>
              <footer>Mock term sheet · Negotiation drills · Closing playbook</footer>
            </article>
          </div>
          <a href="#apply" className="inline-cta reveal" data-reveal="fade-up">
            Get the detailed syllabus →
          </a>
        </section>

        <section id="success" className="section testimonials">
          <div className="section-heading reveal" data-reveal="fade-up">
            <p className="section-eyebrow">Social proof</p>
            <h2>Founders turning momentum into capital</h2>
            <p className="section-intro">
              Alumni go on to close rounds with Latin American and global investors, launch new markets, and bring their
              communities along for the ride.
            </p>
          </div>
          <div className="testimonial-slider reveal" data-reveal="fade-in">
            <button className="slider-control prev" aria-label="Previous testimonial">
              ←
            </button>
            <div className="slider-window">
              <ul className="slider-track">
                <li className="testimonial-card">
                  <div className="avatar avatar-1" aria-hidden="true" />
                  <blockquote>
                    “Fundraising School rebuilt our deck in week two, then the team lined up three investor meetings in
                    seven days. We closed a $3.2M round before the cohort ended.”
                  </blockquote>
                  <p className="testimonial-meta">
                    <strong>Daniela Ruiz</strong> · Co-founder, Tambo · Backed by ALLVP &amp; Kaszek
                  </p>
                </li>
                <li className="testimonial-card">
                  <div className="avatar avatar-2" aria-hidden="true" />
                  <blockquote>
                    “I thought we were too early. The mentors showed us how to prove retention, and we unlocked a $1M
                    pre-seed with warm intros to three lead funds.”
                  </blockquote>
                  <p className="testimonial-meta">
                    <strong>Jorge Santos</strong> · CEO, Alinea · $1M pre-seed led by Latitud Ventures
                  </p>
                </li>
                <li className="testimonial-card">
                  <div className="avatar avatar-3" aria-hidden="true" />
                  <blockquote>
                    “Beyond capital, the network is unmatched. We still meet weekly with our accountability pod and share
                    diligence-ready tools from the program.”
                  </blockquote>
                  <p className="testimonial-meta">
                    <strong>Gabriela Ortiz</strong> · Founder, RunaBio · Alumni community lead
                  </p>
                </li>
              </ul>
            </div>
            <button className="slider-control next" aria-label="Next testimonial">
              →
            </button>
          </div>
          <a href="#apply" className="inline-cta reveal" data-reveal="fade-up">
            Read alumni stories →
          </a>
        </section>

        <section id="faculty" className="section faculty">
          <div className="section-heading reveal" data-reveal="fade-up">
            <p className="section-eyebrow">Operators in your corner</p>
            <h2>Founders, investors, and mentors who’ve shipped global companies</h2>
            <p className="section-intro">
              Curated pods keep rooms intimate. Mentors stay plugged into the alumni network well beyond demo day.
            </p>
          </div>
          <div className="tab-controls" role="tablist">
            <button className="tab-button active" role="tab" aria-selected="true" data-tab="founders">
              Founders
            </button>
            <button className="tab-button" role="tab" aria-selected="false" data-tab="speakers">
              Speakers
            </button>
            <button className="tab-button" role="tab" aria-selected="false" data-tab="mentors">
              Mentors
            </button>
          </div>
          <div className="tab-panels">
            <div className="tab-panel active" id="founders" role="tabpanel">
              <ul className="profile-grid">
                <li className="profile-card reveal" data-reveal="fade-in">
                  <div className="profile-avatar avatar-andres" />
                  <h3>Andrés Bilbao</h3>
                  <p>Co-founder, Rappi · General Partner, 30X Fund</p>
                </li>
                <li className="profile-card reveal" data-reveal="fade-in" data-delay="80">
                  <div className="profile-avatar avatar-laura" />
                  <h3>Laura Gaviria Halaby</h3>
                  <p>Ex-Citi Ventures · Chief Growth Officer, 30X</p>
                </li>
                <li className="profile-card reveal" data-reveal="fade-in" data-delay="160">
                  <div className="profile-avatar avatar-sebastian" />
                  <h3>Sebastián Mejía</h3>
                  <p>Co-founder, Rappi · Active angel investor</p>
                </li>
                <li className="profile-card reveal" data-reveal="fade-in" data-delay="240">
                  <div className="profile-avatar avatar-valentina" />
                  <h3>Valentina Ponce de León</h3>
                  <p>Head of Founder Community, 30X Ecosystem</p>
                </li>
              </ul>
            </div>
            <div className="tab-panel" id="speakers" role="tabpanel" aria-hidden="true">
              <ul className="profile-grid">
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-a" />
                  <h3>Laura Gómez</h3>
                  <p>Partner, Latitud · Ex-Stripe</p>
                </li>
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-b" />
                  <h3>Diego Cossio</h3>
                  <p>VP Growth, Nubank</p>
                </li>
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-c" />
                  <h3>Marcela Rojas</h3>
                  <p>Principal, ALLVP</p>
                </li>
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-d" />
                  <h3>James Tan</h3>
                  <p>Managing Partner, Quest Ventures</p>
                </li>
              </ul>
            </div>
            <div className="tab-panel" id="mentors" role="tabpanel" aria-hidden="true">
              <ul className="profile-grid">
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-e" />
                  <h3>Maria Teresa León</h3>
                  <p>Chief of Staff, Jüsto · Fundraising ops lead</p>
                </li>
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-f" />
                  <h3>Carlos Ferro</h3>
                  <p>Head of Investor Relations, Stori</p>
                </li>
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-g" />
                  <h3>Renata Campos</h3>
                  <p>Partner, 500 LATAM · Former Goldman Sachs</p>
                </li>
                <li className="profile-card">
                  <div className="profile-avatar avatar-mentor-h" />
                  <h3>Martín Alvarez</h3>
                  <p>Founder, Clara · Alumni mentor</p>
                </li>
              </ul>
            </div>
          </div>
          <aside className="faculty-sidecard reveal" data-reveal="fade-up">
            <h3>Corporate innovation?</h3>
            <p>Scaling executive teams or enablement squads? Our partners at 30x.org lead immersive programs for operators.</p>
            <a href="#cross-program" className="primary-btn ghost-btn">
              Discover 30x.org
            </a>
          </aside>
        </section>

        <section id="community" className="section perks">
          <div className="section-heading reveal" data-reveal="fade-up">
            <p className="section-eyebrow">Tools for founders</p>
            <h2>Two copilots that travel with every cohort</h2>
            <p className="section-intro">
              These aren’t future promises—they ship on day one so you can pressure-test your raise with real feedback and
              fresh deal flow.
            </p>
          </div>
          <div className="perks-grid">
            <article
              className="perk-card reveal interactive"
              data-reveal="fade-in"
              role="button"
              tabIndex={0}
              aria-label="Open the Friendly VC chat agent"
              onClick={openFriendlyVc}
              onKeyDown={handleFriendlyVcKeyDown}
            >
              <h3>Friendly VC agent</h3>
              <p>
                A straight-talking partner trained on Fundraising School playbooks and investor notes. Use it to stress-test
                your deck, practice objections, and tighten the story investors hear first.
              </p>
              <span className="pill accent">Conversation-based</span>
            </article>
            <article
              className="perk-card reveal interactive"
              data-reveal="fade-in"
              data-delay="120"
              role="button"
              tabIndex={0}
              aria-label="Open the LATAM lead sourcing hub preview"
              onClick={openLatamHub}
              onKeyDown={handleLatamKeyDown}
            >
              <h3>LATAM lead sourcing hub</h3>
              <p>
                Curated lists for B2B customers, talent, and investors across the region. We keep the data warm so you can
                focus on outreach that actually converts.
              </p>
              <span className="pill">New drops each week</span>
            </article>
          </div>
        </section>

        <section id="journey" className="section journey">
          <div className="section-heading reveal" data-reveal="fade-up">
            <p className="section-eyebrow">Application flow</p>
            <h2>What happens when you apply</h2>
          </div>
          <ol className="journey-steps reveal" data-reveal="fade-in">
            <li>
              <span className="step-number">01</span>
              <h3>Apply</h3>
              <p>Share founder profiles, traction snapshot, deck upload, and how we can help. Takes ~5 minutes.</p>
            </li>
            <li>
              <span className="step-number">02</span>
              <h3>Selection conversation</h3>
              <p>We run a 25-minute tactical chat to understand fit, answer questions, and align on your fundraising timeline.</p>
            </li>
            <li>
              <span className="step-number">03</span>
              <h3>Cohort kickoff</h3>
              <p>Six weeks of live labs, async playbooks, mentor office hours, and founder accountability pods.</p>
            </li>
            <li>
              <span className="step-number">04</span>
              <h3>Alumni hub</h3>
              <p>Keep the momentum through ongoing intros, community events, and curated resources after demo week.</p>
            </li>
          </ol>
        </section>

        <section id="faq" className="section faq">
          <div className="section-heading reveal" data-reveal="fade-up">
            <p className="section-eyebrow">FAQ</p>
            <h2>Answers before you hit submit</h2>
          </div>
          <div className="faq-grid">
            <div className="accordion reveal" data-reveal="fade-in">
              <button className="accordion-trigger" aria-expanded="false">
                Who is the program for?
              </button>
              <div className="accordion-panel">
                <p>
                  English-speaking tech founders across LATAM (pre-seed to Series B) who are actively raising or plan to
                  raise in the next nine months.
                </p>
              </div>
            </div>
            <div className="accordion reveal" data-reveal="fade-in" data-delay="80">
              <button className="accordion-trigger" aria-expanded="false">
                How selective is the cohort?
              </button>
              <div className="accordion-panel">
                <p>
                  We curate 25 founders per cohort. We look for meaningful traction, coachability, and alignment with the
                  community’s pay-it-forward ethos.
                </p>
              </div>
            </div>
            <div className="accordion reveal" data-reveal="fade-in" data-delay="160">
              <button className="accordion-trigger" aria-expanded="false">
                What’s the weekly commitment?
              </button>
              <div className="accordion-panel">
                <p>
                  Expect two 90-minute live sessions, one mentor office hour block, and async work on your materials.
                  Everything is designed to support building, not distract from it.
                </p>
              </div>
            </div>
            <div className="accordion reveal" data-reveal="fade-in" data-delay="240">
              <button className="accordion-trigger" aria-expanded="false">
                Why is the program free?
              </button>
              <div className="accordion-panel">
                <p>
                  Fundraising School is powered by the 30X ecosystem. We invest in the long-term success of LATAM founders
                  and align incentives through future partnerships.
                </p>
              </div>
            </div>
            <div className="accordion reveal" data-reveal="fade-in" data-delay="320">
              <button className="accordion-trigger" aria-expanded="false">
                Do you support founders outside LATAM?
              </button>
              <div className="accordion-panel">
                <p>Yes—our community spans 17 countries. We prioritize founders serving LATAM markets or with ties to the region.</p>
              </div>
            </div>
            <div className="accordion reveal" data-reveal="fade-in" data-delay="400">
              <button className="accordion-trigger" aria-expanded="false">
                Can my co-founder join?
              </button>
              <div className="accordion-panel">
                <p>Absolutely. Up to two co-founders can participate fully in sessions, mentor hours, and community channels.</p>
              </div>
            </div>
          </div>
          <form className="contact-card reveal" data-reveal="fade-up" aria-labelledby="contact-heading">
            <h3 id="contact-heading">Still unsure?</h3>
            <p>Drop us a note. We’ll get back within 48 hours.</p>
            <label>
              Name
              <input type="text" name="name" placeholder="Your name" required />
            </label>
            <label>
              Email
              <input type="email" name="email" placeholder="you@startup.com" required />
            </label>
            <label>
              Message
              <textarea name="message" rows="4" placeholder="How can we help?" required />
            </label>
            <button type="submit" className="primary-btn">
              Send message
            </button>
          </form>
        </section>

        <section id="apply" className="section apply">
          <div className="apply-card reveal" data-reveal="fade-up">
            <div>
              <p className="section-eyebrow">Ready to move?</p>
              <h2>Start your application</h2>
              <p>
                Checklist: founder LinkedIn, traction snapshot, ARR band, capital raised, pitch deck link, WhatsApp, and
                how we can help you win this round.
              </p>
            </div>
            <a href="https://airtable.com" className="primary-btn apply-btn" target="_blank" rel="noopener noreferrer">
              Apply via Airtable
            </a>
          </div>
        </section>

        <section id="cross-program" className="section cross-program">
          <div className="cross-card reveal" data-reveal="fade-up">
            <h2>Scaling corporate innovation teams?</h2>
            <p>
              30x.org brings the same operators to executives and enterprise squads. Share it with your partners, clients,
              or leadership team.
            </p>
            <a href="https://30x.org" className="primary-btn ghost-btn" target="_blank" rel="noopener noreferrer">
              Explore 30x.org
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <img src="/assets/logo-negro.svg" alt="Fundraising School" className="logo" />
            <p>Fundraising School is part of the Andrés Bilbao ecosystem empowering LATAM founders.</p>
          </div>
          <div>
            <h3>Navigate</h3>
            <ul>
              <li>
                <a href="#hero">Home</a>
              </li>
              <li>
                <a href="#master">Program</a>
              </li>
              <li>
                <a href="#faculty">Mentors</a>
              </li>
              <li>
                <a href="#apply">Apply</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Connect</h3>
            <ul>
              <li>
                <a href="mailto:fundraising@30x.org">fundraising@30x.org</a>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/30x" target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/30x" target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Stay in the loop</h3>
            <form className="newsletter">
              <label>
                Email
                <input type="email" placeholder="you@startup.com" required />
              </label>
              <button type="submit" className="primary-btn">
                Subscribe
              </button>
            </form>
          </div>
        </div>
        <p className="footer-note">© 2025 Fundraising School · Privacy Policy · Terms</p>
      </footer>
    </>
  );
}
