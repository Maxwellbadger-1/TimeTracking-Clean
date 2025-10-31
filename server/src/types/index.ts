// Shared types for Backend

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  department?: string;
  weeklyHours: number;
  vacationDaysPerYear: number;
  status: 'active' | 'inactive';
  createdAt: string;
  deletedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
