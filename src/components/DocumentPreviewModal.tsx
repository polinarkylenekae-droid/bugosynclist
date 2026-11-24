import React, { useEffect, useState } from 'react';
import { CheckCircle, Download, FileText, Loader2, X } from 'lucide-react';
import { loadPdfJs } from '../utils/pdfLoader';
import { dataUrlToUint8Array, downloadDocumentFile, isRealDocumentUrl } from '../utils/realDocumentPdf';

interface DocumentPreviewModalProps {
  title: string;
  url: string;
  subtitle?: string;
  footerText?: string;
  closeLabel?: string;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  title,
  url,
  subtitle,
  footerText,
  closeLabel,
  onClose
}) => {
  const [renderedPages, setRenderedPages] = useState<string[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const isReal = isRealDocumentUrl(url);
  const isPdf =
    isReal &&
    (url.startsWith('data:application/pdf') ||
      url.toLowerCase().endsWith('.pdf') ||
      title.toLowerCase().endsWith('.pdf') ||
      (subtitle || '').toLowerCase().includes('pdf'));

  useEffect(() => {
    let cancelled = false;
    if (!isReal || !isPdf) {
      setRenderedPages([]);
      setIsLoadingPdf(false);
      setPdfError(null);
      return;
    }

    const renderPdfPages = async () => {
      setIsLoadingPdf(true);
      setPdfError(null);
      try {
        let bytes: Uint8Array;
        if (url.startsWith('data:')) {
          const parsed = dataUrlToUint8Array(url);
          if (!parsed || parsed.byteLength === 0) {
            throw new Error('Empty PDF data.');
          }
          bytes = parsed;
        } else {
          const resp = await fetch(url);
          if (!resp.ok) {
            throw new Error(`Unable to fetch document (${resp.status}).`);
          }
          const buf = await resp.arrayBuffer();
          if (buf.byteLength === 0) {
            throw new Error('Empty PDF file.');
          }
          bytes = new Uint8Array(buf);
        }

        const standardFontDataUrl =
          typeof window !== 'undefined' ? `${window.location.origin}/pdf-standard-fonts/` : undefined;
        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          ...(standardFontDataUrl ? { standardFontDataUrl } : {})
        });
        const pdfDoc = await loadingTask.promise;
        const pageImages: string[] = [];

        const maxPages = Math.min(pdfDoc.numPages, 12);
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.8 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          pageImages.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          if (pageImages.length === 0) {
            setPdfError('No renderable pages found in PDF.');
          } else {
            setRenderedPages(pageImages);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setPdfError(err?.message || 'Unable to preview PDF inline.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPdf(false);
        }
      }
    };

    void renderPdfPages();
    return () => {
      cancelled = true;
    };
  }, [url, isReal, isPdf]);

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-4 border border-gray-200 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{title}</h3>
            {subtitle && <span className="text-[11px] text-gray-500 font-medium block truncate">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isReal && (
              <button
                type="button"
                onClick={() => downloadDocumentFile(url, title)}
                className="px-3 py-1.5 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="w-full h-[65vh] max-h-[560px] rounded-2xl overflow-y-auto bg-gray-100 border border-gray-200 flex flex-col items-center p-3 gap-3">
          {!isReal ? (
            <div className="m-auto text-center text-gray-500 text-xs px-6 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-gray-400" />
              <p className="font-semibold">No previewable document file attached.</p>
            </div>
          ) : isPdf ? (
            isLoadingPdf ? (
              <div className="m-auto flex flex-col items-center gap-2 text-xs text-gray-600 font-semibold">
                <Loader2 className="w-6 h-6 animate-spin text-[#0c532b]" />
                <span>Rendering PDF pages...</span>
              </div>
            ) : pdfError ? (
              <div className="m-auto text-center text-xs text-gray-600 space-y-3 px-6">
                <FileText className="w-8 h-8 mx-auto text-gray-400" />
                <p className="font-semibold text-gray-800">{pdfError}</p>
                <button
                  type="button"
                  onClick={() => downloadDocumentFile(url, title)}
                  className="px-4 py-2 bg-[#0c532b] text-white font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF File</span>
                </button>
              </div>
            ) : (
              renderedPages.map((pageSrc, i) => (
                <img
                  key={i}
                  src={pageSrc}
                  alt={`${title} - Page ${i + 1}`}
                  className="w-full max-w-[560px] h-auto rounded-lg shadow-sm border border-gray-200 bg-white"
                />
              ))
            )
          ) : (
            <img
              src={url}
              alt={title}
              className="w-full h-full object-contain m-auto"
            />
          )}
        </div>

        {(footerText || closeLabel) && (
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs pt-1">
            {footerText ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                <span>{footerText}</span>
              </span>
            ) : (
              <span />
            )}
            {closeLabel && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition cursor-pointer"
              >
                {closeLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
