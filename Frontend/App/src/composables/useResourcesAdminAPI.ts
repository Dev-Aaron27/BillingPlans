import { ref } from "vue";
import axios from "axios";
import type { AxiosError } from "axios";

export interface UserResource {
  id: number;
  user_id: number;
  username: string;
  email: string;
  uuid: string;
  memory_limit: number;
  cpu_limit: number;
  disk_limit: number;
  server_limit: number;
  database_limit: number;
  backup_limit: number;
  allocation_limit: number;
  first_seen?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: boolean;
  error_message?: string;
  error_code?: string;
}

export interface UserResourcesResponse {
  data: UserResource[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}

export interface UserResourcesDetail {
  user_id: number;
  username: string;
  email: string;
  uuid: string;
  resources: {
    id: number | null;
    user_id: number | null;
    memory_limit: number;
    cpu_limit: number;
    disk_limit: number;
    server_limit: number;
    database_limit: number;
    backup_limit: number;
    allocation_limit: number;
  };
}

export interface ResourceStatistics {
  users: {
    total: number;
    with_resources: number;
    without_resources: number;
  };
  totals: {
    memory_limit: number;
    cpu_limit: number;
    disk_limit: number;
    server_limit: number;
    database_limit: number;
    backup_limit: number;
    allocation_limit: number;
  };
  averages: {
    memory_limit: number;
    cpu_limit: number;
    disk_limit: number;
    server_limit: number;
    database_limit: number;
    backup_limit: number;
    allocation_limit: number;
  };
}

export interface ResourceSettings {
  default_resources: {
    memory_limit: number;
    cpu_limit: number;
    disk_limit: number;
    server_limit: number;
    database_limit: number;
    backup_limit: number;
    allocation_limit: number;
  };
  max_resources: {
    memory_limit: number;
    cpu_limit: number;
    disk_limit: number;
    server_limit: number;
    database_limit: number;
    backup_limit: number;
    allocation_limit: number;
  };
}

export interface UpdateResourcesData {
  memory_limit?: number;
  cpu_limit?: number;
  disk_limit?: number;
  server_limit?: number;
  database_limit?: number;
  backup_limit?: number;
  allocation_limit?: number;
}

export function useResourcesAdminAPI() {
  const loading = ref(false);

  const handleError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error_message?: string }>;
      return (
        axiosError.response?.data?.error_message ||
        axiosError.message ||
        "An error occurred"
      );
    }
    return error instanceof Error ? error.message : "An unknown error occurred";
  };

  const getUsers = async (
    page: number = 1,
    limit: number = 20,
    search: string = ""
  ): Promise<UserResourcesResponse> => {
    loading.value = true;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.append("search", search);
      }

      const response = await axios.get<ApiResponse<UserResourcesResponse>>(
        `/api/admin/billingresources/users?${params.toString()}`
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
      loading.value = false;
    }
  };

  const getUserResources = async (
    userId: number
  ): Promise<UserResourcesDetail> => {
    loading.value = true;
    try {
      const response = await axios.get<ApiResponse<UserResourcesDetail>>(
        `/api/admin/billingresources/users/${userId}/resources`
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
      loading.value = false;
    }
  };

  const updateUserResources = async (
    userId: number,
    data: UpdateResourcesData
  ): Promise<UserResourcesDetail> => {
    loading.value = true;
    try {
      const response = await axios.patch<ApiResponse<UserResourcesDetail>>(
        `/api/admin/billingresources/users/${userId}/resources`,
        data
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
      loading.value = false;
    }
  };

  const searchUsers = async (
    query: string,
    limit: number = 20
  ): Promise<UserResource[]> => {
    loading.value = true;
    try {
      const params = new URLSearchParams({
        query,
        limit: limit.toString(),
      });

      const response = await axios.get<
        ApiResponse<{ data: UserResource[]; count: number }>
      >(`/api/admin/billingresources/users/search?${params.toString()}`);

      if (
        response.data &&
        response.data.success &&
        response.data.data &&
        Array.isArray(response.data.data.data)
      ) {
        return response.data.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
      loading.value = false;
    }
  };

  const getStatistics = async (): Promise<ResourceStatistics> => {
    loading.value = true;
    try {
      const response = await axios.get<ApiResponse<ResourceStatistics>>(
        `/api/admin/billingresources/statistics`
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
      loading.value = false;
    }
  };

  const getSettings = async (): Promise<ResourceSettings> => {
    loading.value = true;
    try {
      const response = await axios.get<ApiResponse<ResourceSettings>>(
        `/api/admin/billingresources/settings`
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
      loading.value = false;
    }
  };

  const updateSettings = async (
    data: Partial<ResourceSettings>
  ): Promise<ResourceSettings> => {
    loading.value = true;
    try {
      const response = await axios.patch<ApiResponse<ResourceSettings>>(
        `/api/admin/billingresources/settings`,
        data
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data?.error_message || "Invalid response format"
      );
    } catch (error) {
      throw new Error(handleError(error));
    } finally {
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
