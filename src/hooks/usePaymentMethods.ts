import { useCallback } from "react";
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
} from "../services/paymentMethodService";
import { useServiceQuery } from "./useServiceQuery";

export function usePaymentMethods() {
  const loader = useCallback(() => listPaymentMethods(), []);
  return { ...useServiceQuery(loader), createPaymentMethod, updatePaymentMethod, deletePaymentMethod };
}
