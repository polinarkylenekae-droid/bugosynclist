import React from 'react';
import { X, Printer, ShieldCheck, FileText } from 'lucide-react';
import { NotificationItem } from '../types';
import { BugoLogo } from './BugoLogo';
import { useApp } from '../context/AppContext';

interface NotificationPaperModalProps {
  notification: NotificationItem;
  onClose: () => void;
  onNavigateToArea?: (area: string) => void;
}

export const NotificationPaperModal: React.FC<NotificationPaperModalProps> = ({
  notification,
  onClose,
  onNavigateToArea
}) => {
  const { secretariatDetails } = useApp();
  const doc = notification.documentData;
  const docType = doc?.docType || 'Official Barangay Document';
  const controlNumber = doc?.controlNumber || notification.applicationRef || `BG-${notification.id.slice(-6).toUpperCase()}`;
  const issueDate = doc?.issueDate || notification.timestamp;
  const recipientName = doc?.recipientName || 'Bona Fide Bugo Resident / Applicant';
  const subject = doc?.subject || notification.title;
  const narrative = doc?.narrative || notification.message;
  const venue = doc?.venueOrOffice || 'Barangay Bugo Administrative Complex, Cagayan de Oro City';
  const remarks = doc?.officialRemarks;
  const signatoryName = doc?.signatoryName || secretariatDetails.punongBarangay;
  const signatoryRole = doc?.signatoryRole || 'Punong Barangay';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-6 overflow-hidden flex flex-col border border-gray-300">
        {/* Top Control Bar (Hidden on print) */}
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0c532b]" />
            <span className="text-xs font-bold text-gray-800">Official Barangay Paper Document</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Page</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Document Sheet */}
        <div className="p-6 sm:p-10 bg-[#fdfdfb] text-gray-900 space-y-6 printable-document relative">
          {/* Subtle Watermark in background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
            <BugoLogo size="lg" />
          </div>

          {/* Official Letterhead Header */}
          <div className="text-center border-b-2 border-gray-800 pb-4 relative">
            <div className="flex items-center justify-center gap-4 mb-2">
              <BugoLogo size="md" />
              <div className="text-center font-serif-brand">
                <p className="text-[10px] sm:text-xs tracking-wider text-gray-600 uppercase font-bold">
                  Republic of the Philippines
                </p>
                <p className="text-[10px] sm:text-xs text-gray-600 font-bold">
                  Province of Misamis Oriental • City of Cagayan de Oro
                </p>
                <h3 className="text-sm sm:text-base font-extrabold text-gray-950 uppercase tracking-tight">
                  Barangay Bugo Administrative Council
                </h3>
                <p className="text-[10px] text-gray-500 font-sans-brand italic">
                  Office of the Punong Barangay • Resident Assistance Portal
                </p>
              </div>
            </div>

            {/* Document Title Ribbon */}
            <div className="mt-3 inline-block px-4 py-1 bg-gray-900 text-white text-xs font-extrabold tracking-widest uppercase rounded">
              {docType}
            </div>
          </div>

          {/* Document Reference Header Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-sans-brand">Control / Docket No.</span>
              <span className="font-bold text-gray-900">{controlNumber}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-sans-brand">Date of Issuance</span>
              <span className="font-bold text-gray-900">{issueDate}</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-gray-200">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-sans-brand">Addressee / Subject Person</span>
              <span className="font-bold text-gray-900 text-sm font-sans-brand">{recipientName}</span>
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500">Subject / Matter:</h4>
            <p className="text-sm font-extrabold text-gray-900 mt-0.5 font-serif-brand">
              {subject}
            </p>
          </div>

          {/* Document Body Narrative */}
          <div className="space-y-3 text-xs sm:text-sm text-gray-800 leading-relaxed font-serif-brand border-y border-gray-200 py-4">
            <p className="text-justify indent-6">
              {narrative}
            </p>

            {venue && (
              <p className="text-xs text-gray-600 font-sans-brand">
                <strong>Office / Location:</strong> {venue}
              </p>
            )}

            {remarks && (
              <p className="text-xs italic text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-200 font-sans-brand">
                <strong>Directive / Instructions:</strong> {remarks}
              </p>
            )}
          </div>

          {/* Official Signatures & Seal Block */}
          <div className="pt-4 flex items-end justify-between text-xs">
            {/* Seal Watermark & Security Code */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-[#0c532b]" />
                <span>OFFICIALLY CERTIFIED & RECORDED</span>
              </div>
              <p className="text-[10px] font-mono text-gray-400">
                SYSTEM VERIFICATION REF: BG-AUTH-{notification.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase().padStart(6, '0')}
              </p>
              <p className="text-[10px] text-gray-400">
                Barangay Bugo Citizen Portal Digital Registry
              </p>
            </div>

            {/* Official Signatory Signature Line */}
            <div className="text-center min-w-[200px]">
              <div className="border-b-2 border-gray-800 pb-1 mb-1 font-bold text-gray-950 font-serif-brand text-sm">
                {signatoryName}
              </div>
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">
                {signatoryRole}
              </div>
              <div className="text-[10px] text-gray-500">
                {secretariatDetails.lguUnit}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Footer (Hidden on Print) */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3.5 flex items-center justify-end no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
};
