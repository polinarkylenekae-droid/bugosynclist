import React, { useEffect, useState } from 'react';
import {
  Download,
  Upload,
  Printer,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseCsvText } from '../../utils/csvParser';
import { sortProgramsAlphabetically } from '../../utils/sortUtils';
import { printReportDocument, PrintableReportColumn } from '../../utils/printReport';

type ExportDataset = 'victims' | 'hazards' | 'applications' | 'programs' | 'all';
type ImportDataset = 'victims' | 'hazards' | 'programs';
type ReportType = 'victims' | 'hazards' | 'programs' | 'applications' | 'imported';

interface ImportedFileEntry {
  id: string;
  fileName: string;
  recordType: ImportDataset;
  mode: 'merge' | 'replace';
  importedCount: number;
  importedAt: string;
  rows: Record<string, any>[];
}

const IMPORTED_FILES_STORAGE_KEY = 'bugo_admin_imported_files_v1';

const DATASET_LABEL: Record<ImportDataset, string> = {
  victims: 'Disaster Victims',
  hazards: 'Hazard Zones',
  programs: 'Programs'
};

function formatPreviewCell(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getPreviewColumns(rows: Record<string, any>[], type: ImportDataset): Array<{ key: string; label: string }> {
  const preferred: Record<ImportDataset, Array<{ key: string; label: string }>> = {
    victims: [
      { key: 'fullName', label: 'Name' },
      { key: 'purok', label: 'Zone' },
      { key: 'disasterType', label: 'Disaster' },
      { key: 'damageLevel', label: 'Damage' }
    ],
    hazards: [
      { key: 'name', label: 'Location' },
      { key: 'disasterType', label: 'Category' },
      { key: 'riskLevel', label: 'Risk' },
      { key: 'purok', label: 'Zone' }
    ],
    programs: [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'targetAudience', label: 'Audience' }
    ]
  };

  const sample = rows[0] || {};
  const availableKeys = Object.keys(sample);
  const matched = preferred[type].filter(col =>
    availableKeys.some(k => k.toLowerCase() === col.key.toLowerCase())
  ).map(col => {
    const exactKey = availableKeys.find(k => k.toLowerCase() === col.key.toLowerCase()) || col.key;
    return { key: exactKey, label: col.label };
  });

  if (matched.length >= 2) return matched;

  // Fallback for alternative CSV headers (e.g., "name" instead of "fullName")
  return availableKeys.slice(0, 4).map(k => ({ key: k, label: k }));
}

