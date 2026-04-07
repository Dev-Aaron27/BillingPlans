import { ref } from "vue";
import axios from "axios";
export const CATEGORY_COLORS = [
    { label: "Blue", value: "blue" },
    { label: "Emerald", value: "emerald" },
    { label: "Violet", value: "violet" },
    { label: "Orange", value: "orange" },
    { label: "Rose", value: "rose" },
    { label: "Amber", value: "amber" },
    { label: "Cyan", value: "cyan" },
    { label: "Pink", value: "pink" },
    { label: "Indigo", value: "indigo" },
    { label: "Lime", value: "lime" },
];
export function colorClasses(color, active = false) {
    const map = {
        blue: { base: "border-blue-500/30 text-blue-400 bg-blue-500/10", active: "border-blue-500 text-blue-300 bg-blue-500/25" },
        emerald: { base: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10", active: "border-emerald-500 text-emerald-300 bg-emerald-500/25" },
        violet: { base: "border-violet-500/30 text-violet-400 bg-violet-500/10", active: "border-violet-500 text-violet-300 bg-violet-500/25" },
        orange: { base: "border-orange-500/30 text-orange-400 bg-orange-500/10", active: "border-orange-500 text-orange-300 bg-orange-500/25" },
        rose: { base: "border-rose-500/30 text-rose-400 bg-rose-500/10", active: "border-rose-500 text-rose-300 bg-rose-500/25" },
        amber: { base: "border-amber-500/30 text-amber-400 bg-amber-500/10", active: "border-amber-500 text-amber-300 bg-amber-500/25" },
        cyan: { base: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10", active: "border-cyan-500 text-cyan-300 bg-cyan-500/25" },
        pink: { base: "border-pink-500/30 text-pink-400 bg-pink-500/10", active: "border-pink-500 text-pink-300 bg-pink-500/25" },
        indigo: { base: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10", active: "border-indigo-500 text-indigo-300 bg-indigo-500/25" },
        lime: { base: "border-lime-500/30 text-lime-400 bg-lime-500/10", active: "border-lime-500 text-lime-300 bg-lime-500/25" },
    };
    const entry = map[color ?? ""] ?? { base: "border-border text-muted-foreground bg-muted/30", active: "border-primary text-primary bg-primary/15" };
    return active ? entry.active : entry.base;
}
export function useAdminCategoriesAPI() {
    const loading = ref(false);
    const listCategories = async (page = 1, limit = 50, search = "") => {
        loading.value = true;
        try {
            const res = await axios.get("/api/admin/billingplans/categories", {
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
            throw new Error(err.response?.data?.message || "Failed to load categories");
        }
        finally {
            loading.value = false;
        }
    };
    const createCategory = async (data) => {
        loading.value = true;
        try {
            const res = await axios.post("/api/admin/billingplans/categories", data);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to create category");
        }
        finally {
            loading.value = false;
        }
    };
    const updateCategory = async (categoryId, data) => {
        loading.value = true;
        try {
            const res = await axios.patch(`/api/admin/billingplans/categories/${categoryId}`, data);
            return res.data.data;
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to update category");
        }
        finally {
            loading.value = false;
        }
    };
    const deleteCategory = async (categoryId) => {
        loading.value = true;
        try {
            await axios.delete(`/api/admin/billingplans/categories/${categoryId}`);
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to delete category");
        }
        finally {
            loading.value = false;
        }
    };
    return { loading, listCategories, createCategory, updateCategory, deleteCategory };
}
export function useUserCategoriesAPI() {
    const loading = ref(false);
    const listCategories = async () => {
        loading.value = true;
        try {
            const res = await axios.get("/api/user/billingplans/categories");
            return res.data.data ?? [];
        }
        catch (e) {
            const err = e;
            throw new Error(err.response?.data?.message || "Failed to load categories");
        }
        finally {
            loading.value = false;
        }
    };
    return { loading, listCategories };
}
