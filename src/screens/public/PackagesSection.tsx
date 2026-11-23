import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Eye, Info, Sparkles, Users, Wallet } from 'lucide-react';
import {
  CAMPAIGN_PACKAGES,
  MIN_CAMPAIGN_BUDGET_CENTS,
  formatViewTarget,
  formatWholeDollars,
  planCampaign,
  type CampaignPackage,
} from '../../../shared/pricing.ts';
import { formatCents } from '../../../shared/money.ts';
import { BrandBriefFlow } from './LandingSignupFlows.tsx';

const MIN_BUDGET = MIN_CAMPAIGN_BUDGET_CENTS / 100;
const QUICK_BUDGETS = [150, 250, 500, 1000];
const MAX_BUDGET = 2000;
const MAX_TYPED_BUDGET = 1_000_000;

function parseBudgetInput(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_TYPED_BUDGET, value);
}

const PackageCard: React.FC<{
  pkg: CampaignPackage;
  onSelect: (pkg: CampaignPackage) => void;
}> = ({ pkg, onSelect }) => {
  const plan = planCampaign(pkg.budgetCents);
  const featured = Boolean(pkg.featured);

  return (
    <article
      className={`group relative flex flex-col rounded-[22px] border p-5 transition-[transform,border-color,background-color] duration-300 sm:p-6 ${
        featured
          ? 'border-[var(--a1)]/45 bg-[var(--a1)]/[0.055] hover:-translate-y-1'
          : 'border-[var(--line)] bg-[var(--surface)]/60 hover:-translate-y-1 hover:border-[var(--line-strong)]'
      }`}
    >
      {featured && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-gradient-mhomho px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]">
          <Sparkles size={9} />
          Most popular
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--faint)]">
            {pkg.name}
          </p>
          <p className="font-display mt-2 text-[34px] font-semibold leading-none tracking-[-0.055em] text-[var(--text)]">
            {formatWholeDollars(pkg.budgetCents)}
          </p>
        </div>
        <span
          className={`mt-0.5 rounded-full border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] ${
            featured
              ? 'border-[var(--a1)]/40 text-[var(--a1)]'
              : 'border-[var(--line)] text-[var(--faint)]'
          }`}
        >
          USD
        </span>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--muted)]">{pkg.tagline}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4">
        <div>
          <dt className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
            <Eye size={11} className="text-[var(--a1)]" />
            View target
          </dt>
          <dd className="font-display mt-1.5 text-[20px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)]">
            {formatViewTarget(plan.viewTarget)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
            <Users size={11} className="text-[var(--a1)]" />
            Creators
          </dt>
          <dd className="font-display mt-1.5 text-[20px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)]">
            {plan.creatorsToRecruit}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => onSelect(pkg)}
        className={`mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-bold transition-transform hover:-translate-y-0.5 cursor-pointer ${
          featured
            ? 'bg-gradient-mhomho text-[var(--ink)]'
            : 'border border-[var(--line-strong)] text-[var(--text)] hover:border-[var(--muted)]'
        }`}
      >
        Choose {pkg.name}
        <ArrowRight size={13} />
      </button>
    </article>
  );
};

