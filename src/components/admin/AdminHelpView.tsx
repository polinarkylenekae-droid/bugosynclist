import React, { useState } from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  PhoneCall, 
  ShieldCheck, 
  Search, 
  FileCheck2, 
  Users, 
  Archive, 
  ChevronDown, 
  ChevronUp, 
  Building,
  Award
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: 'residents' | 'assistance' | 'clearance' | 'archives' | 'general';
}

const ADMIN_FAQS: FaqItem[] = [
  {
    category: 'residents',
    question: 'How are new Resident Accounts approved and managed?',
    answer: 'Newly created Resident Accounts are automatically approved and verified upon registration. Navigate to "Resident Account" from the left sidebar to inspect a resident’s profile information and uploaded IDs, edit details, ban or unban accounts, or delete records.'
  },
  {
    category: 'residents',
    question: 'When should an account be banned or flagged?',
    answer: 'If an account submits fraudulent identity documents or false residency claims, an administrator can click "Ban Account" on their resident card. Provide a specific administrative reason. Banned accounts cannot submit requests or log in.'
  },
  {
    category: 'assistance',
    question: 'How does the Assistance Request evaluation process work?',
    answer: 'Go to "Tracking" or review pending requests from the Dashboard. The system automatically performs preliminary checks against program income ceilings and Purok boundaries. Review the attached documents (e.g., Certificate of Indigency, Doctor’s Prescription, School Registration), then update the status to "Approved", "Ready for Release", or "Needs Additional Requirements".'
  },
  {
    category: 'clearance',
    question: 'How do I issue an official Barangay Clearance or Residency Certificate?',
    answer: 'Open the Clearance issuance modal from the Dashboard header. Select the resident name and purpose (employment, scholarship, business, passport, ID). The system generates an official certificate with tracking QR code and printable layout.'
  },
  {
    category: 'archives',
    question: 'How does automatic archiving work without uploading files?',
    answer: 'In "Archives & Logs", the system automatically records visitor time-ins, time-outs, and completed actions. You can click "Archive Activity" on any entry to move it directly into the Archived Records registry with zero file uploads. You can also click "Auto-Archive Completed Activities" to preserve all finished tasks instantly.'
  }
];

const EMERGENCY_HOTLINES = [
  {
    agency: 'Barangay Bugo Administrative Complex',
    desc: 'Main Office, Brgy. Hall, Zone 1',
    number: '(088) 855-BUGO / 0917-111-0000',
    type: 'Local Barangay'
  },
  {
    agency: 'Bugo Police Sub-Station 6 (PS6)',
    desc: 'Philippine National Police - Bugo Outpost',
    number: '(088) 855-2233 / 0998-598-6543',
    type: 'Police Emergency'
  },
  {
    agency: 'Cagayan de Oro City 911 / CDRRMD',
    desc: 'City Disaster Risk Reduction & Management',
    number: '911 / (088) 857-3911 / 0917-700-1111',
    type: 'City Emergency'
  },
  {
    agency: 'Bugo Bureau of Fire Protection (BFP)',
    desc: 'Bugo Fire Sub-Station',
    number: '(088) 855-1911 / 0935-442-9911',
    type: 'Fire Emergency'
  },
  {
    agency: 'Bugo Health Center & Maternity Clinic',
    desc: 'Primary Medical & Ambulance Assistance',
    number: '(088) 855-3344',
    type: 'Health Care'
  },
  {
    agency: 'CEPALCO Electric Emergency',
    desc: 'Power Outages & Fallen Electric Lines',
    number: '(088) 852-5000 / 0917-817-8777',
    type: 'Power Utility'
  },
  {
    agency: 'COWD Water Supply Emergency',
    desc: 'Water Service Interruption & Pipe Breaks',
    number: '(088) 856-4365 / 0917-719-7411',
    type: 'Water Utility'
  }
];

export const AdminHelpView: React.FC = () => {
  const [faqSearch, setFaqSearch] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('all');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  const filteredFaqs = ADMIN_FAQS.filter(faq => {
    const matchesSearch = 
      faq.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      faq.answer.toLowerCase().includes(faqSearch.toLowerCase());
    const matchesCategory = selectedFaqCategory === 'all' || faq.category === selectedFaqCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <HelpCircle className="w-7 h-7 text-[#0c532b]" />
            <span>Administrator Help & Support Center</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Operational guides, standard operating procedures, hotlines, and technical support for Barangay Bugo officials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-emerald-50 text-[#0c532b] rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Official Admin Guide</span>
          </div>
        </div>
      </div>

      {/* Quick Action Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0c532b] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Resident Verification</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Verify submitted PhilSys IDs or student IDs against Purok records before granting clearance permissions.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Assistance Workflow</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Validate income criteria, inspect medical or educational proofs, and update statuses with audit remarks.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Barangay Clearances</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Generate and print official clearances, residency certificates, and indigency proofs with QR security.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Archive className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Automated Archives</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            System logs and completed tasks can be archived instantly with 1-click. No document uploads required.
          </p>
        </div>
      </div>

      {/* Main Two-Column Layout: FAQs & Hotlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: FAQs (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#0c532b]" />
                  <span>Frequently Asked Questions & Standard Procedures</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Click any question to view step-by-step instructions.</p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'residents', label: 'Residents' },
                  { id: 'assistance', label: 'Assistance' },
                  { id: 'clearance', label: 'Clearances' },
                  { id: 'archives', label: 'Archives' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedFaqCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      selectedFaqCategory === cat.id
                        ? 'bg-[#0c532b] text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search troubleshooting guides, policies, or instructions..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="w-full bg-gray-50 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#0c532b] text-gray-800"
              />
            </div>

            {/* Accordion List */}
            <div className="space-y-2.5 pt-1">
              {filteredFaqs.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No help topics found matching your query.
                </div>
              ) : (
                filteredFaqs.map((faq, index) => {
                  const isExpanded = expandedFaqIndex === index;
                  return (
                    <div
                      key={index}
                      className={`border rounded-2xl transition overflow-hidden ${
                        isExpanded ? 'border-emerald-300 bg-emerald-50/20' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <button
                        onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                        className="w-full flex items-center justify-between p-4 text-left gap-3"
                      >
                        <span className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">
                          {faq.question}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#0c532b] flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 text-xs text-gray-600 leading-relaxed border-t border-emerald-100/60">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Emergency Hotlines & Directory (1 Col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#0c532b]" />
                <span>Barangay & City Hotlines</span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Official emergency and utility numbers for Cagayan de Oro City & Barangay Bugo.
              </p>
            </div>

            <div className="space-y-3">
              {EMERGENCY_HOTLINES.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 hover:border-emerald-200 transition space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-[#0c532b]">
                      {item.type}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 leading-tight pt-0.5">{item.agency}</h4>
                  <p className="text-[11px] text-gray-500">{item.desc}</p>
                  <p className="text-xs font-mono font-bold text-[#0c532b] pt-1">{item.number}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Legal / Policy Note */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <Building className="w-4 h-4" />
              <span>Data Privacy Act & Citizen's Charter</span>
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              In accordance with Republic Act No. 10173 (Data Privacy Act of 2012), all resident identification cards and household financial declarations are confidential and restricted strictly to official public assistance processing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
