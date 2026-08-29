import api from "./api";
import { ApiResponse } from "@/types";

export interface AdminSearchItem {
  id: string;
  title: string;
  subtitle: string;
  meta: Record<string, string | boolean | null>;
}

export interface AdminSearchResult {
  query: string;
  groups: {
    requests: AdminSearchItem[];
    machines: AdminSearchItem[];
    complaints: AdminSearchItem[];
    users: AdminSearchItem[];
  };
}

export const adminSearchService = {
  async search(q: string): Promise<AdminSearchResult> {
    const response = await api.get<ApiResponse<AdminSearchResult>>(
      "/admin-search",
      { params: { q, limit: 5 } },
    );
    return response.data.data;
  },
};
