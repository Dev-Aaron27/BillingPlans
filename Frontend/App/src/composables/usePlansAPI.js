import { ref } from "vue";
import axios from "axios";
export function useAdminPlansAPI() {
    const loading = ref(false);
    const listPlans = async (page = 1, limit = 20, search = "") => {
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
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message ||
                err.response?.data?.error_message ||
                "Failed to load plans");
        }
        finally {
            loading.value = false;
        }
    };
    const getPlan = async (planId) => {
        loading.value = true;
        try {
            const res = await axios.get(`/api/admin/billingplans/plans/${planId}`);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load plan");
        }
        finally {
            loading.value = false;
        }
    };
    const getOptions = async () => {
        loading.value = true;
        try {
            const res = await axios.get("/api/admin/billingplans/options");
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load options");
        }
        finally {
            loading.value = false;
        }
    };
    const createPlan = async (data) => {
        loading.value = true;
        try {
            const res = await axios.post("/api/admin/billingplans/plans", data);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to create plan");
        }
        finally {
            loading.value = false;
        }
    };
    const updatePlan = async (planId, data) => {
        loading.value = true;
        try {
            const res = await axios.patch(`/api/admin/billingplans/plans/${planId}`, data);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to update plan");
        }
        finally {
            loading.value = false;
        }
    };
    const deletePlan = async (planId) => {
        loading.value = true;
        try {
            await axios.delete(`/api/admin/billingplans/plans/${planId}`);
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to delete plan");
        }
        finally {
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
    const listPlans = async () => {
        loading.value = true;
        try {
            const res = await axios.get("/api/user/billingplans/plans");
            return {
                data: res.data.data.data ?? [],
                user_credits: res.data.data.user_credits ?? 0,
            };
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load plans");
        }
        finally {
            loading.value = false;
        }
    };
    const subscribeToPlan = async (planId, options) => {
        loading.value = true;
        try {
            const body = {};
            if (options?.server_name)
                body.server_name = options.server_name;
            if (options?.chosen_realm_id)
                body.chosen_realm_id = options.chosen_realm_id;
            if (options?.chosen_spell_id)
                body.chosen_spell_id = options.chosen_spell_id;
            const res = await axios.post(`/api/user/billingplans/plans/${planId}/subscribe`, body);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to subscribe");
        }
        finally {
            loading.value = false;
        }
    };
    return { loading, listPlans, subscribeToPlan };
}
