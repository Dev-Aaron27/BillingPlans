import { ref } from "vue";
import axios from "axios";
export function useAdminSubscriptionsAPI() {
    const loading = ref(false);
    const listSubscriptions = async (page = 1, limit = 20, status = "", search = "") => {
        loading.value = true;
        try {
            const res = await axios.get("/api/admin/billingplans/subscriptions", {
                params: { page, limit, status, search },
            });
            return {
                data: res.data.data.data ?? [],
                total: res.data.data.meta?.pagination?.total ?? 0,
                total_pages: res.data.data.meta?.pagination?.total_pages ?? 1,
                status_counts: res.data.data.meta?.status_counts ?? {},
            };
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load subscriptions");
        }
        finally {
            loading.value = false;
        }
    };
    const getStats = async () => {
        loading.value = true;
        try {
            const res = await axios.get("/api/admin/billingplans/stats");
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load stats");
        }
        finally {
            loading.value = false;
        }
    };
    const updateSubscription = async (subscriptionId, data) => {
        loading.value = true;
        try {
            const res = await axios.patch(`/api/admin/billingplans/subscriptions/${subscriptionId}`, data);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to update subscription");
        }
        finally {
            loading.value = false;
        }
    };
    const cancelSubscription = async (subscriptionId) => {
        loading.value = true;
        try {
            await axios.delete(`/api/admin/billingplans/subscriptions/${subscriptionId}`);
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to cancel subscription");
        }
        finally {
            loading.value = false;
        }
    };
    const refundSubscription = async (subscriptionId, amount) => {
        loading.value = true;
        try {
            const res = await axios.post(`/api/admin/billingplans/subscriptions/${subscriptionId}/refund`, { amount });
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to refund credits");
        }
        finally {
            loading.value = false;
        }
    };
    return {
        loading,
        listSubscriptions,
        getStats,
        updateSubscription,
        cancelSubscription,
        refundSubscription,
    };
}
export function useUserSubscriptionsAPI() {
    const loading = ref(false);
    const listSubscriptions = async () => {
        loading.value = true;
        try {
            const res = await axios.get("/api/user/billingplans/subscriptions");
            return {
                data: res.data.data.data ?? [],
                user_credits: res.data.data.user_credits ?? 0,
            };
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load subscriptions");
        }
        finally {
            loading.value = false;
        }
    };
    const cancelSubscription = async (subscriptionId) => {
        loading.value = true;
        try {
            await axios.delete(`/api/user/billingplans/subscriptions/${subscriptionId}`);
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to cancel subscription");
        }
        finally {
            loading.value = false;
        }
    };
    return { loading, listSubscriptions, cancelSubscription };
}
