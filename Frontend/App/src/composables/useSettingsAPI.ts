import { ref } from "vue";
import axios from "axios";
import type { AxiosError } from "axios";

export interface BillingPlanSettings {
  suspend_servers: boolean;
  unsuspend_on_renewal: boolean;
  grace_period_days: number;
  termination_days: number;
  send_suspension_email: boolean;
  send_termination_email: boolean;
  allow_user_cancellation: boolean;
  generate_invoices: boolean;
}

export function useSettingsAPI() {
  const loading = ref(false);

  const getSettings = async (): Promise<BillingPlanSettings> => {
    loading.value = true;
    try {
      const res = await axios.get("/api/admin/billingplans/settings");
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to load settings");
    } finally {
      loading.value = false;
    }
  };

  const updateSettings = async (
    data: Partial<BillingPlanSettings>
  ): Promise<BillingPlanSettings> => {
    loading.value = true;
    try {
      const res = await axios.patch("/api/admin/billingplans/settings", data);
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(
        err.response?.data?.message || "Failed to update settings"
      );
    } finally {
      loading.value = false;
    }
  };

  return { loading, getSettings, updateSettings };
}
