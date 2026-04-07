import { ref } from "vue";
import axios from "axios";
export function useSettingsAPI() {
    const loading = ref(false);
    const getSettings = async () => {
        loading.value = true;
        try {
            const res = await axios.get("/api/admin/billingplans/settings");
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load settings");
        }
        finally {
            loading.value = false;
        }
    };
    const updateSettings = async (data) => {
        loading.value = true;
        try {
            const res = await axios.patch("/api/admin/billingplans/settings", data);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to update settings");
        }
        finally {
            loading.value = false;
        }
    };
    return { loading, getSettings, updateSettings };
}
