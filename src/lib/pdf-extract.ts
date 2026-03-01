import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract text from a PDF using pdf.js text layer.
 * Returns { text, pageCount, hasText } where hasText indicates
 * whether meaningful text was found (vs scanned/image PDF).
 */
export async function extractTextFromPdf(file: File): Promise<{
  text: string;
  pageCount: number;
  hasText: boolean;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  let fullText = "";

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ")
      .trim();
    if (pageText) {
      fullText += `--- Página ${i} ---\n${pageText}\n\n`;
    }
  }

  // If average chars per page < 50, likely a scanned PDF
  const avgChars = fullText.length / pageCount;
  return {
    text: fullText.trim(),
    pageCount,
    hasText: avgChars > 50,
  };
}

/**
 * Render PDF pages to base64 PNG images for OCR.
 * Limited to first maxPages pages.
 */
export async function renderPdfPagesToImages(
  file: File,
  maxPages = 10,
  scale = 2
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport }).promise;
    // Use JPEG for smaller payload
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    images.push(dataUrl);
  }

  return images;
}
