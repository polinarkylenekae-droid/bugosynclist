import { SAFARI_WORKER_POLYFILL_SOURCE } from '../polyfills';

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
let workerBlobUrl: string | null = null;

export async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const [pdfjsLib, workerModule] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);

      const rawWorkerUrl = workerModule.default;
      if (typeof window !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        try {
          if (!workerBlobUrl) {
            const absoluteWorkerUrl = new URL(rawWorkerUrl, window.location.origin).href;
            const bootstrapSource = `${SAFARI_WORKER_POLYFILL_SOURCE}\nimport ${JSON.stringify(absoluteWorkerUrl)};\n`;
            const blob = new Blob([bootstrapSource], { type: 'application/javascript' });
            workerBlobUrl = URL.createObjectURL(blob);
          }
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = rawWorkerUrl;
        }
      } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = rawWorkerUrl;
      }

      return pdfjsLib;
    })();
  }
  return pdfJsPromise;
}
