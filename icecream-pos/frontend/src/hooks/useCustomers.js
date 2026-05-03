import { useEffect } from "react";
import { useCustomerStore } from "../store/customerStore";

export function useCustomers() {
  const { customers, loading, fetchCustomers } = useCustomerStore();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    loading,
  };
}
