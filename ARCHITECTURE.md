# Arc Counting — Architecture Diagram

## System Architecture

```mermaid
graph TB
    subgraph FE["Frontend — Next.js 16 / React 19"]
        direction TB
        UI["Dashboard Shell<br/>TailwindCSS 4 + shadcn/ui"]
        PAGES["Pages: Overview, Employees,<br/>Customers, Products, Payroll,<br/>Treasury, AI Chat, Settings"]
        PORTAL["Employee Portal<br/>+ Public Checkout"]
        WALLET["Reown AppKit + Wagmi<br/>Wallet Connection"]
    end

    subgraph API["API Routes — Next.js Server"]
        direction TB
        PAY_API["/api/pay — create, status, webhook"]
        USAGE_API["/api/usage — record, bill, tab"]
        AI_API["/api/ai — chat, analyze, usage"]
        AGENT_API["/api/agent — keys, session"]
    end

    subgraph CONVEX["Backend — Convex Serverless"]
        direction TB
        QUERIES["Queries: users, companies, employees,<br/>customers, products, payments,<br/>balances, overview, creditRequests"]
        MUTATIONS["Mutations: CRUD for all entities,<br/>checkout, billing, advances,<br/>balance credits/debits"]
        ACTIONS["Actions: dispatch USDC,<br/>trigger CRE payroll, cron jobs"]
        DB[("Database<br/>22 Tables")]
    end

    subgraph CHAIN["Blockchain — Arc Testnet"]
        direction TB
        PAYROLL["Payroll.sol<br/>CRE-triggered salary"]
        ESCROW["AdvanceEscrow.sol<br/>Salary advance escrow"]
        TOKENS["USDC + EURC"]
    end

    subgraph EXT["External Services"]
        direction TB
        WCPAY["WalletConnect Pay<br/>Checkout Payments"]
        CRE["Chainlink CRE<br/>Payroll Automation"]
        CCTP["Circle CCTP v2<br/>Cross-chain Bridge"]
        CLAUDE["Anthropic Claude<br/>AI Assistant"]
        REOWN["Reown Auth<br/>Wallet Provider"]
    end

    subgraph BRIDGES["Settlement Bridges"]
        ARB["Arbitrum Sepolia"]
        BASE["Base Sepolia"]
    end

    FE -->|"HTTP + JSON"| API
    FE -->|"WebSocket real-time"| CONVEX
    WALLET -->|"RPC"| CHAIN
    WALLET -->|"Auth"| REOWN

    API -->|"ConvexHttpClient"| CONVEX
    PAY_API -->|"REST"| WCPAY
    AI_API -->|"Streaming"| CLAUDE

    ACTIONS -->|"viem RPC"| CHAIN
    ACTIONS -->|"Confidential HTTP"| CRE
    CRE -->|"onReport"| PAYROLL

    CCTP ---|"Burn/Mint USDC"| CHAIN
    CCTP ---|"Burn/Mint USDC"| ARB
    CCTP ---|"Burn/Mint USDC"| BASE

    QUERIES --> DB
    MUTATIONS --> DB
```

## Data Flow Diagrams

### Payroll Settlement Flow — Outbound

```mermaid
sequenceDiagram
    participant Op as Operator Dashboard
    participant CX as Convex Backend
    participant CRE as Chainlink CRE
    participant PAY as Payroll.sol on Arc
    participant EW as Employee Wallet

    Op->>CX: Create salary payment draft
    Op->>CX: Approve payment batch
    CX->>CX: employeePayments status → approved
    CRE->>CX: Fetch pending payments via Confidential HTTP
    CX-->>CRE: Return recipient + amount pairs
    CRE->>CRE: Encode report on DON via WASM
    CRE->>PAY: KeystoneForwarder → onReport
    PAY->>PAY: _processReport — decode recipients
    PAY->>EW: Transfer USDC to each employee
    PAY-->>CX: Emit event with txHash
    CX->>CX: employeePayments status → settled
```

### Customer Payment Flow — Inbound

```mermaid
sequenceDiagram
    participant CU as Customer
    participant CK as Checkout Page
    participant API as Next.js API
    participant WC as WalletConnect Pay
    participant CX as Convex Backend
    participant DP as Dispatch Action

    CU->>CK: Visit checkout page
    CK->>API: POST productId, amount, currency
    API->>CX: checkout.initiateCheckout
    CX->>CX: Create customerPayment as pending
    API->>WC: createPayment with referenceId + amount
    WC-->>API: Return gatewayUrl + paymentId
    API-->>CK: Redirect to WC Pay gateway
    CU->>WC: Pay via wallet
    WC->>API: Webhook — status succeeded
    API->>CX: customerPayments.recordWcPaySuccess
    CX->>CX: Status → paid
    CX->>DP: dispatchRecords.create
    DP->>DP: Send USDC to company treasury
    DP->>CX: dispatchRecords.updateStatus confirmed
```

