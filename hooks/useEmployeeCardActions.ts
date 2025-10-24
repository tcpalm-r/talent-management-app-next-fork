import { useState, useCallback } from 'react';
import type { Employee } from '../types';

export function useEmployeeCardActions() {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'details' | 'review' | 'plan' | '360' | 'notes' | 'one-on-one' | 'pip' | 'succession' | 'perf-review'>('details');
  const [initialReviewType, setInitialReviewType] = useState<'manager' | 'self'>('manager');

  const handleEmployeeClick = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setInitialTab('details');
    setIsDetailModalOpen(true);
  }, []);

  const handleOpenPlan = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setInitialTab('plan');
    setIsDetailModalOpen(true);
  }, []);

  const handleOpenManagerReview = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setInitialTab('perf-review');
    setInitialReviewType('manager');
    setIsDetailModalOpen(true);
  }, []);

  const handleOpenSelfReview = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setInitialTab('perf-review');
    setInitialReviewType('self');
    setIsDetailModalOpen(true);
  }, []);

  const handleOpen360 = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setInitialTab('360');
    setIsDetailModalOpen(true);
  }, []);

  const closeDetailModal = useCallback(() => {
    setIsDetailModalOpen(false);
    // Keep selectedEmployee until animation completes
    setTimeout(() => setSelectedEmployee(null), 300);
  }, []);

  return {
    selectedEmployee,
    isDetailModalOpen,
    initialTab,
    initialReviewType,
    handleEmployeeClick,
    handleOpenPlan,
    handleOpenManagerReview,
    handleOpenSelfReview,
    handleOpen360,
    closeDetailModal,
  };
}
