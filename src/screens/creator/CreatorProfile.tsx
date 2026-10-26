import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { Avatar, AvatarPicker } from '../../components/Avatar.tsx';
import { DatabaseState } from '../../lib/firebase.ts';
import { DEFAULT_AVATAR_KEY, type AvatarKey } from '../../lib/community.ts';
import { changePassword, deleteAccount, updateProfile } from '../../lib/api.ts';

export interface CreatorProfileProps {
  db: DatabaseState;
  currentUid: string;
  onLogout?: () => void;
  onOpenSupport?: () => void;
}

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const;

export const CreatorProfile: React.FC<CreatorProfileProps> = ({
  db,
  currentUid,
  onLogout,
  onOpenSupport,
}) => {
  const creatorPublic = db.creatorsPublic[currentUid];
  const creatorPrivate = db.creatorsPrivate[currentUid];

  const [displayName, setDisplayName] = useState(creatorPrivate?.name || '');
  const [niche, setNiche] = useState(creatorPublic?.niche || '');
  const [followers, setFollowers] = useState(String(creatorPublic?.followers ?? 0));
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>(
    (creatorPublic?.platform as (typeof PLATFORMS)[number]) || 'TikTok'
  );
  const [ecoCashNumber, setEcoCashNumber] = useState(creatorPrivate?.ecoCashNumber || '');
  const [whatsAppNumber, setWhatsAppNumber] = useState(creatorPrivate?.whatsappNumber || '');
  const [avatarKey, setAvatarKey] = useState<AvatarKey>(
    creatorPublic?.avatarKey || DEFAULT_AVATAR_KEY
  );
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrorMsg('');
    const result = await updateProfile({
      displayName: displayName.trim(),
      niche: niche.trim(),
      followers: Math.max(0, Math.floor(Number(followers) || 0)),
      platform,
      whatsappNumber: whatsAppNumber.trim(),
      ecoCashNumber: ecoCashNumber.trim(),
      avatarKey,
    });
    setBusy(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Your details could not be saved.');
      return;
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordBusy) return;
    setPasswordError('');
    setPasswordMsg('');
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    const result = await changePassword({ currentPassword, newPassword });
    setPasswordBusy(false);
    if (!result.success) {
      setPasswordError(result.error || 'Your password could not be changed.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg('Password updated. Other devices have been signed out.');
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteBusy) return;
    setDeleteError('');
    setDeleteBusy(true);
    const result = await deleteAccount({ password: deletePassword, confirm: deleteConfirm });
    setDeleteBusy(false);
    if (!result.success) {
      setDeleteError(result.error || 'Your account could not be deleted.');
      return;
    }
    onLogout?.();
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-extrabold leading-[1.2] m-0">Profile</h2>
        <Tag variant={creatorPublic?.status === 'approved' ? 'ok' : 'warn'}>
          {creatorPublic?.status === 'approved' ? 'Approved' : 'Under Review'}
        </Tag>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            avatarKey={avatarKey}
            handle={creatorPublic?.handle || 'creator'}
            size={52}
            title="Your profile avatar"
          />
          <div>
            <b className="text-[16px] block">{creatorPrivate?.name || 'Creator'}</b>
            <span className="text-[13px] text-[var(--muted)]">
              {creatorPublic?.handle || '@creator'}
            </span>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-[var(--muted)]">Profile avatar</span>
            <span className="text-[11px] text-[var(--faint)]">Preset · saved with details</span>
          </div>
          <AvatarPicker value={avatarKey} onChange={setAvatarKey} handle={creatorPublic?.handle} />
        </div>

        <ListRow
          left={<span className="text-[var(--muted)]">Handle</span>}
          right={<b>{creatorPublic?.handle || '@creator'}</b>}
        />
        <ListRow
          left={<span className="text-[var(--muted)]">Email</span>}
          right={<b className="text-[12px]">{creatorPrivate?.email || ''}</b>}
          isLast={true}
        />
      </Card>

      <div className="text-[13px] text-[var(--muted)] mb-2 mt-4 font-semibold">
        Account details
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <Card>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Full name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Main platform
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          >
            {PLATFORMS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Niche
          </label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Beauty, tech, fitness…"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Followers
          </label>
          <input
            type="number"
            min="0"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
          />
        </Card>

        <div className="text-[13px] text-[var(--muted)] mb-2 mt-4 font-semibold">
          Payout &amp; Contact Details (Private)
        </div>

        <Card>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            EcoCash phone number (for payouts)
          </label>
          <input
            type="tel"
            value={ecoCashNumber}
            onChange={(e) => setEcoCashNumber(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            placeholder="+263 77 000 0000"
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            WhatsApp contact number
          </label>
          <input
            type="tel"
            value={whatsAppNumber}
            onChange={(e) => setWhatsAppNumber(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
            placeholder="+263 78 000 0000"
          />

          {isSaved && (
            <div className="text-[12px] text-[var(--ok)] font-bold mt-2">
              ✓ Details updated successfully.
            </div>
          )}

          {errorMsg && (
            <div className="text-[12px] text-[var(--err)] font-bold mt-2">{errorMsg}</div>
          )}
        </Card>

        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </Button>
      </form>

      <div className="text-[13px] text-[var(--muted)] mb-2 mt-6 font-semibold">Password</div>
      <form onSubmit={handlePassword}>
        <Card>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Current password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          />
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            New password (min 12 characters)
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          />
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Confirm new password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
          />

          {passwordMsg && (
            <div className="text-[12px] text-[var(--ok)] font-bold mt-2">{passwordMsg}</div>
          )}
          {passwordError && (
            <div className="text-[12px] text-[var(--err)] font-bold mt-2">{passwordError}</div>
          )}
        </Card>
        <div className="mt-3">
          <Button type="submit" variant="ghost" disabled={passwordBusy}>
            {passwordBusy ? 'Updating…' : 'Change password'}
          </Button>
        </div>
      </form>

      <div className="text-[13px] text-[var(--err)] mb-2 mt-6 font-semibold">Danger zone</div>
      <form onSubmit={handleDelete}>
        <Card>
          <div className="text-[13px] text-[var(--muted)] leading-[1.5] mb-3">
            Deleting your account removes your profile and signs you out. Your submitted clips and
            payment records are kept for financial auditing. Any unpaid balance is written off and
            cannot be recovered, so withdraw first.
          </div>

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
          />

          {deleteError && (
            <div className="text-[12px] text-[var(--err)] font-bold mt-2">{deleteError}</div>
          )}
        </Card>
        <div className="mt-3">
          <Button type="submit" variant="danger" disabled={deleteBusy}>
            {deleteBusy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </form>

      {onOpenSupport && (
        <div className="mt-6">
          <div className="text-[13px] text-[var(--muted)] mb-2 font-semibold">Help &amp; support</div>
          <Card>
            <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
              Payments, clips, campaigns or account issues — open a ticket and the Mhommo team will
              reply in your notification bell.
            </p>
            <div className="mt-3">
              <Button variant="ghost" onClick={onOpenSupport}>
                Open support tickets
              </Button>
            </div>
          </Card>
        </div>
      )}

      {onLogout && (
        <div className="mt-6 mb-6">
          <Button variant="ghost" onClick={onLogout}>
            Switch account / Sign out
          </Button>
        </div>
      )}
    </div>
  );
};