### Usage-Based Billing Flow

```mermaid
sequenceDiagram
    participant Dev as Developer or Agent
    participant API as Usage API
    participant CX as Convex Backend
    participant Op as Operator Dashboard
    participant WC as WalletConnect Pay

    Dev->>API: POST usage event — units, productId
    API->>CX: usageTabs.recordUsage
    CX->>CX: Create or append to open tab
    CX->>CX: Insert usageEntry for audit
    Note over CX: Tab accumulates usage over time
    Op->>CX: Bill tab — usageTabs.billTab
    CX->>CX: Tab status → billed
    CX->>CX: Create customerPayment
    CX->>WC: Generate checkout link
    WC-->>CX: Payment gateway URL
    Note over WC: Customer pays via checkout flow
```

### Salary Advance Flow

```mermaid
sequenceDiagram
    participant EE as Employee
    participant EP as Employee Portal
    participant CX as Convex Backend
    participant Op as Operator Dashboard
    participant AE as AdvanceEscrow on Arc

    EE->>EP: View salary forecast
    EE->>EP: Request advance — amount + reason
    EP->>CX: creditRequests.create as pending
    CX->>CX: Calculate interest — rate x days
    Op->>CX: creditRequests.approveRequest
    CX->>CX: Status → approved
    Op->>AE: createAdvance — employee, amount, repayDate
    AE->>AE: Escrow USDC
    AE->>EE: Release advance to wallet
    Note over AE: At next paycheck cycle
    AE->>AE: deductFromPayroll — principal + interest
    EE->>AE: repayAdvance
    AE-->>CX: Advance settled
    CX->>CX: creditRequests status → settled
```

### Authentication and Workspace Resolution

```mermaid
sequenceDiagram
    participant U as User
    participant RO as Reown AppKit
    participant FE as Frontend Next.js
    participant CX as Convex Backend

    U->>RO: Connect Wallet
    RO-->>FE: wallet address
    FE->>CX: users.getByWallet address
    alt New user
        CX-->>FE: null
        FE->>CX: users.createOrUpdate address
        CX-->>FE: userId
    else Existing user
        CX-->>FE: user record
    end
    FE->>CX: companies.getByUserId userId
    CX-->>FE: company list
    alt No companies
        FE->>FE: Show Onboarding Wizard
        FE->>CX: companies.create — name, details
    else Has companies
        FE->>FE: Select active company from localStorage
    end
    FE->>FE: Render Dashboard Shell
```

## Database Schema Overview

```mermaid
erDiagram
    users ||--o{ companyMembers : "has roles"
    companies ||--o{ companyMembers : "has members"
    companies ||--o{ employees : "employs"
    companies ||--o{ customers : "bills"
    companies ||--o{ products : "offers"
    companies ||--o{ companyBalances : "holds"

    employees ||--o{ compensationLines : "earns"
    employees ||--o{ employeePayments : "receives"
    employees ||--o{ creditRequests : "requests advances"
    compensationLines ||--o{ compensationSplits : "splits payout"

    customers ||--o{ customerPayments : "pays"
    customers ||--o{ usageTabs : "accumulates usage"
    products ||--o{ checkoutLinks : "has links"
    products ||--o{ customerPayments : "generates revenue"

    usageTabs ||--o{ usageEntries : "records events"
    companies ||--o{ dispatchRecords : "dispatches funds"
    companies ||--o{ balanceEntries : "ledger entries"
    companies ||--o{ agentApiKeys : "issues keys"
    companies ||--o{ aiChatSessions : "AI conversations"
```

## Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | Next.js 16, React 19, TypeScript | Full-stack web framework |
| **UI** | TailwindCSS 4, shadcn/ui, Radix UI | Component library and styling |
| **Wallet** | Reown AppKit, Wagmi, viem | Wallet connection and on-chain interaction |
| **Backend** | Convex serverless | Real-time database, queries, mutations, actions |
| **Blockchain** | Arc Testnet, Solidity, Foundry | Smart contracts for payroll and advances |
| **Payments** | WalletConnect Pay | Customer checkout and USDC settlement |
| **Automation** | Chainlink CRE | Scheduled on-chain payroll execution |
| **Bridging** | Circle CCTP v2 | Cross-chain USDC/EURC transfers |
| **AI** | Anthropic Claude, Vercel AI SDK | Dashboard assistant and analytics |
| **Validation** | Zod | Schema-based input validation |