export const AdminImportExportView: React.FC = () => {
  const {
    disasterVictims,
    hazardZones,
    programs,
    applications,
    downloadExportedRecords,
    importRecords
  } = useApp();

  const sortedPrograms = sortProgramsAlphabetically(programs);

  const [exportStatus, setExportStatus] = useState('');
  const [selectedVictimProgramId, setSelectedVictimProgramId] = useState<string>('');
  const [importType, setImportType] = useState<ImportDataset>('victims');
  const [importProgramId, setImportProgramId] = useState<string>('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [importedFiles, setImportedFiles] = useState<ImportedFileEntry[]>(() => {
    try {
      const saved = sessionStorage.getItem(IMPORTED_FILES_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [selectedImportedId, setSelectedImportedId] = useState<string>('');

  const [reportType, setReportType] = useState<ReportType>('victims');

  useEffect(() => {
    try {
      sessionStorage.setItem(IMPORTED_FILES_STORAGE_KEY, JSON.stringify(importedFiles.slice(0, 12)));
    } catch {
      // Ignore storage quota errors
    }
  }, [importedFiles]);

  const activeImportedBatch =
    importedFiles.find(f => f.id === selectedImportedId) || importedFiles[0] || null;

  const scopedVictimsCount = selectedVictimProgramId
    ? disasterVictims.filter(v => (v.enrolledProgramIds || []).includes(selectedVictimProgramId)).length
    : disasterVictims.length;

  const exportRows: Array<{ id: ExportDataset; label: string; count: number }> = [
    { id: 'victims', label: 'Disaster Victims', count: scopedVictimsCount },
    { id: 'hazards', label: 'Bugo Hazard Zones', count: hazardZones.length },
    { id: 'applications', label: 'Service Applications', count: applications.length },
    { id: 'programs', label: 'Assistance Programs', count: programs.length }
  ];

  const handleExport = async (type: ExportDataset, format: 'json' | 'csv') => {
    setExportStatus('');
    const programId = type === 'victims' && selectedVictimProgramId ? selectedVictimProgramId : undefined;
    const res = await downloadExportedRecords(type, format, programId);
    setExportStatus(res.success ? `Downloaded ${type} (${format.toUpperCase()}).` : res.message || 'Export failed.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportFileName(file.name);
    setImportFeedback(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.records)
              ? parsed.records
              : Array.isArray(parsed[importType])
                ? parsed[importType]
                : [];
          setParsedRows(list);
          if (list.length === 0) {
            setImportFeedback({ ok: false, msg: 'No records found in JSON file.' });
          }
        } else {
          const rows = parseCsvText(text);
          setParsedRows(rows);
          if (rows.length === 0) {
            setImportFeedback({ ok: false, msg: 'CSV file has no data rows.' });
          }
        }
      } catch {
        setParsedRows([]);
        setImportFeedback({ ok: false, msg: 'Could not read file. Use valid CSV or JSON.' });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setImportFeedback(null);
    const programId = importType === 'victims' && importProgramId ? importProgramId : undefined;
    const res = await importRecords(importType, importMode, parsedRows, programId);
    setIsImporting(false);
    if (!res.success) {
      setImportFeedback({ ok: false, msg: res.message || 'Import failed.' });
      return;
    }

    const entry: ImportedFileEntry = {
      id: `imp-${Date.now()}`,
      fileName: importFileName || `${importType}.${importMode}.csv`,
      recordType: importType,
      mode: importMode,
      importedCount: res.importedCount ?? parsedRows.length,
      importedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      rows: parsedRows.slice(0, 100)
    };

    setImportedFiles(prev => [entry, ...prev].slice(0, 12));
    setExpandedFileId(entry.id);
    setSelectedImportedId(entry.id);
    setImportFeedback({ ok: true, msg: `Imported ${entry.importedCount} rows from ${entry.fileName}.` });
    setParsedRows([]);
    setImportFileName('');
  };

  const getReportConfig = (
    targetType: ReportType,
    overrideBatch?: ImportedFileEntry
  ): { title: string; columns: PrintableReportColumn[]; rows: string[][] } => {
    if (targetType === 'victims') {
      return {
        title: 'Disaster Victim Roster',
        columns: [
          { label: 'Code' },
          { label: 'Name' },
          { label: 'Zone' },
          { label: 'Disaster / Damage' },
          { label: 'Programs' },
          { label: 'Status' }
        ],
        rows: disasterVictims.map(v => [
          v.victimCode,
          v.fullName,
          v.purok.split(' - ')[0],
          `${v.disasterType} (${v.damageLevel})`,
          (v.enrolledProgramTitles || []).join(', ') || '—',
          v.selectionStatus
        ])
      };
    }

    if (targetType === 'hazards') {
      return {
        title: 'Barangay Bugo Disaster Hazard Zones Report',
        columns: [
          { label: 'Location Name' },
          { label: 'Category' },
          { label: 'Risk' },
          { label: 'Zone' },
          { label: 'Radius' },
          { label: 'Notes' }
        ],
        rows: hazardZones.map(z => [
          z.name,
          z.disasterType,
          z.riskLevel,
          z.purok.split(' - ')[0],
          `${z.radiusMeters}m`,
          z.description
        ])
      };
    }

    if (targetType === 'applications') {
      return {
        title: 'Barangay Bugo Service Applications Report',
        columns: [
          { label: 'Ref No.' },
          { label: 'Resident' },
          { label: 'Program / Service' },
          { label: 'Submitted' },
          { label: 'Status' }
        ],
        rows: applications.map(a => [
          a.referenceCode || a.id,
          a.applicantName || '—',
          a.programTitle,
          a.submissionDate || a.submittedAt || '—',
          a.status
        ])
      };
    }

    if (targetType === 'imported') {
      const batch = overrideBatch || activeImportedBatch;
      if (batch && batch.rows.length > 0) {
        const cols = getPreviewColumns(batch.rows, batch.recordType);
        return {
          title: `Imported File Report — ${batch.fileName}`,
          columns: [{ label: '#' }, ...cols.map(c => ({ label: c.label }))],
          rows: batch.rows.map((row, idx) => [
            String(idx + 1),
            ...cols.map(c => formatPreviewCell(row[c.key]))
          ])
        };
      }
      return {
        title: 'Imported File Report',
        columns: [{ label: '#' }, { label: 'Record' }],
        rows: []
      };
    }

    return {
      title: 'Barangay Bugo Active Assistance Programs',
      columns: [
        { label: 'Program Title' },
        { label: 'Category' },
        { label: 'Status' },
        { label: 'Target Audience' }
      ],
      rows: sortedPrograms.map(p => [p.title, p.category, p.status, p.targetAudience])
    };
  };

  const handlePrintReport = (overrideType?: ReportType, overrideBatch?: ImportedFileEntry) => {
    const activeType = overrideType || reportType;
    const cfg = getReportConfig(activeType, overrideBatch);
    printReportDocument({
      title: cfg.title,
      columns: cfg.columns,
      rows: cfg.rows
    });
  };

  const stagedPreviewCols = parsedRows.length > 0 ? getPreviewColumns(parsedRows, importType) : [];
  const activeReport = getReportConfig(reportType);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Import, Export & Reports
        </h1>
      </div>

      {/* Section 1 & 2: Export & Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 no-print">
        {/* Export Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#0c532b]" />
              <span>Export Records</span>
            </h2>
            <button
              type="button"
              onClick={() => handleExport('all', 'json')}
              className="px-3 py-1.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Full Backup (JSON)
            </button>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {exportRows.map(row => (
              <div key={row.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-800">{row.label}</p>
                  <p className="text-[11px] text-gray-400 tabular-nums">{row.count} records</p>
                  {row.id === 'victims' && (
                    <select
                      value={selectedVictimProgramId}
                      onChange={(e) => setSelectedVictimProgramId(e.target.value)}
                      className="mt-1.5 w-full max-w-[220px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-700 outline-none"
                    >
                      <option value="">All Programs</option>
                      {sortedPrograms.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExport(row.id, 'csv')}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport(row.id, 'json')}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <FileJson className="w-3.5 h-3.5 text-blue-700" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {exportStatus && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              {exportStatus}
            </p>
          )}
        </div>

        {/* Import Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#0c532b]" />
            <span>Import File</span>
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Dataset</label>
              <select
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value as ImportDataset);
                  setParsedRows([]);
                  setImportFileName('');
                  setImportFeedback(null);
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none"
              >
                <option value="victims">Disaster Victims</option>
                <option value="hazards">Bugo Hazard Zones</option>
                <option value="programs">Assistance Programs</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Mode</label>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none"
              >
                <option value="merge">Merge (Keep Existing)</option>
                <option value="replace">Replace Current List</option>
              </select>
            </div>
          </div>

          {importType === 'victims' && (
            <div className="text-xs">
              <label className="block font-bold text-gray-700 mb-1">Program (Optional)</label>
              <select
                value={importProgramId}
                onChange={(e) => setImportProgramId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none"
              >
                <option value="">All / Auto Programs</option>
                {sortedPrograms.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          <label className="block border-2 border-dashed border-gray-300 hover:border-[#0c532b] rounded-2xl p-4 text-center cursor-pointer bg-gray-50/70 transition">
            <input
              type="file"
              accept=".csv,.json,application/json,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <p className="text-xs font-bold text-gray-800">
              {importFileName || 'Choose .CSV or .JSON file'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
              {parsedRows.length > 0 ? `${parsedRows.length} rows loaded` : 'Select a file to preview rows'}
            </p>
          </label>

          {/* File Row Preview List before confirming import */}
          {parsedRows.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
              <div className="px-3 py-2 bg-gray-100/80 border-b border-gray-200 flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800 truncate">
                  {importFileName} · <span className="tabular-nums">{parsedRows.length} rows</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setParsedRows([]);
                    setImportFileName('');
                    setImportFeedback(null);
                  }}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 cursor-pointer shrink-0 ml-2"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-44 overflow-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-500 uppercase">
                    <tr>
                      <th className="py-1.5 px-2.5 w-8">#</th>
                      {stagedPreviewCols.map(col => (
                        <th key={col.key} className="py-1.5 px-2.5">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2.5 text-gray-400 tabular-nums">{idx + 1}</td>
                        {stagedPreviewCols.map(col => (
                          <td key={col.key} className="py-1.5 px-2.5 text-gray-800 max-w-[140px] truncate">
                            {formatPreviewCell(row[col.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="px-3 py-1 text-[10px] text-gray-500 bg-gray-50 border-t border-gray-200 tabular-nums">
                  Showing first 50 of {parsedRows.length} rows
                </p>
              )}
            </div>
          )}

          {importFeedback && (
            <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              importFeedback.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {importFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{importFeedback.msg}</span>
            </div>
          )}

          <button
            type="button"
            disabled={parsedRows.length === 0 || isImporting}
            onClick={handleConfirmImport}
            className="w-full py-2.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
          >
            {isImporting ? 'Importing...' : `Import ${parsedRows.length || ''} Records`}
          </button>

          {/* Imported Files List */}
          {importedFiles.length > 0 && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0c532b]" />
                  <span>Imported Files ({importedFiles.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setImportedFiles([]);
                    setExpandedFileId(null);
                    setSelectedImportedId('');
                    if (reportType === 'imported') setReportType('victims');
                  }}
                  className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear list</span>
                </button>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {importedFiles.map(entry => {
                  const isExpanded = expandedFileId === entry.id;
                  const entryCols = entry.rows.length > 0 ? getPreviewColumns(entry.rows, entry.recordType) : [];
                  return (
                    <div key={entry.id} className="bg-white">
                      <div className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 truncate">{entry.fileName}</p>
                          <p className="text-[11px] text-gray-500 tabular-nums">
                            {DATASET_LABEL[entry.recordType]} · {entry.importedCount} rows · {entry.importedAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedFileId(isExpanded ? null : entry.id)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide' : 'List'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImportedId(entry.id);
                              setReportType('imported');
                              handlePrintReport('imported', entry);
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0c532b] rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>

                      {isExpanded && entry.rows.length > 0 && (
                        <div className="max-h-40 overflow-auto border-t border-gray-100 bg-gray-50">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="sticky top-0 bg-gray-100 text-gray-600 uppercase">
                              <tr>
                                <th className="py-1 px-2.5 w-8">#</th>
                                {entryCols.map(col => (
                                  <th key={col.key} className="py-1 px-2.5">{col.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {entry.rows.map((row, idx) => (
                                <tr key={idx}>
                                  <td className="py-1 px-2.5 text-gray-400 tabular-nums">{idx + 1}</td>
                                  {entryCols.map(col => (
                                    <td key={col.key} className="py-1 px-2.5 text-gray-800 max-w-[140px] truncate">
                                      {formatPreviewCell(row[col.key])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Printable Report */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#0c532b]" />
            <h2 className="text-sm font-extrabold text-gray-900">Reports</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none"
            >
              <option value="victims">Disaster Victims Roster</option>
              <option value="hazards">Bugo Disaster Hazard Zones Report</option>
              <option value="programs">Assistance Programs Summary</option>
              <option value="applications">Service Applications Report</option>
              {importedFiles.length > 0 && (
                <option value="imported">Imported File Report</option>
              )}
            </select>

            {reportType === 'imported' && importedFiles.length > 1 && (
              <select
                value={activeImportedBatch?.id || ''}
                onChange={(e) => setSelectedImportedId(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-semibold outline-none max-w-[200px]"
              >
                {importedFiles.map(f => (
                  <option key={f.id} value={f.id}>{f.fileName}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => handlePrintReport()}
              className="px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="printable-document border border-gray-200 rounded-2xl p-6 space-y-4 bg-white">
          <div className="text-center border-b border-gray-200 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Republic of the Philippines • Barangay Bugo, Cagayan de Oro City
            </p>
            <h3 className="text-base font-extrabold text-gray-900 mt-1">
              {activeReport.title}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
              Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • {activeReport.rows.length} {activeReport.rows.length === 1 ? 'record' : 'records'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-[11px] text-gray-600 uppercase">
                  {activeReport.columns.map(col => (
                    <th key={col.label} className="py-2 pr-3">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeReport.rows.length === 0 ? (
                  <tr>
                    <td colSpan={activeReport.columns.length} className="py-6 text-center text-gray-400">
                      No records available.
                    </td>
                  </tr>
                ) : (
                  activeReport.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-2 ${cIdx < row.length - 1 ? 'pr-3' : ''} ${
                            cIdx === 1 ? 'font-bold text-gray-900' : 'text-gray-700'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
