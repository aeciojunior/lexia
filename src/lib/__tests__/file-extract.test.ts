import { describe, it, expect } from "vitest";
import { getSupportedFormats, getFormatFromFile } from "@/lib/file-extract";

describe("file-extract utilities", () => {
  describe("getSupportedFormats", () => {
    it("returns comma-separated file extensions", () => {
      const formats = getSupportedFormats();
      expect(formats).toContain(".pdf");
      expect(formats).toContain(".docx");
      expect(formats).toContain(".txt");
      expect(formats).toContain(".html");
      expect(formats).toContain(".rtf");
      expect(formats).toContain(".png");
      expect(formats).toContain(".jpg");
      expect(formats).toContain(".jpeg");
    });
  });

  describe("getFormatFromFile", () => {
    it("returns PDF for application/pdf", () => {
      const file = new File([""], "test.pdf", { type: "application/pdf" });
      expect(getFormatFromFile(file)).toBe("PDF");
    });

    it("returns DOCX for docx mime type", () => {
      const file = new File([""], "test.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      expect(getFormatFromFile(file)).toBe("DOCX");
    });

    it("returns TXT for text/plain", () => {
      const file = new File([""], "test.txt", { type: "text/plain" });
      expect(getFormatFromFile(file)).toBe("TXT");
    });

    it("returns HTML for text/html", () => {
      const file = new File([""], "test.html", { type: "text/html" });
      expect(getFormatFromFile(file)).toBe("HTML");
    });

    it("returns RTF for text/rtf", () => {
      const file = new File([""], "test.rtf", { type: "text/rtf" });
      expect(getFormatFromFile(file)).toBe("RTF");
    });

    it("returns JPG for image/jpeg", () => {
      const file = new File([""], "photo.jpg", { type: "image/jpeg" });
      expect(getFormatFromFile(file)).toBe("JPG");
    });

    it("returns PNG for image/png", () => {
      const file = new File([""], "photo.png", { type: "image/png" });
      expect(getFormatFromFile(file)).toBe("PNG");
    });

    it("falls back to file extension when mime type is unknown", () => {
      const file = new File([""], "data.csv", { type: "text/csv" });
      expect(getFormatFromFile(file)).toBe("CSV");
    });

    it("returns UNKNOWN for file with no extension and unknown type", () => {
      const file = new File([""], "noext", { type: "" });
      expect(getFormatFromFile(file)).toBe("NOEXT");
    });
  });
});
