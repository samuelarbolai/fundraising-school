"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const SAMPLE_LEADS = [
  {
    id: "agro-mx",
    company: "AgroFlow MX",
    email: "valeria.mendoza@agroflow.mx",
    phone: "+52 1 55 8675 4412",
    decisionMaker: true,
    headcount: "201-500",
    location: "Guadalajara, MX",
    industry: "Agriculture",
    vertical: "Supply chain digitization",
    linkedin: "https://www.linkedin.com/in/valeriamendoza-fundadora",
  },
  {
    id: "fin-ar",
    company: "CreditoClaro",
    email: "martin.rios@creditoclaro.com",
    phone: "+54 9 11 7234 8901",
    decisionMaker: true,
    headcount: "51-200",
    location: "Buenos Aires, AR",
    industry: "Financial services",
    vertical: "SMB lending platform",
    linkedin: "https://www.linkedin.com/in/martin-rios",
  },
  {
    id: "health-co",
    company: "VitalSync",
    email: "laura.patino@vitalsync.co",
    phone: "+57 321 778 4412",
    decisionMaker: false,
    headcount: "11-50",
    location: "Medellín, CO",
    industry: "Healthcare",
    vertical: "Clinic operations automation",
    linkedin: "https://www.linkedin.com/in/laurapatinoops",
  },
  {
    id: "log-pe",
    company: "AndesFreight",
    email: "diego.fernandez@andesfreight.pe",
    phone: "+51 987 224 109",
    decisionMaker: true,
    headcount: "501-1K",
    location: "Lima, PE",
    industry: "Logistics",
    vertical: "Cross-border freight",
    linkedin: "https://www.linkedin.com/in/diegofernandezfreight",
  },
  {
    id: "retail-cl",
    company: "RetailPulse",
    email: "carolina.araya@retailpulse.cl",
    phone: "+56 9 7244 9812",
    decisionMaker: false,
    headcount: "201-500",
    location: "Santiago, CL",
    industry: "Retail",
    vertical: "In-store analytics",
    linkedin: "https://www.linkedin.com/in/carolina-araya-analytics",
  },
  {
    id: "saas-br",
    company: "FluxData",
    email: "gustavo.silva@fluxdata.com.br",
    phone: "+55 11 99876 1204",
    decisionMaker: true,
    headcount: "51-200",
    location: "São Paulo, BR",
    industry: "Software",
    vertical: "Marketing attribution SaaS",
    linkedin: "https://www.linkedin.com/in/gustavo-silva-flux",
  },
  {
    id: "energy-mx",
    company: "EnerSmart",
    email: "andrea.lopez@enersmart.mx",
    phone: "+52 1 81 9087 3345",
    decisionMaker: false,
    headcount: "201-500",
    location: "Monterrey, MX",
    industry: "Energy",
    vertical: "Industrial solar monitoring",
    linkedin: "https://www.linkedin.com/in/andrea-lopez-energy",
  },
  {
    id: "talent-co",
    company: "HireBridge LATAM",
    email: "sergio.quintero@hirebridge.lat",
    phone: "+57 316 904 7781",
    decisionMaker: true,
    headcount: "11-50",
    location: "Bogotá, CO",
    industry: "Talent",
    vertical: "Technical recruiting marketplace",
    linkedin: "https://www.linkedin.com/in/sergioquintero",
  },
];

const KEY_FIELDS = ["company", "industry", "vertical", "location", "headcount"];

export default function LatamSourcingPage() {
  const [criteria, setCriteria] = useState("");
  const [submittedCriteria, setSubmittedCriteria] = useState("");
  const [decisionMakersOnly, setDecisionMakersOnly] = useState(false);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = submittedCriteria.trim().toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

    return SAMPLE_LEADS.filter(lead => {
      if (decisionMakersOnly && !lead.decisionMaker) return false;
      if (tokens.length === 0) return true;

      const haystack = KEY_FIELDS.map(field => lead[field].toLowerCase()).join(" ");
      return tokens.every(token => haystack.includes(token));
    });
  }, [decisionMakersOnly, submittedCriteria]);

  const handleSubmit = event => {
    event.preventDefault();
    setSubmittedCriteria(criteria);
  };

  const handleReset = () => {
    setCriteria("");
    setDecisionMakersOnly(false);
    setSubmittedCriteria("");
  };

  return (
    <main className="latam-page">
      <header className="latam-page__header">
        <div>
          <p className="latam-page__eyebrow">Fundraising School tools</p>
          <h1>LATAM lead sourcing hub</h1>
          <p className="latam-page__intro">
            Prototype workspace with dummy data. Describe who you need, filter for decision makers, and export-ready rows
            appear instantly.
          </p>
        </div>
        <Link href="/" className="latam-page__back">
          ← Back to Fundraising School
        </Link>
      </header>

      <section className="latam-page__panel">
        <form className="latam-query" onSubmit={handleSubmit}>
          <label htmlFor="latam-description">Describe the leads you need</label>
          <textarea
            id="latam-description"
            value={criteria}
            onChange={event => setCriteria(event.target.value)}
            placeholder="Example: B2B SaaS buyers in Mexico City with 50-200 staff, marketing analytics budgets"
            rows={3}
          />

          <div className="latam-query__controls">
            <label className="latam-checkbox">
              <input
                type="checkbox"
                checked={decisionMakersOnly}
                onChange={event => setDecisionMakersOnly(event.target.checked)}
              />
              Decision makers only
            </label>
            <div className="latam-query__buttons">
              <button type="button" className="latam-secondary-btn" onClick={handleReset}>
                Reset
              </button>
              <button type="submit" className="latam-primary-btn">
                Generate list
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="latam-results">
        <div className="latam-results__meta">
          <span>{filteredLeads.length} leads surfaced</span>
          {submittedCriteria ? (
            <p>
              Criteria: <strong>{submittedCriteria}</strong>
            </p>
          ) : (
            <p>Showing sample data. Refine above to tailor the list.</p>
          )}
        </div>

        <div className="latam-table-wrapper">
          <table className="latam-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Emails</th>
                <th>Celulares</th>
                <th>Decision maker?</th>
                <th>Headcount</th>
                <th>Location</th>
                <th>Industry</th>
                <th>Vertical</th>
                <th>LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <tr key={lead.id}>
                  <td>{lead.company}</td>
                  <td>{lead.email}</td>
                  <td>{lead.phone}</td>
                  <td>{lead.decisionMaker ? "Yes" : "No"}</td>
                  <td>{lead.headcount}</td>
                  <td>{lead.location}</td>
                  <td>{lead.industry}</td>
                  <td>{lead.vertical}</td>
                  <td>
                    <a href={lead.linkedin} target="_blank" rel="noreferrer">
                      Profile
                    </a>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={9} className="latam-table__empty">
                    No leads match that request yet. Adjust filters and try again.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
