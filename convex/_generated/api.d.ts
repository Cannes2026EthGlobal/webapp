/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as advanceRequests from "../advanceRequests.js";
import type * as advanceSettings from "../advanceSettings.js";
import type * as balances from "../balances.js";
import type * as businessProfiles from "../businessProfiles.js";
import type * as checkout from "../checkout.js";
import type * as checkoutLinks from "../checkoutLinks.js";
import type * as companies from "../companies.js";
import type * as compensationLines from "../compensationLines.js";
import type * as crons from "../crons.js";
import type * as customerPayments from "../customerPayments.js";
import type * as customers from "../customers.js";
import type * as employeePayments from "../employeePayments.js";
import type * as employees from "../employees.js";
import type * as migrations from "../migrations.js";
import type * as onboarding from "../onboarding.js";
import type * as onboardingState from "../onboardingState.js";
import type * as overview from "../overview.js";
import type * as payrollForecast from "../payrollForecast.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as seedHistory from "../seedHistory.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  advanceRequests: typeof advanceRequests;
  advanceSettings: typeof advanceSettings;
  balances: typeof balances;
  businessProfiles: typeof businessProfiles;
  checkout: typeof checkout;
  checkoutLinks: typeof checkoutLinks;
  companies: typeof companies;
  compensationLines: typeof compensationLines;
  crons: typeof crons;
  customerPayments: typeof customerPayments;
  customers: typeof customers;
  employeePayments: typeof employeePayments;
  employees: typeof employees;
  migrations: typeof migrations;
  onboarding: typeof onboarding;
  onboardingState: typeof onboardingState;
  overview: typeof overview;
  payrollForecast: typeof payrollForecast;
  products: typeof products;
  seed: typeof seed;
  seedHistory: typeof seedHistory;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
