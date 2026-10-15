export type Currency = "VND" | "USD" | "EUR" | "JPY";
export type Minor = number | string;
export type User = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  active: number;
};
export type Wallet = {
  id: number;
  name: string;
  currency: Currency;
  active: number;
  balance_minor: Minor;
};
export type Category = {
  id: number;
  name: string;
  kind: "income" | "expense";
  active: number;
};
export type Transaction = {
  id: number;
  wallet_id: number;
  category_id: number | null;
  kind: "income" | "expense" | "transfer";
  amount_minor: Minor;
  currency: Currency;
  occurred_on: string;
  note: string;
  reversal_of: number | null;
};
export type Budget = {
  id: number;
  name: string;
  category_id: number;
  currency: Currency;
  limit_minor: Minor;
  spent_minor: Minor;
  start_on: string;
  end_on: string;
  threshold: number;
  used_percent: number;
  active: number;
};
export type Goal = {
  id: number;
  name: string;
  currency: Currency;
  target_minor: Minor;
  saved_minor: Minor;
  deadline: string;
  progress_percent: number;
  active: number;
};
export type Subscription = {
  id: number;
  name: string;
  amount_minor: Minor;
  currency: Currency;
  period: "weekly" | "monthly" | "yearly";
  next_due: string;
  remind_days: number;
  active: number;
};
export type Notification = {
  id: number;
  message: string;
  created_on: string;
  is_read: number;
};
export type Suggestion = {
  name: string;
  amount_minor: Minor;
  currency: Currency;
  occurrences: number;
  period: "monthly";
};
export type Rate = {
  id: number;
  base: Currency;
  quote: Currency;
  rate: string;
  effective_on: string;
  source: string;
};
export type Conversion = {
  amount: string;
  base: Currency;
  quote: Currency;
  converted_amount: string;
  rate: string;
  effective_on: string;
  source: string;
};
export type Totals = {
  income_minor: Minor;
  expense_minor: Minor;
  net_minor: Minor;
  income: string;
  expense: string;
  net: string;
};
export type Report = {
  start: string;
  end: string;
  by_currency: Partial<Record<Currency, Totals>>;
  record_count: number;
};
export type Dashboard = Report & {
  wallets: Wallet[];
  wallet_total_minor_by_currency: Partial<Record<Currency, Minor>>;
};
export type Comparison = {
  current: Report;
  previous: Report;
  difference_minor: Partial<
    Record<
      Currency,
      Pick<Totals, "income_minor" | "expense_minor" | "net_minor">
    >
  >;
};
