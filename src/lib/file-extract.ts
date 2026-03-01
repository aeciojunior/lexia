import mammoth from "mammoth";
import { extractTextFromPdf, renderPdfPagesToImages } from "@/lib/pdf-extract";

export interface FileExtractionResult {
  text: string;
  format: string;
  pageCount?: number;
  needsOcr: boolean;
  fileSize: number;
}

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "text/plain": "TXT",
  "text/html": "HTML",
  "text/rtf": "RTF",
  "application/rtf": "RTF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/jpg": "JPG",
};

export function getSupportedFormats(): string {
  return ".pdf,.docx,.doc,.txt,.html,.rtf,.jpg,.jpeg,.png";
}

export function getFormatFromFile(file: File): string {
  return SUPPORTED_MIME_TYPES[file.type] || file.name.split(".").pop()?.toUpperCase() || "UNKNOWN";
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

function stripRtf(rtf: string): string {
  // Remove RTF control words and groups
  let text = rtf.replace(/\{\\[^{}]*\}/g, "");
  text = text.replace(/\\[a-z]+[-]?\d*\s?/gi, "");
  text = text.replace(/[{}]/g, "");
  text = text.replace(/\\\n/g, "\n");
  return text.trim();
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

export async function extractTextFromFile(file: File): Promise<FileExtractionResult> {
  const format = getFormatFromFile(file);
  const fileSize = file.size;

  switch (format) {
    case "PDF": {
      const { text, pageCount, hasText } = await extractTextFromPdf(file);
      return { text, format, pageCount, needsOcr: !hasText, fileSize };
    }

    case "DOCX":
    case "DOC": {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { text: result.value, format, needsOcr: false, fileSize };
    }

    case "TXT": {
      const text = await readFileAsText(file);
      return { text, format, needsOcr: false, fileSize };
    }

    case "HTML": {
      const raw = await readFileAsText(file);
      const text = stripHtml(raw);
      return { text, format, needsOcr: false, fileSize };
    }

    case "RTF": {
      const raw = await readFileAsText(file);
      const text = stripRtf(raw);
      return { text, format, needsOcr: false, fileSize };
    }

    case "JPG":
    case "PNG": {
      // Images need OCR — return empty text, caller handles OCR
      return { text: "", format, needsOcr: true, fileSize };
    }

    default:
      throw new Error(`Formato não suportado: ${format}`);
  }
}

/**
 * Convert an image file to a base64 data URL for OCR.
 */
export async function imageFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao converter imagem"));
    reader.readAsDataURL(file);
  });
}

export { renderPdfPagesToImages };
