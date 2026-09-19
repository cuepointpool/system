"use client";

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
  error: string | null;
  details: Record<string, unknown> | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    const data = (await res.json().catch(() => ({}))) as T & {
      error?: string;
      details?: Record<string, unknown>;
    };
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : (data.error ?? "Something went wrong."),
      details: data.details ?? null,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: "You appear to be offline. Try again when you're connected.",
      details: null,
    };
  }
}

export const apiGet = <T = Record<string, unknown>>(path: string) => call<T>(path);

export const apiPost = <T = Record<string, unknown>>(path: string, body: unknown = {}) =>
  call<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
