import { apiClient } from "@/lib/api";

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      "/auth/login/",
      data
    );

    // guardar tokens
    localStorage.setItem("accessToken", response.access);
    localStorage.setItem("refreshToken", response.refresh);

    return response;
  },

  async register(data: RegisterRequest) {
    return apiClient.post("/auth/register/register/", data);
  },

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
};