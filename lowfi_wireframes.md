# Fundraising School – Low-Fidelity Layout Notes

*Drafted 2025-10-24*

Legend: `[ ]` denotes content blocks, `──` indicates grouping, `→` marks motion cue.

## 1\. Hero (Desktop \~1440px)

┌──────────────────────────────────────────────────────────────┐

│ \[Left Column 55%\]                                            │

│  ├ Headline (2 lines max)                                    │

│  ├ Subheadline                                               │

│  ├ CTA row                                                   │

│  │  \[Start Your Application\]  (primary button)               │

│  │  \[Ghost link → Explore 30x.org\]                           │

│                                                              │

│ \[Right Column 45%\]                                           │

│  ├ Portrait stack (Andrés front, Laura offset)               │

│  └ → subtle parallax float vs. gradient background           │

└──────────────────────────────────────────────────────────────┘

Responsive (≤768px): stack portrait below text, add sticky bottom `Apply` button, proof bar becomes horizontal scroll chips.

## 2\. Why This Program – Parallax Narrative

┌──────────────────────────────────────────────────────────────┐

│ Background: vertical gradient with slow parallax drift       │

│ Section height: \~120vh, 3 scroll-triggered frames            │

│                                                              │

│ Frame A (Pain)                                               │

│  \[Label\] Pain — Fundraising alone is costly                  │

│  \[Copy\] two-line stanza                                      │

│  → underline grows left→right as text enters                 │

│                                                              │

│ Frame B (Solution)                                           │

│  \[Label\] Solution — A builder-led playbook                   │

│  \[Copy\] two-line stanza                                      │

│  → mild upward slide-in, background shape flips orientation  │

│                                                              │

│ Frame C (Outcome)                                            │

│  \[Label\] Outcome — Investor-ready in weeks                   │

│  \[Copy\] two-line stanza                                      │

│  \[Inline CTA\] See what you’ll master →                       │

└──────────────────────────────────────────────────────────────┘

Responsive: collapse frames into stacked cards separated by soft dividers; parallax becomes fade/slide only.

## 3\. What You’ll Master (Skill Grid)

┌───────────────────────────────────────────────┐

│ 2×2 grid (desktop)                             │

│                                               │

│ \[Card\] Story investors buy    → hover underline│

│  ├ line summary                                 │

│  └ hidden detail panel (deck workshop, live Q\&A)│

│                                               │

│ \[Card\] Targeting the right funds               │

│  ├ line summary                                 │

│  └ detail: fund mapping lab, investor dossiers  │

│                                               │

│ \[Card\] Data room readiness                     │

│ \[Card\] Closing confidently                     │

│                                               │

│ Footer CTA: Get the detailed syllabus →        │

└───────────────────────────────────────────────┘

Responsive: single column cards with expandable accordions for details.

## 4\. Success Proof Strip

┌──────────────────────────────────────────────────────────────┐

│ Horizontal slider (controls optional)                        │

│  \[Testimonial card\]                                          │

│   ├ Alumni photo (circle)                                    │

│   ├ Quote (2 lines)                                          │

│   ├ Outcome stat (bold)                                      │

│   └ Supporting logos (investors)                             │

│  \[CTA button\] Read Alumni Stories                            │

└──────────────────────────────────────────────────────────────┘

Motion: auto-slide every 8s, pause on hover; add crossfade between cards.

## 5\. Founders & Faculty Tabs

┌──────────────────────────────────────────────────────────────┐

│ Tab chips: Founders | Speakers | Mentors                     │

│ Active tab underlined; other tabs subtle fade                │

│                                                              │

│ Grid: 3 columns × 2 rows                                      │

│  \[Profile card\] portrait, name, role, key credential          │

│  “View all mentors →” link anchored to dedicated page         │

│                                                              │

│ Sidebar callout:                                             │

│  Banner linking to 30x.org (“Upskill your corporate team”)   │

└──────────────────────────────────────────────────────────────┘

Responsive: tabs become horizontal scroll chips; cards shift to 2 columns then single column.

## 6\. Community & Perks \+ Selection Messaging

┌──────────────────────────────────────────────────────────────┐

│ Section intro: Selected founders gain $50K+ in partner value │

│                                                              │

│ Perks grid (desktop): 3 columns                              │

│  \[Tile\] Partner logo | perk summary | est. value             │

│  \[Tile\] Quote bubble from cohort member                      │

│                                                              │

│ Footer note: “Access continues after demo day via alumni hub”│

└──────────────────────────────────────────────────────────────┘

Motion: tiles lift 4px on hover; partner logos grayscale→color transition.

## 7\. Application Journey & FAQ

┌──────────────────────────────────────────────────────────────┐

│ Stepper (horizontal desktop)                                 │

│  1 Apply → 2 Selection Conversation → 3 Cohort Kickoff → 4 Alumni│

│  Microcopy under each step emphasises curation.               │

│                                                              │

│ FAQ Accordions (two-column):                                  │

│  Groupings: Eligibility / Commitment / Support / Privacy     │

│  Inline contact form (Name, Email, Message, Submit)           │

└──────────────────────────────────────────────────────────────┘

Responsive: stepper becomes vertical list with numbered badges; FAQ groups collapse into single column.

## 8\. Cross-Program Banner \+ Footer

┌──────────────────────────────────────────────────────────────┐

│ Banner                                                       │

│  “Scaling a corporate innovation team? Explore 30x.org →”     │

│  Matches 30x.org accent color; slight gradient shimmer → on hover│

│                                                              │

│ Footer                                                       │

│  Shared layout: logo | nav links | social icons | newsletter  │

│  Secondary CTA: Apply →                                      │

└──────────────────────────────────────────────────────────────┘

Responsive: banner becomes stacked text \+ button; footer columns collapse into accordions.

## Implementation Reminders

- Maintain type rhythm (headline, label, body) consistent with Andrés Bilbao brand palette once assets arrive.  
- Set scroll-trigger thresholds for parallax section to ensure accessibility (reduced motion fallback: simple fade/slide).  
- Use shared component tokens across Fundraising School and 30x.org to reinforce ecosystem feel.
