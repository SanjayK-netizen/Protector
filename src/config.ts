export type UserContext = 'student' | 'employee' | 'shop_customer' | 'merchant' | 'general';

export const AMOUNT_THRESHOLD_MAP: Record<UserContext, number> = {
  student: 2000,
  employee: 10000,
  shop_customer: 5000,
  merchant: 25000,
  general: 5000,
};

export const DEFAULT_USER_CONTEXT: UserContext = 'general';
export const LOOKALIKE_MAX_DISTANCE = 2;
