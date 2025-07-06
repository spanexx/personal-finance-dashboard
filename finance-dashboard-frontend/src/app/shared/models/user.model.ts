// Backend-aligned interfaces for PROMPT 2.2
export interface UserSettings {
  currency: string;
  dateFormat: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notificationPreferences: {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    goalReminders: boolean;
    weeklyReports: boolean;
    monthlyReports: boolean;
  };
  privacy: {
    marketingEmails: boolean;
    analyticsTracking: boolean;
    dataExportRequested: boolean;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  profileImage?: string;
  isVerified: boolean;
  isEmailVerified: boolean;
  emailVerified?: boolean; // Alias for compatibility
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
  profileCompleteness: {
    percentage: number;
    missingFields: string[];
    suggestions: string[];
  };
  settings: UserSettings;
}

export interface UserSession {
  id: number; // Array index used as session ID
  deviceName?: string;
  deviceType?: string;
  location?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
  isCurrent?: boolean; // Alias for compatibility
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordStrengthResult {
  score: number; // 0-4
  feedback: {
    warning: string;
    suggestions: string[];
  };
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
}

// Legacy interfaces for backward compatibility
export interface ProfileSettings {
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  theme: 'light' | 'dark' | 'auto';
  enableAnimations: boolean;
  showWelcomeMessage: boolean;
  compactView: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  budgetAlerts: boolean;
  transactionAlerts: boolean;
  goalAlerts: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  overdraftAlerts: boolean;
  billReminders: boolean;
}

export interface EmailPreferences {
  marketing: boolean;
  security: boolean;
  updates: boolean;
  newsletters: boolean;
  promotional: boolean;
}

export interface ProfileImage {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
}

export interface User {
  id: string;
  email: string;
  password?: string; // Usually excluded in API responses
  firstName: string;
  lastName: string;
  username?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  profileSettings: ProfileSettings;
  notificationPreferences: NotificationPreferences;
  emailPreferences: EmailPreferences;
  isEmailVerified: boolean;
  isVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  isPhoneVerified: boolean;
  phoneVerificationToken?: string;
  phoneVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  profileImage?: ProfileImage;
  lastLogin?: Date;
  lastActivity?: Date;
  isActive: boolean;
  accountType: 'free' | 'premium' | 'business';
  subscriptionExpires?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes?: string[];
  sessions?: Array<{
    sessionId: string;
    device: string;
    location: string;
    lastAccess: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  profileSettings?: Partial<ProfileSettings>;
  notificationPreferences?: Partial<NotificationPreferences>;
  emailPreferences?: Partial<EmailPreferences>;
  accountType?: 'free' | 'premium' | 'business';
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  profileSettings?: Partial<ProfileSettings>;
  notificationPreferences?: Partial<NotificationPreferences>;
  emailPreferences?: Partial<EmailPreferences>;
  accountType?: 'free' | 'premium' | 'business';
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  clientInfo?: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

import { ApiResponse } from '../../core/models/api-response.models';

export interface AuthData {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string | number; // Can be "15m" or number in seconds
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: string | number; // Can be "15m" or number in seconds
  sessionId: string;
}

export interface LoginResponse extends ApiResponse<AuthData> {}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
}

export interface RegisterResponse extends ApiResponse<AuthData> {}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

// GDPR and Privacy Interfaces
export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'contacts';
  dataSharing: {
    analytics: boolean;
    marketing: boolean;
    thirdParty: boolean;
  };
  cookies: {
    essential: boolean;
    functional: boolean;
    analytics: boolean;
    advertising: boolean;
  };
  dataRetention: {
    autoDelete: boolean;
    retentionPeriod: number; // days
  };
  contactPreferences: {
    allowContact: boolean;
  };
  lastUpdated?: Date;
}

export interface DataExportRequest {
  categories: string[];
  format: 'json' | 'csv' | 'pdf';
  email?: string;
  includePersonalData?: boolean;
  includeFinancialData?: boolean;
  includeActivityData?: boolean;
}