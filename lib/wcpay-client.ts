const API_URL = process.env.WC_PAY_API_URL ?? "https://api.pay.walletconnect.com";
const API_KEY = process.env.WC_PAY_API_KEY ?? "";
const MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID ?? "";
const IS_MOCK = process.env.WC_PAY_MOCK === "true";

function headers(): HeadersInit {
  return {
    "Api-Key": API_KEY,
    "Merchant-Id": MERCHANT_ID,
    "Content-Type": "application/json",
  };
}

export type CreatePaymentResponse = {
  paymentId: string;
  gatewayUrl: string;
  expiresAt: number | null;
};

export type PaymentStatus = {
  status:
    | "requires_action"
    | "processing"
    | "succeeded"
    | "failed"
    | "expired"
    | "cancelled";
  isFinal: boolean;
  pollInMs: number;
};

export type PaymentRecord = {
  paymentId: string;
  referenceId: string;
  status: string;
  isTerminal: boolean;
  fiatAmount: {
    value: string;
    unit: string;
    display: { formatted: string; assetSymbol: string };
  };
  tokenAmount?: {
    value: string;
    unit: string;
    display: { formatted: string; assetSymbol: string; decimals: number; networkName: string };
  };
  buyer?: { accountCaip10: string; accountProviderName: string; accountProviderIcon: string };
  transaction?: { networkId: string; hash: string; nonce: number };
  settlement?: { status: string; txHash: string };
  fees?: { total: string; fixed: string; percentage: string };
  createdAt: string;
  lastUpdatedAt: string;
  settledAt?: string;
};

export type ListPaymentsResponse = {
  data: PaymentRecord[];
  nextCursor: string | null;
};

// ─── Real implementations ───

async function realCreatePayment(referenceId: string, amountCents: number, currency: "USD" | "EUR" = "USD"): Promise<CreatePaymentResponse> {
  const res = await fetch(`${API_URL}/v1/merchants/payment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ referenceId, amount: { value: String(amountCents), unit: `iso4217/${currency}` } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WC Pay createPayment failed: ${res.status} ${(err as { message?: string }).message ?? ""}`);
  }
  return res.json();
}

async function realGetPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  const res = await fetch(`${API_URL}/v1/merchants/payment/${paymentId}/status`, { method: "GET", headers: headers() });
  if (!res.ok) throw new Error(`WC Pay getPaymentStatus failed: ${res.status}`);
  return res.json();
}

async function realCancelPayment(paymentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/payments/${paymentId}/cancel`, { method: "POST", headers: headers(), body: "{}" });
  if (!res.ok) throw new Error(`WC Pay cancelPayment failed: ${res.status}`);
}

// ─── Mock implementations ───

let mockCounter = 0;

function mockCreatePayment(referenceId: string, _amountCents: number, _currency: "USD" | "EUR"): CreatePaymentResponse {
  mockCounter++;
  const id = `pay_mock_${Date.now()}_${mockCounter}`;
  return { paymentId: id, gatewayUrl: `https://pay.walletconnect.com/?pid=${id}&mock=true`, expiresAt: Math.floor(Date.now() / 1000) + 3600 };
}

function mockGetPaymentStatus(): PaymentStatus {
  return { status: "succeeded", isFinal: true, pollInMs: 0 };
}

// ─── Exports ───

export const createPayment = IS_MOCK
  ? (ref: string, cents: number, cur: "USD" | "EUR" = "USD") => Promise.resolve(mockCreatePayment(ref, cents, cur))
  : realCreatePayment;

export const getPaymentStatus = IS_MOCK
  ? (_id: string) => Promise.resolve(mockGetPaymentStatus())
  : realGetPaymentStatus;

export const cancelPayment = IS_MOCK
  ? (_id: string) => Promise.resolve()
  : realCancelPayment;

export const isMockMode = IS_MOCK;

export function parseReferenceId(referenceId: string): { companyId: string; paymentId: string } | null {
  const match = referenceId.match(/^arc::(.+?)::(.+)$/);
  if (!match) return null;
  return { companyId: match[1], paymentId: match[2] };
}
