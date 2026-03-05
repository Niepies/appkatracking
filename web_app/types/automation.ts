// Typy TypeScript dla modułu automatyzacji

export type AutomationAction = "cancel" | "resume";

export type JobStatus =
  | "pending"
  | "running"
  | "waiting_for_user"
  | "completed"
  | "failed";

export interface AutomationJobResponse {
  job_id: string;
  status: JobStatus;
  message: string;
  screenshot_url?: string | null;
  result?: string | null;
  error?: string | null;
}

export interface CredentialStatusResponse {
  service_key: string;
  has_credentials: boolean;
}

export interface SaveCredentialPayload {
  service_key: string;
  email: string;
  password: string;
}

export interface RunAutomationPayload {
  subscription_id: string;
  service_key: string;
  action: AutomationAction;
}

export interface CheckPaymentPayload {
  subscription_id: string;
  service_key: string;
  expected_amount: number;
  expected_date: string; // yyyy-MM-dd
}

export interface CheckPaymentResult {
  subscription_id: string;
  payment_found: boolean;
  payment_date?: string | null;
  amount_found?: number | null;
  message: string;
}

/** Konfiguracja klienta API automatyzacji */
export interface AutomationClientConfig {
  base_url: string;
  api_key: string;
}
