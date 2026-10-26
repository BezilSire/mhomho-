import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, EnquiryDoc } from '../../lib/firebase.ts';
import { updateEnquiryStatus } from '../../lib/api.ts';

export interface AdminEnquiriesProps {
  db: DatabaseState;
}

export const AdminEnquiries: React.FC<AdminEnquiriesProps> = ({ db }) => {
  const [errorMsg, setErrorMsg] = useState('');
  const enquiries = Object.values(db.enquiries).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const handleWhatsAppBrand = (enq: EnquiryDoc) => {
    const text = encodeURIComponent(
      `Hi ${enq.contactName}, thank you for contacting Mhomho Media regarding ${enq.bizName}. We reviewed your brief for ${enq.promo} with budget ${enq.budget}. When would be a great time for a 10-minute discovery call?`
    );
    window.open(`https://wa.me/${enq.phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  const updateStatus = async (id: string, status: 'new' | 'contacted' | 'booked') => {
    setErrorMsg('');
    const result = await updateEnquiryStatus(id, status);
    if (!result.success) setErrorMsg(result.error || 'The enquiry status could not be updated.');
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-1">
        Brand Inquiries
      </h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        Incoming campaign inquiries and call requests from the public website wizard.
      </p>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      {enquiries.length === 0 ? (
        <Card className="text-center py-8 text-[var(--muted)] text-[14px]">
          No inquiries in inbox yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {enquiries.map((enq) => {
            const isNew = enq.status === 'new';

            return (
              <Card key={enq.id}>
                <div className="flex justify-between items-center gap-2 mb-1">
                  <b className="text-[15px]">{enq.bizName}</b>
                  <Tag variant={isNew ? 'warn' : 'ok'}>
                    {enq.status}
                  </Tag>
                </div>

                <div className="text-[13px] text-[var(--muted)] mb-2">
                  Contact: <b>{enq.contactName}</b> · Phone: <b>{enq.phone}</b>
                </div>

                <div className="text-[13px] text-[var(--text)] mb-1">
                  <strong>Promoting:</strong> {enq.promo}
                </div>

                <div className="text-[12px] text-[var(--muted)] mb-2 space-y-0.5">
                  <div><strong>Niche:</strong> {enq.niche}</div>
                  <div><strong>Budget:</strong> {enq.budget} · <strong>Start:</strong> {enq.start}</div>
                  <div><strong>Goals:</strong> {enq.goals.join(', ')}</div>
                  {enq.notes && <div><strong>Notes:</strong> {enq.notes}</div>}
                  {enq.bestTimes && enq.bestTimes.length > 0 && (
                    <div><strong>Best times for call:</strong> {enq.bestTimes.join(', ')}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]">
                  <Button size="sm" onClick={() => handleWhatsAppBrand(enq)}>
                    Reply on WhatsApp
                  </Button>
                  {isNew && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(enq.id, 'contacted')}
                    >
                      Mark Contacted
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
