import { ref } from "vue";
import axios from "axios";
import type { AxiosError } from "axios";

export interface Plan {
  id: number;
  category_id: number | null;
  category?: { id: number; name: string; icon: string | null; color: string | null } | null;
  name: string;
  description: string | null;
  long_description: string | null;
  price_credits: number;
  billing_period_days: number;
  billing_period_label: string;
  is_active: number;
  server_config?: Record<string, unknown> | null;
  max_subscriptions: number | null;
  active_subscription_count?: number;
  slots_available?: number | null;
  is_sold_out?: boolean;

  node_ids?: number[]; // multi-node support
  node_id?: number | null; // legacy
  realms_id: number | null;
  spell_id: number | null;
  memory: number;
  cpu: number;
  disk: number;
  swap: number;
  io: number;
  backup_limit: number;
  database_limit: number;
  allocation_limit: number | null;
  startup_override: string | null;
  image_override: string | null;

  user_can_choose_realm: boolean;
  user_can_choose_spell: boolean;
  allowed_realms: number[];
  allowed_spells: number[];

  allowed_realms_options?: { id: number; name: string }[];
  allowed_spells_options?: { id: number; name: string; realm_id: number }[];
  has_server_template?: boolean;
  can_afford?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanFormData {
  category_id: number | null;
  name: string;
  description: string | null;
  long_description: string | null;
  price_credits: number;
  billing_period_days: number;
  is_active: boolean;
  max_subscriptions: number | null;

  node_ids: number[]; // multi-node support
  realms_id: number | null;
  spell_id: number | null;
  memory: number;
  cpu: number;
  disk: number;
  swap: number;
  io: number;
  backup_limit: number;
  database_limit: number;
  allocation_limit: number | null;
  startup_override: string | null;
  image_override: string | null;

  user_can_choose_realm: boolean;
  user_can_choose_spell: boolean;
  allowed_realms: number[];
  allowed_spells: number[];
}

export interface PlanOption {
  id: number;
  name: string;
  realm_id?: number | null;
  location_id?: number | null;
  startup?: string | null;
  docker_image?: string | null;
}

export interface PlanOptions {
  nodes: PlanOption[];
  realms: PlanOption[];
  spells: PlanOption[];
  categories: Array<{ id: number; name: string; icon: string | null; color: string | null; is_active: boolean }>;
}

export function useAdminPlansAPI() {
  const loading = ref(false);

  const listPlans = async (
    page = 1,
    limit = 20,
    search = ""
  ): Promise<{ data: Plan[]; total: number; total_pages: number }> => {
    loading.value = true;
    try {
      const res = await axios.get("/api/admin/billingplans/plans", {
        params: { page, limit, search },
      });
      return {
        data: res.data.data.data ?? [],
        total: res.data.data.meta?.pagination?.total ?? 0,
        total_pages: res.data.data.meta?.pagination?.total_pages ?? 1,
      };
    } catch (e) {
      const err = e as AxiosError<{ message?: string; error_message?: string }>;
      throw new Error(
        err.response?.data?.message ||
          err.response?.data?.error_message ||
          "Failed to load plans"
      );
    } finally {
      loading.value = false;
    }
  };

  const getPlan = async (planId: number): Promise<Plan> => {
    loading.value = true;
    try {
      const res = await axios.get(`/api/admin/billingplans/plans/${planId}`);
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to load plan");
    } finally {
      loading.value = false;
    }
  };

  const getOptions = async (): Promise<PlanOptions> => {
    loading.value = true;
    try {
      const res = await axios.get("/api/admin/billingplans/options");
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(
        err.response?.data?.message || "Failed to load options"
      );
    } finally {
      loading.value = false;
    }
  };

  const createPlan = async (data: PlanFormData): Promise<Plan> => {
    loading.value = true;
    try {
      const res = await axios.post("/api/admin/billingplans/plans", data);
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to create plan");
    } finally {
      loading.value = false;
    }
  };

  const updatePlan = async (
    planId: number,
    data: Partial<PlanFormData>
  ): Promise<Plan> => {
    loading.value = true;
    try {
      const res = await axios.patch(
        `/api/admin/billingplans/plans/${planId}`,
        data
      );
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to update plan");
    } finally {
      loading.value = false;
    }
  };

  const deletePlan = async (planId: number): Promise<void> => {
    loading.value = true;
    try {
      await axios.delete(`/api/admin/billingplans/plans/${planId}`);
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to delete plan");
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    listPlans,
    getPlan,
    getOptions,
    createPlan,
    updatePlan,
    deletePlan,
  };
}

export function useUserPlansAPI() {
  const loading = ref(false);

  const listPlans = async (): Promise<{
    data: Plan[];
    user_credits: number;
  }> => {
    loading.value = true;
    try {
      const res = await axios.get("/api/user/billingplans/plans");
      return {
        data: res.data.data.data ?? [],
        user_credits: res.data.data.user_credits ?? 0,
      };
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to load plans");
    } finally {
      loading.value = false;
    }
  };

  const subscribeToPlan = async (
    planId: number,
    options?: {
      server_name?: string;
      chosen_realm_id?: number | null;
      chosen_spell_id?: number | null;
    }
  ): Promise<{
    subscription: Record<string, unknown>;
    credits_deducted: number;
    new_credits_balance: number;
    next_renewal_at: string;
    server_uuid: string | null;
  }> => {
    loading.value = true;
    try {
      const body: Record<string, unknown> = {};
      if (options?.server_name) body.server_name = options.server_name;
      if (options?.chosen_realm_id) body.chosen_realm_id = options.chosen_realm_id;
      if (options?.chosen_spell_id) body.chosen_spell_id = options.chosen_spell_id;
      const res = await axios.post(
        `/api/user/billingplans/plans/${planId}/subscribe`,
        body
      );
      return res.data.data;
    } catch (e) {
      const err = e as AxiosError<{ message?: string }>;
      throw new Error(err.response?.data?.message || "Failed to subscribe");
    } finally {
      loading.value = false;
    }
  };

  return { loading, listPlans, subscribeToPlan };
}
