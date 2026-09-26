# StockSense --- System Architecture

## 1. Architecture Overview

StockSense will be implemented as a responsive Progressive Web App.

``` text
                         USERS
                           |
                           v
                +----------------------+
                |  React PWA Frontend  |
                |----------------------|
                | Dashboard             |
                | Products              |
                | Receipts              |
                | Deliveries            |
                | Transfers             |
                | Adjustments           |
                | Move History          |
                | Settings              |
                +----------+-----------+
                           |
                           | HTTPS / Supabase SDK
                           v
                +----------------------+
                |       Supabase       |
                |----------------------|
                | Authentication       |
                | PostgreSQL           |
                | Row Level Security   |
                | Realtime             |
                | Storage (optional)   |
                +----------+-----------+
                           |
                           v
                +----------------------+
                | PostgreSQL Database  |
                |----------------------|
                | Profiles             |
                | Warehouses            |
                | Locations             |
                | Categories            |
                | Products              |
                | Inventory             |
                | Suppliers             |
                | Receipts              |
                | Receipt Items         |
                | Deliveries            |
                | Delivery Items       |
                | Transfers             |
                | Transfer Items        |
                | Adjustments           |
                | Adjustment Items      |
                | Stock Movements      |
                +----------------------+

GitHub -> Vercel -> React PWA
```

------------------------------------------------------------------------

## 2. Technology Stack

### Frontend

-   React
-   Vite
-   React Router
-   CSS / Tailwind CSS or the team's selected UI system
-   PWA support
-   Supabase JavaScript client

### Backend / Data Platform

-   Supabase
-   PostgreSQL
-   Supabase Auth
-   Row Level Security (RLS)
-   Optional Supabase Realtime

### Deployment

-   GitHub for source control
-   Vercel for frontend deployment
-   Supabase hosted backend/database

------------------------------------------------------------------------

## 3. Why Supabase

StockSense has a relational data model.

Examples:

``` text
Warehouse -> Locations
Product -> Inventory
Receipt -> Receipt Items -> Products
Delivery -> Delivery Items -> Products
Transfer -> Transfer Items -> Products
Operation -> Stock Movements
```

PostgreSQL provides the relational model and transactional behavior
required for these relationships.

------------------------------------------------------------------------

## 4. Frontend Architecture

Recommended structure:

``` text
src/
├── app/
│   ├── router/
│   └── providers/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── layout/
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── receipts/
│   ├── deliveries/
│   ├── transfers/
│   ├── adjustments/
│   ├── stock/
│   ├── move-history/
│   └── settings/
├── hooks/
├── services/
│   ├── auth.service.js
│   ├── product.service.js
│   ├── inventory.service.js
│   ├── receipt.service.js
│   ├── delivery.service.js
│   ├── transfer.service.js
│   └── adjustment.service.js
├── lib/
│   └── supabase.js
├── utils/
└── main.jsx
```

------------------------------------------------------------------------

## 5. Application Layers

``` text
Presentation Layer
        |
        v
React Components / Pages
        |
        v
Service Layer
        |
        v
Supabase Client
        |
        v
PostgreSQL / Auth
```

Business-critical stock operations should not rely only on client-side
calculations.

For operations such as:

-   Validate Receipt
-   Validate Delivery
-   Validate Transfer
-   Validate Adjustment

prefer a PostgreSQL function/RPC or a secure backend operation that
performs the inventory update and ledger insertion atomically.

------------------------------------------------------------------------

## 6. Authentication Architecture

``` text
User
 |
 v
React Login
 |
 v
Supabase Auth
 |
 +-- success --> Session
 |                |
 |                v
 |            Dashboard
 |
 +-- failure --> Error
```

User profile information is stored separately in `profiles`, linked to
the authenticated Supabase user.

------------------------------------------------------------------------

## 7. Inventory Architecture

The key entity is:

``` text
Inventory
-----------
product_id
location_id
quantity
reserved_quantity
```

Therefore:

``` text
Product
   |
   +---- Inventory ---- Location ---- Warehouse
```

This supports the same product being present at multiple locations.

