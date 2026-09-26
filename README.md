# StockSense

> A modular, real-time Inventory Management System built as a
> Progressive Web App for the hackathon.

## Problem

Businesses often manage stock through manual registers, Excel sheets,
and disconnected tracking methods. This makes it difficult to know
current stock, locate inventory, track incoming/outgoing goods, and
audit stock changes.

StockSense centralizes these operations into one application.

## Solution

StockSense provides:

-   Product management
-   Multi-warehouse and location support
-   Incoming stock Receipts
-   Outgoing Delivery Orders
-   Internal Transfers
-   Inventory Adjustments
-   Low-stock alerts
-   Dashboard KPIs
-   Stock availability by location
-   Stock Ledger / Move History
-   Search and smart filters
-   Authentication

Every completed stock-changing operation is reflected in the inventory
and recorded in the Stock Ledger.

------------------------------------------------------------------------

## Application

StockSense is implemented as a responsive **Progressive Web App (PWA)**.

Users can:

1.  Open the application from a web URL.
2.  Use it on desktop or mobile browsers.
3.  Install it to a supported device's home screen for an app-like
    experience.

No native APK is required for the hackathon MVP.

------------------------------------------------------------------------

## Technology Stack

### Frontend

-   React
-   Vite
-   React Router
-   PWA support
-   Responsive UI

### Backend / Database

-   Supabase
-   PostgreSQL
-   Supabase Auth
-   Row Level Security
-   Optional Realtime

### Deployment

-   GitHub
-   Vercel

------------------------------------------------------------------------

## Architecture

``` text
                  StockSense PWA
                       |
                       v
                 React Frontend
                       |
                       v
                    Supabase
                /       |       \
             Auth    PostgreSQL  Realtime
                       |
        +--------------+--------------+
        |              |              |
    Products       Inventory       Ledger
        |              |              |
        +------+-------+------+-------+
               |              |
            Operations      Locations
               |
      +--------+--------+---------+
      |        |        |         |
   Receipt  Delivery  Transfer  Adjustment
```

------------------------------------------------------------------------

## Main Modules

``` text
Dashboard
Products
Operations
├── Receipts
├── Delivery Orders
├── Transfers
└── Adjustments
Stock
Move History
Settings
├── Warehouses
└── Locations
Profile
```

------------------------------------------------------------------------

## Core Inventory Flow

### 1. Receive

``` text
Vendor
  |
  v
Receipt
  |
  v
Validate
  |
  +--> Inventory + Quantity
  |
  +--> Ledger IN movement
```

### 2. Transfer

``` text
Location A
   |
   | Quantity
   v
Location B

A -= Quantity
B += Quantity

Ledger = TRANSFER
```

### 3. Deliver

``` text
Inventory
   |
   | Check available stock
   v
Delivery
   |
   v
Validate
   |
   +--> Inventory - Quantity
   |
   +--> Ledger OUT movement
```

### 4. Adjust

``` text
Recorded Quantity
       |
       v
Physical Count
       |
       v
Difference
       |
       +--> Inventory corrected
       |
       +--> Adjustment ledger entry
```

------------------------------------------------------------------------

## Status Model

``` text
DRAFT
  |
  v
READY
  |
  v
DONE
```

For deliveries waiting for unavailable stock:

``` text
DRAFT -> WAITING -> READY -> DONE
```

Canceled operations use:

``` text
CANCELED
```

------------------------------------------------------------------------

## Reference Format

Operation references follow:

``` text
<Warehouse>/<Operation>/<ID>
```

Examples:

``` text
WH/IN/0001
WH/IN/0002

WH/OUT/0001
WH/OUT/0002

WH/TR/0001
WH/ADJ/0001
```

The reference ID is generated server-side so concurrent users cannot
create duplicate references.

------------------------------------------------------------------------

## Database

Main tables:

``` text
profiles
categories
products
warehouses
locations
inventory
suppliers
customers
receipts
receipt_items
deliveries
delivery_items
transfers
transfer_items
adjustments
adjustment_items
stock_movements
```

See [`DataBase.md`](./DataBase.md) for the complete schema.

------------------------------------------------------------------------

## Security

-   Supabase Auth for authentication
-   PostgreSQL Row Level Security
-   No passwords stored in application tables
-   No Supabase service-role key in frontend
-   Stock operations validated server-side
-   Atomic database transactions for stock-changing operations

------------------------------------------------------------------------

## Deployment

### Local development

``` bash
npm install
npm run dev
```

### Production build

``` bash
npm run build
```

### Deployment

The React PWA is deployed through Vercel.

``` text
GitHub
   |
   v
Vercel
   |
   v
StockSense Live URL
```

Configure:

``` text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

in the Vercel project environment variables.

------------------------------------------------------------------------

## Hackathon Demo

Recommended demonstration:

``` text
Login
  ↓
Dashboard
  ↓
Create Product
  ↓
Create Warehouse / Location
  ↓
Receive 100 units
  ↓
Inventory becomes 100
  ↓
Transfer 30 units
  ↓
Location quantities update
  ↓
Deliver 20 units
  ↓
Inventory becomes 80
  ↓
Adjust -3 damaged units
  ↓
Inventory becomes 77
  ↓
Open Move History
  ↓
Show complete audit trail
```

This demonstrates the central StockSense concept:

> Every stock operation updates inventory and leaves an auditable
> movement record.

------------------------------------------------------------------------

## Project Documentation

-   [`SystemDesign.md`](./SystemDesign.md) --- product/system behavior
    and business workflows
-   [`SystemArchitecture.md`](./SystemArchitecture.md) --- application
    and deployment architecture
-   [`features.md`](./features.md) --- complete feature list and MVP
    priorities
-   [`DataBase.md`](./DataBase.md) --- database tables, relationships,
    constraints, and stock logic

------------------------------------------------------------------------

## Status

Hackathon MVP in development.

The implementation should prioritize a working end-to-end inventory flow
over non-essential enterprise features.
