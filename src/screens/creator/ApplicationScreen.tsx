import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, CreatorStatus } from '../../lib/firebase.ts';

export interface ApplicationScreenProps {
  db: DatabaseState;
  onApplied: (newUid: string) => void;
  onCancel?: () => void;
}

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'];
const NICHES = [
  'Tech & gadgets',
  'Health & beauty',
  'Fashion & style',
  'Food & travel',
  'Business & money',
  'Entertainment & events',
  'Gaming',
  'Fitness',
  'Cars',
  'Education & careers',
  'Agriculture',
  'Faith & motivation',
  'Other',
];

export const ApplicationScreen: React.FC<ApplicationScreenProps> = ({
  db,
  onApplied,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [followers, setFollowers] = useState('');
  const [niche, setNiche] = useState('Tech & gadgets');
  const [whatsapp, setWhatsapp] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !handle.trim() || !whatsapp.trim() || !followers) {
      setErrorMsg('Please fill in every field to continue.');
      return;
    }

    const followerCount = parseInt(followers, 10);
    if (isNaN(followerCount) || followerCount < 1000) {
      setErrorMsg('Campaign Zero requires 1,000+ followers on one platform.');
      return;
    }

    if (!understood) {
      setErrorMsg('Please confirm you understand Campaign Zero is unpaid.');
      return;
    }

    // Generate unique UID
    const newUid = `creator_${Date.now()}`;
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

    // Store in public and private collections
    db.creatorsPublic[newUid] = {
      uid: newUid,
      handle: cleanHandle,
      platform: platform as any,
      niche,
      followers: followerCount,
      status: 'applied',
      createdAt: new Date().toISOString().split('T')[0],
    };

    db.creatorsPrivate[newUid] = {
      uid: newUid,
      name: name.trim(),
      whatsappNumber: whatsapp.trim(),
      ecoCashNumber: whatsapp.trim(),
    };

    onApplied(newUid);
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[24px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-extrabold tracking-[0.06em] text-[14px]">
          MHOMHO
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] text-[var(--muted)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
        )}
      </div>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-1">
        Apply as a Creator
      </h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        Join Campaign Zero. Prove one clip can reach 1,000 views, and you earn a seat in the paid creator program.
      </p>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Card>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tendai Moyo"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            required
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Your handle
          </label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourhandle"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            required
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Main platform
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Followers on that platform
          </label>
          <input
            type="number"
            min="1000"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            placeholder="e.g. 2500"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            required
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Your niche
          </label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          >
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            WhatsApp number
          </label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+263 77 000 0000"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
            required
          />
        </Card>

        <Card>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[var(--a2)]"
            />
            <span className="text-[13px] text-[var(--muted)] leading-[1.4]">
              I understand Campaign Zero is unpaid. My reward is a seat in the paid program if one clip reaches 1,000 views.
            </span>
          </label>
        </Card>

        <Button type="submit">
          Submit Application
        </Button>
      </form>
    </div>
  );
};
