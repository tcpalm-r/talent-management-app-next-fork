import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Performance, Potential } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBoxKey(performance: Performance, potential: Potential): string {
  const boxKeys = {
    low: {
      low: 'realign_redirect',
      medium: 'evaluate_further',
      high: 'rising_talent'
    },
    medium: {
      low: 'core_foundation',
      medium: 'steady_contributor',
      high: 'emerging_leader'
    },
    high: {
      low: 'master_craftsperson',
      medium: 'performance_leader',
      high: 'star_top_talent'
    }
  };
  
  return boxKeys[performance][potential];
}

export function getGridPosition(performance: Performance, potential: Potential): [number, number] {
  // Box definitions use 1-indexed coordinates (1, 2, 3)
  const performanceMap = { low: 1, medium: 2, high: 3 };
  const potentialMap = { low: 1, medium: 2, high: 3 };

  return [performanceMap[performance], potentialMap[potential]];
}

export function getPerformancePotentialFromPosition(x: number, y: number): [Performance, Potential] {
  // Box definitions use 1-indexed coordinates (1, 2, 3), so convert to 0-indexed for array lookup
  const performanceMap: Performance[] = ['low', 'medium', 'high'];
  const potentialMap: Potential[] = ['low', 'medium', 'high'];

  // grid_x and grid_y are 1-based (1=low, 2=medium, 3=high), so subtract 1 for array index
  const performanceIndex = x - 1;
  const potentialIndex = y - 1;

  return [performanceMap[performanceIndex], potentialMap[potentialIndex]];
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString();
}

export function generateRandomColor(): string {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}