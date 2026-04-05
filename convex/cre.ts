import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

// ─── Helpers ───

function advanceNextPaymentDate(
  currentDate: number,
  frequency: "monthly" | "biweekly" | "weekly",
): number {
  const d = new Date(currentDate)
  if (frequency === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1)
  } else if (frequency === "biweekly") {
    d.setUTCDate(d.getUTCDate() + 14)
  } else {
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return d.getTime()
}

// ─── Queries ───

/**
 * Returns a flat list of due payment items across all companies.
 * Includes both salary payments (with credit deductions) and credit advance payments.
 * Called by the CRE workflow via POST /api/query.
 */
export const getDueEmployees = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    const allCompanies = await ctx.db.query("companies").take(100)

    const results: Array<{
      employeeId: string
      walletAddress: string
      amountCents: number
      payrollContractAddress: string
      companyId: string
      frequency: string
      compensationLineId?: string
      compensationSplitId?: string
      description: string
      type: "salary" | "credit"
      employeePaymentId?: string
    }> = []

    for (const company of allCompanies) {
      if (!company.payrollContractAddress) continue

      const employees = await ctx.db
        .query("employees")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", company._id).eq("status", "active")
        )
        .take(200)

      for (const employee of employees) {
        if (!employee.walletAddress) continue

        // ── Credit advance payments (approved, waiting for on-chain settlement) ──
        const approvedCredits = await ctx.db
          .query("employeePayments")
          .withIndex("by_employeeId", (q) =>
            q.eq("employeeId", employee._id)
          )
          .take(50)

        for (const payment of approvedCredits) {
          if (payment.type !== "credit" || payment.status !== "approved") continue

          results.push({
            employeeId: employee._id,
            walletAddress: employee.walletAddress,
            amountCents: payment.amountCents,
            payrollContractAddress: company.payrollContractAddress,
            companyId: company._id,
            frequency: "",
            description: payment.description ?? "Salary advance",
            type: "credit",
            employeePaymentId: payment._id,
          })

          if (results.length >= 50) break
        }

        // ── Salary payments (due based on nextPaymentDate) ──
        if (employee.nextPaymentDate && employee.nextPaymentDate > now) continue

        const lines = await ctx.db
          .query("compensationLines")
          .withIndex("by_employeeId_and_isActive", (q) =>
            q.eq("employeeId", employee._id).eq("isActive", true)
          )
          .take(20)

        // Check for settled credits that need to be deducted from salary
        const settledCredits = await ctx.db
          .query("creditRequests")
          .withIndex("by_employeeId_and_status", (q) =>
            q.eq("employeeId", employee._id).eq("status", "settled")
          )
          .take(10)
        const totalDeduction = settledCredits.reduce(
          (sum, cr) => sum + cr.requestedAmountCents,
          0,
        )

        // Sum total salary across all lines
        const totalSalary = lines.reduce((sum, l) => sum + l.amountCents, 0)
        const netSalary = Math.max(0, totalSalary - totalDeduction)

        if (totalSalary === 0) continue

        const deductionRatio = netSalary / totalSalary

        for (const line of lines) {
          const splits = await ctx.db
            .query("compensationSplits")
            .withIndex("by_compensationLineId", (q) =>
              q.eq("compensationLineId", line._id)
            )
            .take(20)

          if (splits.length === 0) {
            const adjusted = Math.round(line.amountCents * deductionRatio)
            if (adjusted <= 0) continue

            results.push({
              employeeId: employee._id,
              walletAddress: employee.walletAddress,
              amountCents: adjusted,
              payrollContractAddress: company.payrollContractAddress,
              companyId: company._id,
              frequency: line.frequency,
              compensationLineId: line._id,
              description: totalDeduction > 0
                ? `${line.name} (after ${totalDeduction}¢ credit deduction)`
                : line.name,
              type: "salary",
            })
          } else {
            for (const split of splits) {
              const adjusted = Math.round(split.amountCents * deductionRatio)
              if (adjusted <= 0) continue

              results.push({
                employeeId: employee._id,
                walletAddress: split.walletAddress,
                amountCents: adjusted,
                payrollContractAddress: company.payrollContractAddress,
                companyId: company._id,
                frequency: line.frequency,
                compensationLineId: line._id,
                compensationSplitId: split._id,
                description: split.label
                  ? `${line.name} (${split.label})`
                  : line.name,
                type: "salary",
              })
            }
          }

          if (results.length >= 50) break
        }
        if (results.length >= 50) break
      }
      if (results.length >= 50) break
    }

    return results
  },
})

