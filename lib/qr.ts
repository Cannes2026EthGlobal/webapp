import QRCode from "qrcode";

export async function generateQrDataUrl(url: string, width = 256): Promise<string> {
  return QRCode.toDataURL(url, { width, margin: 2, color: { dark: "#2b2924", light: "#f5f1e8" } });
}
