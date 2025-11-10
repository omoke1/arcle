/**
 * Supply Chain Finance Service
 * 
 * Manages supplier payments and purchase order financing
 */

import crypto from "crypto";

export interface Supplier {
  id: string;
  name: string;
  address?: string; // Wallet address
  paymentTerms: "net-15" | "net-30" | "net-60" | "custom";
  earlyPaymentDiscount?: {
    percentage: number;
    daysBeforeDue: number;
  };
  metadata?: {
    category?: string;
    contact?: string;
    tags?: string[];
  };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  amount: string;
  currency: string;
  description?: string;
  orderDate: string;
  deliveryDate?: string;
  status: "pending" | "delivered" | "paid" | "cancelled";
  paymentHash?: string;
  paidAt?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  invoiceNumber?: string;
  amount: string;
  currency: string;
  dueDate: string;
  paidAt?: string;
  paymentHash?: string;
  status: "pending" | "paid" | "overdue";
  earlyPaymentDiscount?: {
    applied: boolean;
    discountAmount: string;
    finalAmount: string;
  };
}

// Store in localStorage
const SUPPLIERS_STORAGE_KEY = "arcle_suppliers";
const POS_STORAGE_KEY = "arcle_purchase_orders";
const SUPPLIER_PAYMENTS_STORAGE_KEY = "arcle_supplier_payments";

/**
 * Create supplier
 */
export function createSupplier(supplier: Omit<Supplier, "id">): Supplier {
  const suppliers = getAllSuppliers();
  const newSupplier: Supplier = {
    ...supplier,
    id: crypto.randomUUID(),
  };
  
  suppliers.push(newSupplier);
  saveSuppliers(suppliers);
  
  return newSupplier;
}

/**
 * Get all suppliers
 */
export function getAllSuppliers(): Supplier[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get supplier by ID
 */
export function getSupplierById(id: string): Supplier | null {
  const suppliers = getAllSuppliers();
  return suppliers.find(s => s.id === id) || null;
}

/**
 * Create purchase order
 */
export function createPurchaseOrder(po: Omit<PurchaseOrder, "id" | "poNumber" | "orderDate" | "status">): PurchaseOrder {
  const pos = getAllPurchaseOrders();
  
  const poNumber = `PO-${new Date().getFullYear()}-${String(pos.length + 1).padStart(4, "0")}`;
  
  const newPO: PurchaseOrder = {
    ...po,
    id: crypto.randomUUID(),
    poNumber,
    orderDate: new Date().toISOString(),
    status: "pending",
  };
  
  pos.push(newPO);
  savePurchaseOrders(pos);
  
  return newPO;
}

/**
 * Get all purchase orders
 */
export function getAllPurchaseOrders(): PurchaseOrder[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(POS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Create supplier payment
 */
export function createSupplierPayment(payment: Omit<SupplierPayment, "id" | "status">): SupplierPayment {
  const payments = getAllSupplierPayments();
  
  const supplier = getSupplierById(payment.supplierId);
  const dueDate = new Date(payment.dueDate);
  const now = new Date();
  
  let status: SupplierPayment["status"] = "pending";
  if (dueDate < now) {
    status = "overdue";
  }
  
  // Calculate early payment discount if applicable
  let earlyPaymentDiscount: SupplierPayment["earlyPaymentDiscount"] | undefined;
  if (supplier?.earlyPaymentDiscount && status === "pending") {
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue >= supplier.earlyPaymentDiscount.daysBeforeDue) {
      const amount = parseFloat(payment.amount);
      const discountPercent = supplier.earlyPaymentDiscount.percentage / 100;
      const discountAmount = amount * discountPercent;
      const finalAmount = amount - discountAmount;
      
      earlyPaymentDiscount = {
        applied: true,
        discountAmount: discountAmount.toFixed(6),
        finalAmount: finalAmount.toFixed(6),
      };
    }
  }
  
  const newPayment: SupplierPayment = {
    ...payment,
    id: crypto.randomUUID(),
    status,
    earlyPaymentDiscount,
  };
  
  payments.push(newPayment);
  saveSupplierPayments(payments);
  
  return newPayment;
}

/**
 * Get all supplier payments
 */
export function getAllSupplierPayments(): SupplierPayment[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(SUPPLIER_PAYMENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Mark supplier payment as paid
 */
export function markSupplierPaymentAsPaid(id: string, paymentHash: string): SupplierPayment | null {
  const payments = getAllSupplierPayments();
  const index = payments.findIndex(p => p.id === id);
  
  if (index === -1) {
    return null;
  }
  
  payments[index] = {
    ...payments[index],
    status: "paid",
    paidAt: new Date().toISOString(),
    paymentHash,
  };
  
  saveSupplierPayments(payments);
  return payments[index];
}

/**
 * Save functions
 */
function saveSuppliers(suppliers: Supplier[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
  } catch (error) {
    console.error("Error saving suppliers:", error);
  }
}

function savePurchaseOrders(pos: PurchaseOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
  } catch (error) {
    console.error("Error saving purchase orders:", error);
  }
}

function saveSupplierPayments(payments: SupplierPayment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUPPLIER_PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
  } catch (error) {
    console.error("Error saving supplier payments:", error);
  }
}

