// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department: string | null;
  weeklyHours: number;
  vacationDaysPerYear: number;
  status: 'active' | 'inactive';
  createdAt: string;
  deletedAt: string | null;
}

export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department?: string;
  weeklyHours?: number;
  vacationDaysPerYear?: number;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department: string | null;
  weeklyHours: number;
  vacationDaysPerYear: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

// Session Types
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
}

// Declare session data for express-session
declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Time Entry Types
export interface TimeEntry {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  activity: string | null;
  project: string | null;
  location: 'office' | 'homeoffice' | 'field';
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// Absence Request Types
export interface AbsenceRequest {
  id: number;
  userId: number;
  type: 'vacation' | 'sick' | 'unpaid' | 'overtime_comp';
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  adminNote: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
}

// Department Types
export interface Department {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

// Project Types
export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}