export const PackagesSection: React.FC = () => {
  const [budgetInput, setBudgetInput] = useState('150');
  const [planOpen, setPlanOpen] = useState(false);
  const calculatorRef = useRef<HTMLDivElement>(null);

  const budget = parseBudgetInput(budgetInput);
  const budgetCents = Math.round(budget * 100);
  const plan = useMemo(() => planCampaign(budgetCents), [budgetCents]);
  const sliderValue = Math.min(MAX_BUDGET, Math.max(MIN_BUDGET, Math.round(budget || MIN_BUDGET)));
  const planActive = budget >= MIN_BUDGET;
  const belowMinimum = budget > 0 && budget < MIN_BUDGET;

  const choosePackage = (pkg: CampaignPackage) => {
    setBudgetInput(String(pkg.budgetCents / 100));
    calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const matchedPackage = CAMPAIGN_PACKAGES.find((pkg) => pkg.budgetCents === plan.budgetCents);

  return (
    <section
      id="packages"
      className="relative scroll-mt-24 overflow-hidden border-b border-[var(--line)] py-20 sm:py-32"
    >
      <div
        aria-hidden="true"
        className="landing-orb orb-drift right-[-10%] top-[-6%] h-[460px] w-[460px] opacity-60"
        style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.18), transparent 70%)' }}
      />

      <div className="relative mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--a1)]">
              Campaign packages
            </p>
            <h2 className="font-display mt-4 max-w-[16ch] text-[34px] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-[48px]">
              Pick your <span className="text-gradient">reach.</span>
            </h2>
          </div>
          <p className="max-w-[46ch] text-[14px] leading-[1.75] text-[var(--muted)] sm:text-[15px]">
            One all-in price. Campaigns start at $150 — the view target and creator plan are built
            in, with no platform fee added on top.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CAMPAIGN_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onSelect={choosePackage} />
          ))}
        </div>

        <p className="mt-5 flex items-start gap-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
          <Check size={13} className="mt-0.5 shrink-0 text-[var(--a1)]" />
          All prices in USD. View targets are rounded down to whole thousands; creator counts are
          planning estimates, not guarantees.
        </p>

        {/* ============================== CALCULATOR ============================== */}
        <div
          ref={calculatorRef}
          className="glass-panel mt-12 scroll-mt-24 overflow-hidden rounded-[30px]"
        >
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-9">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--faint)]">
                Campaign calculator
              </p>
              <h3 className="font-display mt-4 text-[28px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[34px]">
                What does your budget get you?
              </h3>
              <p className="mt-3 max-w-[42ch] text-[13px] leading-[1.7] text-[var(--muted)]">
                Enter a budget and see the verified-view target and the crowd needed to deliver it.
              </p>

              <div className="mt-7 flex items-end justify-between gap-3">
                <label
                  htmlFor="campaign-budget"
                  className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]"
                >
                  Campaign budget
                </label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
                  Minimum ${MIN_BUDGET}
                </span>
              </div>
              <div
                className={`mt-2 flex h-14 items-center gap-2 rounded-2xl border bg-[var(--bg)] px-4 transition-colors focus-within:border-[var(--a1)] ${
                  belowMinimum ? 'border-[var(--warn)]/60' : 'border-[var(--line)]'
                }`}
              >
                <span className="font-display text-[22px] font-semibold text-[var(--faint)]">$</span>
                <input
                  id="campaign-budget"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={budgetInput}
                  onChange={(event) => setBudgetInput(event.target.value)}
                  onBlur={() => setBudgetInput(budget ? String(budget) : '')}
                  placeholder="150"
                  className="w-full bg-transparent font-display text-[30px] font-semibold tracking-[-0.04em] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
                />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
                  USD
                </span>
              </div>

              <input
                type="range"
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                step={10}
                value={sliderValue}
                onChange={(event) => setBudgetInput(event.target.value)}
                aria-label="Campaign budget slider"
                className="mt-5 w-full cursor-pointer accent-[var(--a1)]"
              />

              <div className="mt-5 flex flex-wrap gap-2">
                {QUICK_BUDGETS.map((amount) => {
                  const active = Math.round(budget) === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setBudgetInput(String(amount))}
                      className={`inline-flex h-8 items-center rounded-full border px-3 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'border-[var(--a1)] bg-[var(--a1)]/[0.12] text-[var(--a1)]'
                          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                      }`}
                    >
                      ${amount.toLocaleString('en-US')}
                    </button>
                  );
                })}
              </div>

              {belowMinimum && (
                <p
                  role="status"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/[0.08] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--warn)]"
                >
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Our minimum campaign is <b>${MIN_BUDGET}</b>. Increase the budget to see your
                    plan.
                  </span>
                </p>
              )}
            </div>

            <div className="relative flex flex-col justify-between gap-6 border-t border-[var(--line)] bg-[var(--bg)]/70 p-6 sm:p-9 lg:border-l lg:border-t-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--faint)]">
                  Your campaign plan
                </p>

                <div className="mt-5">
                  <p className="font-display text-[52px] font-semibold leading-[0.9] tracking-[-0.06em] text-gradient sm:text-[64px]">
                    {planActive ? formatViewTarget(plan.viewTarget) : '—'}
                  </p>
                  <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.15em] text-[var(--faint)]">
                    verified views
                  </p>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-5">
                  <div>
                    <dt className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
                      <Users size={11} className="text-[var(--a1)]" />
                      Creators to recruit
                    </dt>
                    <dd className="font-display mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)]">
                      {planActive ? plan.creatorsToRecruit : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
                      <Wallet size={11} className="text-[var(--a1)]" />
                      Campaign budget
                    </dt>
                    <dd className="font-display mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)]">
                      {formatCents(plan.budgetCents, false)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setPlanOpen(true)}
                  disabled={!planActive}
                  className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Plan my campaign
                  <ArrowRight size={15} />
                </button>
                <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[var(--faint)]">
                  {belowMinimum
                    ? 'Increase your budget to the $150 minimum to continue.'
                    : 'Opens a short form and saves your plan to our team’s waitlist. No payment, no commitment.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {planOpen && (
        <BrandBriefFlow
          plan={{
            packageName: matchedPackage?.name ?? null,
            budgetCents: plan.budgetCents,
            viewTarget: plan.viewTarget,
            creatorsToRecruit: plan.creatorsToRecruit,
          }}
          onClose={() => setPlanOpen(false)}
        />
      )}
    </section>
  );
};
