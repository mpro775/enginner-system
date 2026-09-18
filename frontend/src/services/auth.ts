import api from './api';
import {
  ApiResponse,
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  PasswordResetChallenge,
  PasswordResetVerification,
  User,
} from '@/types';

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/refresh', {
      refreshToken,
    });
    return response.data.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/change-password', data);
  },

  async requestPasswordReset(email: string): Promise<PasswordResetChallenge> {
    const response = await api.post<ApiResponse<PasswordResetChallenge>>(
      '/auth/password/forgot',
      { email },
    );
    return response.data.data;
  },

  async verifyPasswordResetOtp(
    challengeId: string,
    otp: string,
  ): Promise<PasswordResetVerification> {
    const response = await api.post<ApiResponse<PasswordResetVerification>>(
      '/auth/password/verify-otp',
      { challengeId, otp },
    );
    return response.data.data;
  },

  async resendPasswordResetOtp(
    challengeId: string,
  ): Promise<PasswordResetChallenge> {
    const response = await api.post<ApiResponse<PasswordResetChallenge>>(
      '/auth/password/resend-otp',
      { challengeId },
    );
    return response.data.data;
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    await api.post('/auth/password/reset', { resetToken, newPassword });
  },
};






