import { Platform } from 'react-native';
import { SecureSession, SECURE_KEYS } from './secureStorage';
import { requireApiBaseUrl, runtimeConfig } from '@/config/runtime';

// Default endpoint for local testing: 10.0.2.2 for Android Emulator, localhost for iOS/web
const LOCAL_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080/api/v1' : 'http://localhost:8080/api/v1';
export const API_BASE_URL = runtimeConfig.apiBaseUrl || LOCAL_API_URL;

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total: number;
    limit: number;
    offset: number;
  };
}

export type ApiCurrentUser = {
  id: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  plan?: string;
  isPro?: boolean;
  status?: string;
  role?: string;
};

type ApiHouseholdMember = {
  user_id: string;
  full_name?: string;
  email?: string;
  role?: "admin" | "member";
};

type ApiHousehold = {
  id: string;
  name: string;
  invite_code: string;
  currency?: string;
  created_by: string;
  created_at?: string;
  members?: ApiHouseholdMember[];
};

class BackendClient {
  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const token = await SecureSession.getItem(SECURE_KEYS.AUTH_TOKEN);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const baseUrl = runtimeConfig.dataBackend === 'api' ? requireApiBaseUrl() : API_BASE_URL;
    const url = `${baseUrl}${endpoint}`;
    const headers = await this.getHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string>),
        },
      });

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (error: any) {
      console.warn(`[WhisperLedger API] Request to ${endpoint} failed:`, error?.message);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error?.message || 'Failed to connect to WhisperLedger server',
        },
      };
    }
  }

  // --- Auth APIs ---
  async login(email: string, password: string) {
    const res = await this.request<{ user: any; tokens: { access_token: string; refresh_token: string } }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    if (res.success && res.data?.tokens?.access_token) {
      await SecureSession.setItem(SECURE_KEYS.AUTH_TOKEN, res.data.tokens.access_token);
	      await SecureSession.setItem(SECURE_KEYS.REFRESH_TOKEN, res.data.tokens.refresh_token);
    }
    return res;
  }

  async loginWithGoogle(idToken: string) {
    const res = await this.request<{ user: any; tokens: { access_token: string; refresh_token: string } }>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      }
    );
    if (res.success && res.data?.tokens?.access_token) {
      await SecureSession.setItem(SECURE_KEYS.AUTH_TOKEN, res.data.tokens.access_token);
      await SecureSession.setItem(SECURE_KEYS.REFRESH_TOKEN, res.data.tokens.refresh_token);
    }
    return res;
  }

  async register(email: string, password: string, fullName: string, phoneNumber?: string) {
    const res = await this.request<{ user: any; tokens: { access_token: string; refresh_token: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName, phone_number: phoneNumber }),
      }
    );
    if (res.success && res.data?.tokens?.access_token) {
      await SecureSession.setItem(SECURE_KEYS.AUTH_TOKEN, res.data.tokens.access_token);
	      await SecureSession.setItem(SECURE_KEYS.REFRESH_TOKEN, res.data.tokens.refresh_token);
    }
    return res;
  }

  async getMe() {
    return this.request<ApiCurrentUser & { user?: ApiCurrentUser }>('/auth/me');
  }

  async updateProfile(fullName?: string, avatarUrl?: string) {
    return this.request<ApiCurrentUser>("/auth/me", {
      method: "PUT",
      body: JSON.stringify({ full_name: fullName, avatar_url: avatarUrl }),
    });
  }

  async updatePushToken(pushToken: string) {
    return this.request('/auth/push-token', {
      method: 'PUT',
      body: JSON.stringify({ push_token: pushToken }),
    });
  }

  async createSupportCase(subject: string, message: string) {
    return this.request<{ id: string; status: string }>("/users/support-cases", {
      method: "POST",
      body: JSON.stringify({ subject, message }),
    });
  }

  // --- 3-Way Outflow Ledger APIs ---
  async createExpense(expense: {
    amount: number;
    category: string;
    merchant: string;
    outflow_type: 'true_personal' | 'shared_household' | 'recoverable';
    payment_method?: string;
    note?: string;
    date?: string;
    household_id?: string;
    splits?: Array<{ user_id: string; amount: number }>;
  }) {
    return this.request<{ id: string }>('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async updateExpense(id: string, expense: {
    amount: number;
    category: string;
    merchant: string;
    outflow_type: 'true_personal' | 'shared_household' | 'recoverable';
    payment_method?: string;
    note?: string;
    date?: string;
    household_id?: string;
  }) {
    return this.request<{ id: string }>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(expense),
    });
  }

  async deleteExpense(id: string) {
    return this.request(`/expenses/${id}`, { method: 'DELETE' });
  }

  async listExpenses(params?: { limit?: number; offset?: number; outflow_type?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.outflow_type) query.set('outflow_type', params.outflow_type);
    return this.request<Array<{ id: string; [key: string]: unknown }>>(`/expenses?${query.toString()}`);
  }

  async getSummary(startDate?: string, endDate?: string) {
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    return this.request(`/expenses/summary?${query.toString()}`);
  }

  // --- Household & Minimum-Cash-Flow APIs ---
  async createHousehold(name: string, currency: string = 'INR') {
    return this.request<ApiHousehold>('/households', {
      method: 'POST',
      body: JSON.stringify({ name, currency }),
    });
  }

  async joinHousehold(inviteCode: string) {
    return this.request<ApiHousehold>('/households/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode }),
    });
  }

  async getHouseholdMe() {
    return this.request<ApiHousehold>('/households/me');
  }

  async getHouseholdBalances(householdId: string) {
    return this.request(`/households/${householdId}/balances`);
  }

  async getOptimalSettlements(householdId: string) {
    return this.request(`/households/${householdId}/settlements`);
  }

  async settleHouseholdDebt(householdId: string, fromUserId: string, toUserId: string, amount: number) {
    return this.request(`/households/${householdId}/settle`, {
      method: 'POST',
      body: JSON.stringify({ from_user_id: fromUserId, to_user_id: toUserId, amount }),
    });
  }

  // --- Money Recovery Engine APIs ---
  async createReceivable(receivable: {
    title: string;
    debtor_name: string;
    debtor_phone?: string;
    amount: number;
    type: string;
    due_date?: string;
    notes?: string;
  }) {
    return this.request('/recovery', {
      method: 'POST',
      body: JSON.stringify(receivable),
    });
  }

  async listReceivables(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/recovery${query}`);
  }

  async settleReceivable(id: string, amount: number) {
    return this.request(`/recovery/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // --- Money Leak Detective & Autopilot APIs ---
  async getLeaks() {
    return this.request('/detective/leaks');
  }

  async getSafeToSpend(budget?: number) {
    const query = budget ? `?budget=${budget}` : '';
    return this.request(`/detective/safe-to-spend${query}`);
  }

  async getHouseholdAudit(month?: number, year?: number) {
    const query = new URLSearchParams();
    if (month) query.set('month', String(month));
    if (year) query.set('year', String(year));
    return this.request(`/detective/household-audit?${query.toString()}`);
  }

  // --- Admin & Cloud Telemetry APIs ---
  async getPlatformMetrics() {
    return this.request<{
      total_users: number;
      total_households: number;
      total_expenses_tracked: number;
      total_volume_tracked: number;
      total_receivables_pending: number;
      active_users_7_days: number;
      generated_at: string;
    }>('/admin/metrics');
  }

  async getCloudTelemetry() {
    return this.request<{
      service: string;
      region: string;
      revision: string;
      environment: string;
      status: string;
      uptime_seconds: number;
      go_version: string;
      memory_alloc_mb: number;
      memory_sys_mb: number;
      db_pool_total: number;
      db_pool_idle: number;
      db_pool_acquired: number;
      daily_volumes: Array<{ date: string; amount: number; count: number }>;
      recent_logs: Array<{ timestamp: string; level: string; message: string; source: string }>;
      gcp_console_links: Record<string, string>;
    }>('/admin/telemetry');
  }
}

export const api = new BackendClient();

