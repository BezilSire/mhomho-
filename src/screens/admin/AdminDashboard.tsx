import React from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { FunnelBar, FunnelStage } from '../../components/FunnelBar.tsx';
import { DatabaseState, calculateTotalOwedCents, approveCreator } from '../../lib/firebase.ts';
import { formatCents } from '../../lib/money.ts';

export interface AdminDashboardProps {
  db: DatabaseState;
  onNavigateTab?: (tab: 'queue' | 'campaigns' | 'payouts' | 'enquiries') => void;
}

const CAMPAIGN_ZERO_FUNNEL: FunnelStage[] = [
  { label: 'Found', count: 420, widthPercent: 100 },
  { label: 'Signed up', count: 212, widthPercent: 84 },
  { label: 'Posted clips', count: 96, widthPercent: 66 },
  { label: 'Accepted', count: 41, widthPercent: 48 },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  db,
  onNavigateTab,
}) => {
  const totalOwed = calculateTotalOwedCents();

  // Find creators currently waiting for approval
  const pendingCreators = Object.values(db.creatorsPublic).filter(
    (c) => c.status === 'applied'
  );

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-extrabold tracking-[0.06em] text-[14px]">
          MHOMHO ADMIN
        </span>
        {pendingCreators.length > 0 && (
          <Tag variant="warn">{pendingCreators.length} applicant pending</Tag>
        )}
      </div>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">
        Campaign Zero
      </h2>

      {/* Funnel visualization */}
      <FunnelBar stages={CAMPAIGN_ZERO_FUNNEL} />

      {/* Pending Applicants to Approve */}
      {pendingCreators.length > 0 && (
        <div className="mt-4 mb-2">
          <div className="text-[13px] text-[var(--muted)] mb-1">
            Applicants awaiting approval
          </div>
          <Card>
            {pendingCreators.map((creator, idx) => (
              <ListRow
                key={creator.uid}
                isLast={idx === pendingCreators.length - 1}
                left={
                  <div>
                    <b>{creator.handle}</b>
                    <div className="text-[12px] text-[var(--muted)]">
                      {creator.platform} · {creator.followers.toLocaleString()} followers · {creator.niche}
                    </div>
                  </div>
                }
                right={
                  <button
                    type="button"
                    onClick={() => approveCreator(creator.uid, 'admin')}
                    className="px-3 py-1.5 rounded-[8px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[12px] cursor-pointer"
                  >
                    Approve
                  </button>
                }
              />
            ))}
          </Card>
        </div>
      )}

      {/* Niche readiness card */}
      <div className="text-[13px] text-[var(--muted)] mt-[18px] mb-1">
        Niche readiness
      </div>
      <Card>
        <ListRow
          left={<b>Tech &amp; gadgets</b>}
          right={<Tag variant="ok">Ready · 34</Tag>}
        />
        <ListRow
          left={<b>Health &amp; beauty</b>}
          right={<Tag variant="warn">Building · 22</Tag>}
        />
        <ListRow
          left={<b>Food &amp; travel</b>}
          right={<Tag variant="warn">Building · 9</Tag>}
          isLast={true}
        />
      </Card>

      {/* Total Owed Card */}
      <Card>
        <div className="flex justify-between items-center gap-2">
          <span className="text-[13px] text-[var(--muted)]">Owed to creators</span>
          <b className="text-[20px] font-extrabold text-gradient leading-[1.1]">
            {formatCents(totalOwed || 31840)}
          </b>
        </div>
      </Card>
    </div>
  );
};
