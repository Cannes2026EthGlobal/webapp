/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as balances from "../balances.js";
import type * as companies from "../companies.js";
import type * as compensationLines from "../compensationLines.js";
import type * as customerPayments from "../customerPayments.js";
import type * as customers from "../customers.js";
import type * as employeePayments from "../employeePayments.js";
import type * as employees from "../employees.js";
import type * as overview from "../overview.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as seedHistory from "../seedHistory.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  balances: typeof balances;
  companies: typeof companies;
  compensationLines: typeof compensationLines;
  customerPayments: typeof customerPayments;
  customers: typeof customers;
  employeePayments: typeof employeePayments;
  employees: typeof employees;
  overview: typeof overview;
  products: typeof products;
  seed: typeof seed;
  seedHistory: typeof seedHistory;
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
