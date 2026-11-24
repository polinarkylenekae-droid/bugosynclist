import React from 'react';
import {
  X,
  CheckCircle2,
  Megaphone,
  ShieldCheck,
  Clock,
  MapPin,
  FileText,
  Info
} from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationNoticeModalProps {
  notification: NotificationItem;
  onClose: () => void;
  onViewOfficialPaper?: () => void;
}

export function cleanNotificationTitle(title: string): string {
  return (title || '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/gu, '').trim() || title;
}

export const NotificationNoticeModal: React.FC<NotificationNoticeModalProps> = ({
  notification,
  onClose,
  onViewOfficialPaper
}) => {
  const cleanTitle = cleanNotificationTitle(notification.title);
  const doc = notification.documentData;

  const isQualification =
    cleanTitle.toLowerCase().startsWith('qualified:') ||
    notification.id.startsWith('notif-qual-');
  const isAnnouncement = notification.type === 'announcement';
  const isStatus = notification.type === 'status_update' || isQualification;

  const noticeLabel = isQualification
    ? 'Program Qualification Notice'
    : isAnnouncement
    ? 'Barangay Advisory'
    : isStatus
    ? 'Status Update'
    : 'Official Notice';

  const refCode = doc?.controlNumber || notification.applicationRef;

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simple Header */}
        <div className="px-5 py-4 bg-[#0c532b] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isAnnouncement ? (
              <Megaphone className="w-4 h-4 text-emerald-200 shrink-0" />
            ) : isStatus ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-200 shrink-0" />
            )}
            <span className="text-xs font-semibold tracking-wide truncate">
              {noticeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-emerald-100 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0"
            aria-label="Close notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3 text-gray-400" />
                {notification.timestamp}
              </span>
              {refCode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-gray-700">
                    Ref: {refCode}
                  </span>
                </>
              )}
            </div>

            <h2 className="text-base font-bold text-gray-900 leading-snug">
              {cleanTitle}
            </h2>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed">
            {notification.message}
          </p>

          {/* Compact Key Details for Official Documents */}
          {(doc?.venueOrOffice || doc?.officialRemarks) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 text-xs text-gray-700">
              {doc?.venueOrOffice && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#0c532b] mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-gray-900">Location:</strong> {doc.venueOrOffice}
                  </span>
                </div>
              )}
              {doc?.officialRemarks && (
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-[#0c532b] mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-gray-900">Note:</strong> {doc.officialRemarks}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Simple plain-English next step for Qualification notices */}
          {isQualification && !doc && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 leading-relaxed">
              <strong>What to do next:</strong> Watch for the release schedule in Announcements, or apply under Services when intake is open.
            </div>
          )}
        </div>

        {/* Clean Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
          {doc && onViewOfficialPaper && (
            <button
              type="button"
              onClick={onViewOfficialPaper}
              className="px-3.5 py-2 bg-white hover:bg-gray-100 text-[#0c532b] border border-gray-200 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Official Paper</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
