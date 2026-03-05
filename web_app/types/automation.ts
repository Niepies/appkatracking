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

export interface RunAutomationPayload {
  subscription_id: string;
  service_key: string;
  action: AutomationAction;
  email: string;
  password: string;
}

/** Konfiguracja klienta API automatyzacji */
export interface AutomationClientConfig {
  base_url: string;
  api_key: string;
}
