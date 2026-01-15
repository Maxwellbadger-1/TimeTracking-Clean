/**
 * Custom hook for overtime reports
 * Uses NEW transaction-based API: /api/reports/overtime/*
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface OvertimeReportSummary {
  userId: number;
  year: number;
  month?: number;
  summary: {
    targetHours: number;
    actualHours: number;
    overtime: number;
  };
  breakdown: {
    daily: Array<{ date: string; target: number; actual: number; overtime: number }>;
    weekly: Array<{ week: string; target: number; actual: number; overtime: number }>;
    monthly: Array<{ month: string; target: number; actual: number; overtime: number }>;
  };
}

export interface OvertimeHistoryEntry {
  month: string;           // "2025-11"
  earned: number;          // Überstunden verdient (Soll/Ist Differenz)
  compensation: number;    // Überstunden genommen (Urlaub/Ausgleich)
  correction: number;      // Admin-Korrekturen
  carryover: number;       // Jahresübertrag (nur Januar)
  balance: number;         // Saldo am Monatsende
  balanceChange: number;   // Änderung vs. Vormonat
}

/**
 * Fetch overtime report for a user
 */
export function useOvertimeReport(userId: number, year: number, month?: number) {
  return useQuery({
    queryKey: ['overtime-report', userId, year, month],
    queryFn: async (): Promise<OvertimeReportSummary> => {
      const params = new URLSearchParams({ year: year.toString() });
      if (month) params.append('month', month.toString());

      const response = await apiClient.get(`/reports/overtime/user/${userId}?${params}`);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!userId && !!year,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch overtime history for a user
 */
export function useOvertimeHistory(userId: number, months: number = 12) {
  return useQuery({
    queryKey: ['overtime-history', userId, months],
    queryFn: async (): Promise<OvertimeHistoryEntry[]> => {
      const params = new URLSearchParams({ months: months.toString() });
      const response = await apiClient.get(`/reports/overtime/history/${userId}?${params}`);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch overtime reports for ALL users (admin only)
 */
export function useAllUsersOvertimeReports(year: number, month?: number) {
  return useQuery({
    queryKey: ['all-users-overtime-reports', year, month],
    queryFn: async (): Promise<OvertimeReportSummary[]> => {
      // Fetch all users first
      const usersResponse = await apiClient.get('/users');
      if (!usersResponse.success) throw new Error(usersResponse.error);

      const users = usersResponse.data;

      // Fetch reports for each user
      const params = new URLSearchParams({ year: year.toString() });
      if (month) params.append('month', month.toString());

      const reports = await Promise.all(
        users.map(async (user: any) => {
          const response = await apiClient.get(`/reports/overtime/user/${user.id}?${params}`);
          if (!response.success) throw new Error(response.error);
          return response.data;
        })
      );

      return reports;
    },
    enabled: !!year,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