// ─── Mutations ───

/**
 * Records a settled on-chain payment.
 * Handles both salary and credit payment types.
 * Called by the CRE workflow via POST /api/mutation after a successful
 * evmClient.writeReport().
 */
export const markPaid = mutation({
  args: {
    employeeId:          v.id("employees"),
    type:                v.union(v.literal("salary"), v.literal("credit")),
    compensationLineId:  v.optional(v.id("compensationLines")),
    compensationSplitId: v.optional(v.id("compensationSplits")),
    employeePaymentId:   v.optional(v.id("employeePayments")),
    walletAddress:       v.string(),
    txHash:              v.string(),
    amountCents:         v.number(),
    paidAt:              v.number(),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId)
    if (!employee) throw new Error(`Employee ${args.employeeId} not found`)

    if (args.type === "credit") {
      // ── Credit payment: patch existing employeePayment, settle credit request ──
      if (!args.employeePaymentId) {
        throw new Error("employeePaymentId required for credit payments")
      }

      const payment = await ctx.db.get(args.employeePaymentId)
      if (!payment) throw new Error(`Payment ${args.employeePaymentId} not found`)
      if (payment.status !== "approved") {
        throw new Error(`Payment ${args.employeePaymentId} is ${payment.status}, expected approved`)
      }

      await ctx.db.patch(args.employeePaymentId, {
        status: "settled",
        settledAt: args.paidAt,
        txHash: args.txHash,
        txExplorerUrl: `https://testnet.arcscan.app/tx/${args.txHash}`,
        walletAddress: args.walletAddress,
      })

      // Find and settle the linked credit request
      const creditRequests = await ctx.db
        .query("creditRequests")
        .withIndex("by_employeeId_and_status", (q) =>
          q.eq("employeeId", args.employeeId).eq("status", "approved")
        )
        .take(5)

      for (const cr of creditRequests) {
        if (cr.creditPaymentId === args.employeePaymentId) {
          await ctx.db.patch(cr._id, { status: "settled" })
          break
        }
      }
    } else {
      // ── Salary payment: insert new employeePayment, advance date, deduct credits ──
      if (!args.compensationLineId) {
        throw new Error("compensationLineId required for salary payments")
      }

      const line = await ctx.db.get(args.compensationLineId)
      if (!line) throw new Error(`Compensation line ${args.compensationLineId} not found`)

      let description = line.name
      if (args.compensationSplitId) {
        const split = await ctx.db.get(args.compensationSplitId)
        if (split?.label) {
          description = `${line.name} (${split.label})`
        }
      }

      await ctx.db.insert("employeePayments", {
        companyId: employee.companyId,
        employeeId: args.employeeId,
        type: "salary",
        amountCents: args.amountCents,
        currency: "USD",
        status: "settled",
        settledAt: args.paidAt,
        txHash: args.txHash,
        txExplorerUrl: `https://testnet.arcscan.app/tx/${args.txHash}`,
        compensationLineId: args.compensationLineId,
        compensationSplitId: args.compensationSplitId,
        walletAddress: args.walletAddress,
        description,
      })

      // Advance nextPaymentDate (idempotent: only if still <= paidAt)
      if (!employee.nextPaymentDate || employee.nextPaymentDate <= args.paidAt) {
        const base = employee.nextPaymentDate ?? args.paidAt
        await ctx.db.patch(args.employeeId, {
          nextPaymentDate: advanceNextPaymentDate(base, line.frequency),
        })
      }

      // Mark any settled credit requests as deducted
      const settledCredits = await ctx.db
        .query("creditRequests")
        .withIndex("by_employeeId_and_status", (q) =>
          q.eq("employeeId", args.employeeId).eq("status", "settled")
        )
        .take(10)

      for (const cr of settledCredits) {
        await ctx.db.patch(cr._id, { status: "deducted" })
      }
    }
  },
})
