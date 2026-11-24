import React from 'react';
import { Megaphone, X, Eye, Calendar, Printer, Building2, CheckCircle2 } from 'lucide-react';
import { AnnouncementItem } from '../types';
import { BugoSealEmblem } from './BugoLogo';
import { useApp } from '../context/AppContext';

interface AnnouncementModalProps {
  announcement: AnnouncementItem | null;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  onClose
}) => {
  const { secretariatDetails } = useApp();
  if (!announcement) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-gray-200 shadow-2xl space-y-6 my-8 printable-document">
        {/* Official Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <BugoSealEmblem sizePx={52} />
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Republic of the Philippines • City of Cagayan de Oro
              </p>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0c532b]">
                BARANGAY BUGO ADVISORY
              </h2>
              <p className="text-[11px] text-gray-500">
                Official Bulletin & Public Notice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer no-print"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badges & Metrics Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-2">
            <span className="font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-[#0c532b] text-[11px]">
              {announcement.category}
            </span>
            <span className="flex items-center gap-1 text-gray-500 font-medium text-[11px]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{announcement.date}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[#0c532b] font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-xl">
            <Eye className="w-3.5 h-3.5" />
            <span>{announcement.viewsCount || 0} {(announcement.viewsCount || 0) === 1 ? 'Resident Read' : 'Resident Reads'}</span>
          </div>
        </div>

        {/* Announcement Content */}
        <div className="space-y-4">
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-snug">
            {announcement.title}
          </h3>

          {/* Qualified Beneficiaries Exclusive Box */}
          {announcement.targetAudienceType === 'Qualified Beneficiaries Only' && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-[#0c532b] font-extrabold uppercase text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Exclusive Schedule for Qualified Beneficiaries ({announcement.targetProgramTitle || 'Targeted Program'})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {announcement.releaseDate && (
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-gray-400 block font-semibold text-[10px]">RELEASE DATE</span>
                    <span className="font-bold text-gray-900">{announcement.releaseDate}</span>
                  </div>
                )}
                {announcement.meetingTime && (
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-gray-400 block font-semibold text-[10px]">MEETING TIME</span>
                    <span className="font-bold text-gray-900">{announcement.meetingTime}</span>
                  </div>
                )}
                {announcement.meetingVenue && (
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-gray-400 block font-semibold text-[10px]">VENUE</span>
                    <span className="font-bold text-gray-900">{announcement.meetingVenue}</span>
                  </div>
                )}
              </div>
              {announcement.instructions && (
                <div className="text-[11px] text-gray-700 bg-white p-2.5 rounded-xl border border-emerald-100">
                  <span className="font-bold text-gray-900 block mb-0.5">Instructions & What to Bring:</span>
                  <p className="leading-relaxed">{announcement.instructions}</p>
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-200 text-gray-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium">
            {announcement.description}
          </div>
        </div>

        {/* Official Issuance Footer */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            <p className="font-bold text-gray-800">Sangguniang Barangay of Bugo</p>
            <p className="text-[11px]">Administrative Secretariat & Community Information Unit</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">{secretariatDetails.punongBarangay}</p>
            <p className="text-[11px]">Punong Barangay</p>
          </div>
        </div>

        {/* Modal Buttons (Hidden in print) */}
        <div className="flex gap-2 pt-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span>Print Official Notice</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
