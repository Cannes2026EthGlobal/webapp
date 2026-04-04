"use client";

import { useState, useEffect, useCallback } from "react";

type PaymentStatusState = {
  status: "requires_action" | "processing" | "succeeded" | "failed" | "expired" | "cancelled" | null;
  isFinal: boolean;
  isLoading: boolean;
  error: string | null;
};

export function usePaymentStatus(paymentId: string | null): PaymentStatusState {
  const [state, setState] = useState<PaymentStatusState>({
    status: null,
    isFinal: false,
    isLoading: false,
    error: null,
  });

  const poll = useCallback(async () => {
    if (!paymentId) return null;
    setState((s) => ({ ...s, isLoading: true }));

    const res = await fetch(`/api/wcpay/payments/${paymentId}/status`);
    if (!res.ok) {
      setState((s) => ({ ...s, isLoading: false, error: `Poll failed: ${res.status}` }));
      return null;
    }

    const data = await res.json();
    setState({ status: data.status, isFinal: data.isFinal, isLoading: false, error: null });
    return data;
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function loop() {
      const data = await poll();
      if (cancelled || !data) return;
      if (!data.isFinal) {
        timeoutId = setTimeout(loop, data.pollInMs ?? 3000);
      }
    }

    loop();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [paymentId, poll]);

  return state;
}
