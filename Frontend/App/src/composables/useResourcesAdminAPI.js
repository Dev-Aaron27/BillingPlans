import { ref } from "vue";
import axios from "axios";
export function useResourcesAdminAPI() {
    const loading = ref(false);
    const handleError = (error) => {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return (axiosError.response?.data?.error_message ||
                axiosError.message ||
                "An error occurred");
        }
        return error instanceof Error ? error.message : "An unknown error occurred";
    };
    const getUsers = async (page = 1, limit = 20, search = "") => {
        loading.value = true;
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });
            if (search) {
                params.append("search", search);
            }
            const response = await axios.get(`/api/admin/billingresources/users?${params.toString()}`);
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    const getUserResources = async (userId) => {
        loading.value = true;
        try {
            const response = await axios.get(`/api/admin/billingresources/users/${userId}/resources`);
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    const updateUserResources = async (userId, data) => {
        loading.value = true;
        try {
            const response = await axios.patch(`/api/admin/billingresources/users/${userId}/resources`, data);
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    const searchUsers = async (query, limit = 20) => {
        loading.value = true;
        try {
            const params = new URLSearchParams({
                query,
                limit: limit.toString(),
            });
            const response = await axios.get(`/api/admin/billingresources/users/search?${params.toString()}`);
            if (response.data &&
                response.data.success &&
                response.data.data &&
                Array.isArray(response.data.data.data)) {
                return response.data.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    const getStatistics = async () => {
        loading.value = true;
        try {
            const response = await axios.get(`/api/admin/billingresources/statistics`);
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    const getSettings = async () => {
        loading.value = true;
        try {
            const response = await axios.get(`/api/admin/billingresources/settings`);
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    const updateSettings = async (data) => {
        loading.value = true;
        try {
            const response = await axios.patch(`/api/admin/billingresources/settings`, data);
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }
            throw new Error(response.data?.error_message || "Invalid response format");
        }
        catch (error) {
            throw new Error(handleError(error));
        }
        finally {
            loading.value = false;
        }
    };
    return {
        loading,
        getUsers,
        getUserResources,
        updateUserResources,
        searchUsers,
        getStatistics,
        getSettings,
        updateSettings,
    };
}
