import { create } from "zustand";

export type UiStatus =
  | "idle"
  | "uploading"
  | "analysing"
  | "clarifying"
  | "generating"
  | "review"
  | "shared";

interface SessionUiState {
  status: UiStatus;
  sessionId: string | null;
  companyName: string;
  logoUrl: string | null;
  setStatus: (status: UiStatus) => void;
  setSessionId: (id: string | null) => void;
  setCompanyProfile: (profile: { companyName: string; logoUrl?: string | null }) => void;
}

export const useSessionUi = create<SessionUiState>((set) => ({
  status: "idle",
  sessionId: null,
  companyName: "Your Company",
  logoUrl: null,
  setStatus: (status) => set({ status }),
  setSessionId: (sessionId) => set({ sessionId }),
  setCompanyProfile: ({ companyName, logoUrl }) =>
    set({ companyName, logoUrl: logoUrl ?? null }),
}));