------------------------------------------------------------------------

## 8. Stock Operation Architecture

### Receipt

``` text
Receipt
  |
  +-- Receipt Items
          |
          v
      Validate
          |
          +--> Inventory + quantity
          |
          +--> Stock Movement IN
          |
          +--> Receipt DONE
```

### Delivery

``` text
Delivery
  |
  +-- Delivery Items
          |
          v
     Check available stock
          |
     +----+----+
     |         |
   Enough    Not enough
     |         |
     v         v
  Validate   WAITING
     |
     +--> Inventory - quantity
     |
     +--> Stock Movement OUT
     |
     +--> Delivery DONE
```

### Transfer

``` text
Transfer
   |
   +-- Transfer Items
           |
           v
      Validate
           |
           +--> Source inventory - Q
           |
           +--> Destination inventory + Q
           |
           +--> Stock Movement TRANSFER
           |
           +--> Transfer DONE
```

### Adjustment

``` text
Adjustment
   |
   +-- Adjustment Items
           |
           v
      Physical Count
           |
           +--> Inventory = counted quantity
           |
           +--> Stock Movement ADJUSTMENT
           |
           +--> Adjustment DONE
```

------------------------------------------------------------------------

## 9. Database Transaction Pattern

A stock-changing operation should use one atomic transaction.

Example:

``` sql
BEGIN;

-- Lock/read the relevant inventory row
-- Validate available quantity
-- Update inventory
-- Insert stock movement
-- Mark operation as DONE

COMMIT;
```

If validation fails:

``` sql
ROLLBACK;
```

The frontend should receive a success or error response and refresh the
affected views.

------------------------------------------------------------------------

## 10. Realtime

Supabase Realtime can be used for:

-   Dashboard refresh
-   Stock changes
-   Move History updates
-   Low-stock notifications

Realtime is useful but is not required for every screen in the first
MVP.

For the hackathon, prioritize correctness of the database transaction
over real-time animation.

------------------------------------------------------------------------

## 11. PWA Architecture

The React application is packaged as a Progressive Web App.

``` text
React Build
    |
    +-- manifest.webmanifest
    |
    +-- service worker
    |
    +-- app icons
    |
    v
Vercel HTTPS deployment
```

Users can:

-   Open StockSense in a browser.
-   Add it to the home screen on supported devices.
-   Launch it in a standalone app-like window.

The PWA is still the same deployed web application and uses the same
Supabase backend.

------------------------------------------------------------------------

## 12. Deployment Architecture

``` text
Developer
   |
   v
GitHub Repository
   |
   v
Vercel
   |
   v
StockSense PWA
   |
   +--------------------+
   |                    |
   v                    v
Supabase Auth       Supabase DB
                        |
                        v
                 PostgreSQL Tables
```

Environment variables:

``` text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not expose service-role credentials in the React frontend.

------------------------------------------------------------------------

## 13. Security

Use Supabase Row Level Security.

Basic principles:

-   Authenticated users can access application data.
-   Users must have a valid session.
-   Users can only perform permitted operations.
-   Stock-changing functions should validate the current state
    server-side.
-   Never trust client-side stock quantities.
-   Never put a Supabase service-role key in frontend code.

------------------------------------------------------------------------

## 14. Failure Handling

Examples:

### Receipt validation failure

``` text
Frontend -> RPC -> Database error
                    |
                    v
              Transaction rollback
                    |
                    v
              Show error to user
```

### Delivery insufficient stock

``` text
Check inventory
      |
      v
Available < requested
      |
      v
WAITING
+ line marked unavailable
+ notification
```

### Transfer failure

``` text
Invalid source quantity
      |
      v
Reject transaction
      |
      v
No partial inventory update
```

------------------------------------------------------------------------

## 15. Architecture Principle

The frontend is responsible for:

-   Display
-   User interaction
-   Form validation
-   Navigation

The database/backend operation is responsible for:

-   Authoritative inventory quantity
-   Business rules
-   Transaction safety
-   Ledger creation
-   Status transitions

This prevents the frontend from becoming the source of truth.
