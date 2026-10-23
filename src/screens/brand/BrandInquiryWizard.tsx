import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { createEnquiry } from '../../lib/firebase.ts';

const NICHES = [
  'Tech & gadgets',
  'Health & beauty',
  'Fashion & style',
  'Food & travel',
  'Business & money',
  'Entertainment & events',
  'Gaming',
  'Cars',
  'Real estate & home',
  'Education & careers',
  'Parenting & family',
  'Agriculture',
  'Sports',
  'Faith & motivation',
  'Other',
];

const GOALS = [
  'More people knowing we exist',
  'Launch something new',
  'Sales or enquiries',
  'Fill an event',
  'More followers',
  'Fix a campaign that flopped',
];

const BUDGETS = [
  '$100 to $250',
  '$250 to $500',
  '$500 to $1,000',
  '$1,000+',
  'Not sure yet',
];

const STARTS = ['This week', 'In two weeks', 'This month', 'Just exploring'];

export interface WizardState {
  promo: string;
  niche: string;
  goals: string[];
  budget: string;
  start: string;
  biz: string;
  name: string;
  phone: string;
  notes: string;
  times: string[];
}

export const BrandInquiryWizard: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardState>({
    promo: '',
    niche: NICHES[0],
    goals: [],
    budget: BUDGETS[0],
    start: STARTS[0],
    biz: '',
    name: '',
    phone: '',
    notes: '',
    times: [],
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedBrief, setSubmittedBrief] = useState<string | null>(null);

  const totalSteps = 6;
  const progressPercent = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));

  const toggleGoal = (goal: string) => {
    setAnswers((prev) => {
      const exists = prev.goals.includes(goal);
      return {
        ...prev,
        goals: exists ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal],
      };
    });
  };

  const toggleTime = (time: string) => {
    setAnswers((prev) => {
      const exists = prev.times.includes(time);
      return {
        ...prev,
        times: exists ? prev.times.filter((t) => t !== time) : [...prev.times, time],
      };
    });
  };

  const generateBriefText = (ans: WizardState) => {
    return [
      'Mhomho Media: campaign brief',
      `Business: ${ans.biz} (${ans.niche})`,
      `Promoting: ${ans.promo}`,
      `Goals: ${ans.goals.join(', ')}`,
      `Budget: ${ans.budget}`,
      `Start: ${ans.start}`,
      `Notes: ${ans.notes || 'None'}`,
      `From: ${ans.name}`,
      `Phone: ${ans.phone}`,
    ].join('\n');
  };

  const handleNext = () => {
    setErrorMsg('');

    if (step === 0 && !answers.promo.trim()) {
      setErrorMsg('Please tell us what you are promoting.');
      return;
    }
    if (step === 2 && answers.goals.length === 0) {
      setErrorMsg('Please select at least one campaign goal.');
      return;
    }
    if (step === 5) {
      if (!answers.biz.trim() || !answers.name.trim() || !answers.phone.trim()) {
        setErrorMsg('Please add your business name, your name, and phone number.');
        return;
      }

      // Record in Firebase store
      createEnquiry({
        bizName: answers.biz.trim(),
        contactName: answers.name.trim(),
        phone: answers.phone.trim(),
        niche: answers.niche,
        promo: answers.promo,
        goals: answers.goals,
        budget: answers.budget,
        start: answers.start,
        notes: answers.notes,
        bestTimes: answers.times,
      });

      const briefText = generateBriefText(answers);
      setSubmittedBrief(briefText);
      if (onComplete) onComplete();
      setStep(6);
      return;
    }

    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setErrorMsg('');
    setStep((prev) => Math.max(0, prev - 1));
  };

  const handleWhatsAppSend = () => {
    if (!submittedBrief) return;
    const text = encodeURIComponent(
      `Hi Mhomho, I’d like to book a call.${
        answers.times.length ? ` Best time: ${answers.times.join(', ')}.` : ''
      }\n\n${submittedBrief}`
    );
    window.open(`https://wa.me/263786205197?text=${text}`, '_blank');
  };

  // Step 6: Summary / Send Brief
  if (step === 6 && submittedBrief) {
    return (
      <Card className="p-5">
        <h3 className="text-[20px] font-extrabold leading-[1.25] mb-2">
          Your campaign brief is ready!
        </h3>
        <p className="text-[13px] text-[var(--muted)] mb-4">
          Tap below to book a discovery call or message our team directly on WhatsApp.
        </p>

        <div className="bg-[var(--bg)] p-3 rounded-[10px] border border-[var(--line)] text-[12px] font-mono whitespace-pre-wrap break-words mb-4 text-[var(--text)]">
          {submittedBrief}
        </div>

        <div className="space-y-2 mb-3">
          <p className="text-[13px] font-semibold text-[var(--muted)]">Best time for a call?</p>
          <div className="flex flex-wrap gap-2">
            {['Morning', 'Afternoon', 'Evening', 'Weekend'].map((t) => {
              const on = answers.times.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTime(t)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer ${
                    on
                      ? 'bg-gradient-mhomho text-[var(--ink)] border-transparent'
                      : 'border-[var(--line)] text-[var(--muted)]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button onClick={handleWhatsAppSend}>
            Book Call on WhatsApp
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep(0);
              setSubmittedBrief(null);
            }}
          >
            Start over
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {/* Step Progress Bar */}
      <div className="h-1 bg-[var(--line)] rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-mhomho rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {errorMsg && (
        <div className="p-2.5 mb-3 rounded-[8px] bg-[var(--err)]/10 text-[var(--err)] text-[12px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      {/* Step 0: What are you promoting? */}
      {step === 0 && (
        <div>
          <h3 className="text-[18px] font-extrabold mb-3">What are you promoting?</h3>
          <input
            type="text"
            value={answers.promo}
            onChange={(e) => setAnswers({ ...answers, promo: e.target.value })}
            placeholder="A phone shop, a skincare line, an upcoming event..."
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[14px]"
            autoFocus
          />
        </div>
      )}

      {/* Step 1: Niche */}
      {step === 1 && (
        <div>
          <h3 className="text-[18px] font-extrabold mb-3">What kind of business is it?</h3>
          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
            {NICHES.map((n) => {
              const selected = answers.niche === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnswers({ ...answers, niche: n })}
                  className={`px-3 py-2 rounded-full text-[13px] font-semibold border cursor-pointer transition-all ${
                    selected
                      ? 'bg-gradient-mhomho text-[var(--ink)] border-transparent'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Goal */}
      {step === 2 && (
        <div>
          <h3 className="text-[18px] font-extrabold mb-1">What do you want out of this campaign?</h3>
          <p className="text-[12px] text-[var(--muted)] mb-3">Pick all that apply.</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const selected = answers.goals.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGoal(g)}
                  className={`px-3 py-2 rounded-full text-[13px] font-semibold border cursor-pointer transition-all ${
                    selected
                      ? 'bg-gradient-mhomho text-[var(--ink)] border-transparent'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Budget */}
      {step === 3 && (
        <div>
          <h3 className="text-[18px] font-extrabold mb-3">What’s your budget?</h3>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((b) => {
              const selected = answers.budget === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setAnswers({ ...answers, budget: b })}
                  className={`px-3 py-2 rounded-full text-[13px] font-semibold border cursor-pointer transition-all ${
                    selected
                      ? 'bg-gradient-mhomho text-[var(--ink)] border-transparent'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Start timing */}
      {step === 4 && (
        <div>
          <h3 className="text-[18px] font-extrabold mb-3">When do you want to start?</h3>
          <div className="flex flex-wrap gap-2">
            {STARTS.map((s) => {
              const selected = answers.start === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAnswers({ ...answers, start: s })}
                  className={`px-3 py-2 rounded-full text-[13px] font-semibold border cursor-pointer transition-all ${
                    selected
                      ? 'bg-gradient-mhomho text-[var(--ink)] border-transparent'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 5: Contact info */}
      {step === 5 && (
        <div className="space-y-3">
          <h3 className="text-[18px] font-extrabold mb-2">Who are we speaking to?</h3>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
              Business name
            </label>
            <input
              type="text"
              value={answers.biz}
              onChange={(e) => setAnswers({ ...answers, biz: e.target.value })}
              placeholder="e.g. Zuva Telecom"
              className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
              Your name
            </label>
            <input
              type="text"
              value={answers.name}
              onChange={(e) => setAnswers({ ...answers, name: e.target.value })}
              placeholder="e.g. Farai"
              className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
              Phone number
            </label>
            <input
              type="tel"
              value={answers.phone}
              onChange={(e) => setAnswers({ ...answers, phone: e.target.value })}
              placeholder="+263 77 000 0000"
              className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
              Anything else we should know? (optional)
            </label>
            <textarea
              value={answers.notes}
              onChange={(e) => setAnswers({ ...answers, notes: e.target.value })}
              placeholder="Any target demographics, cities, or campaign constraints"
              className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-16 resize-none"
            />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-2 mt-5">
        {step > 0 && (
          <Button variant="ghost" fullWidth={false} onClick={handleBack}>
            Back
          </Button>
        )}
        <Button onClick={handleNext}>
          {step === 5 ? 'See my brief' : 'Next'}
        </Button>
      </div>
    </Card>
  );
};
