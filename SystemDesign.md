# StockSense --- System Design

## 1. Purpose

StockSense is a modular Inventory Management System (IMS) designed to
replace manual registers, Excel sheets, and scattered stock tracking
with a centralized, real-time application.

The system is designed for:

-   Inventory Managers --- manage incoming and outgoing stock.
-   Warehouse Staff --- perform transfers, picking, shelving, and
    counting.

The approved implementation direction for the hackathon is a
**responsive React Progressive Web App (PWA)** backed by
**Supabase/PostgreSQL**.

------------------------------------------------------------------------

## 2. Product Scope

StockSense manages the complete inventory lifecycle:

1.  User authentication
2.  Dashboard and inventory KPIs
3.  Product and category management
4.  Warehouse and location management
5.  Incoming stock through Receipts
6.  Outgoing stock through Delivery Orders
7.  Internal stock transfers
8.  Inventory adjustments
9.  Stock / availability view
10. Stock Ledger / Move History
11. Search and filtering
12. Low-stock and out-of-stock alerts

------------------------------------------------------------------------

## 3. Core Design Principle

Every operation that changes stock must produce a corresponding
inventory update and ledger entry.

``` text
Receipt       -> Inventory Increase -> Stock Ledger
Delivery      -> Inventory Decrease -> Stock Ledger
Transfer      -> Location A - Qty
                 Location B + Qty    -> Stock Ledger
Adjustment    -> Inventory Correction -> Stock Ledger
```

The ledger is an audit trail; it should not be manually edited as a
substitute for the operation that caused the movement.

------------------------------------------------------------------------

## 4. Application Navigation

``` text
StockSense
├── Dashboard
├── Operations
│   ├── Receipts
│   ├── Delivery Orders
│   └── Inventory Adjustments
├── Products / Stock
├── Move History
└── Settings
    ├── Warehouses
    └── Locations

Profile Menu
├── My Profile
└── Logout
```

------------------------------------------------------------------------

## 5. Authentication

### Login

Inputs:

-   Login ID / email
-   Password

Behavior:

-   Validate credentials.
-   On success, redirect to Dashboard.
-   On failure, display `Invalid Login ID or Password`.

### Sign Up

Inputs:

-   Login ID
-   Email
-   Password
-   Re-enter password

Validation from the current system design:

-   Login ID must be unique.
-   Login ID length: 6--12 characters.
-   Email must be unique.
-   Password must contain lowercase, uppercase, special character, and
    be longer than 8 characters.
-   Password confirmation must match.

### Password Reset

The problem statement requires OTP-based password reset.

For the hackathon MVP, use Supabase Auth and implement the reset flow
around the supported authentication mechanism. If true OTP delivery is
not completed, do not claim it is implemented in the demo.

------------------------------------------------------------------------

## 6. Dashboard

The Dashboard is the landing page after authentication.

### Required KPIs

-   Total Products in Stock
-   Low Stock / Out of Stock Items
-   Pending Receipts
-   Pending Deliveries
-   Internal Transfers Scheduled

### Filters

-   Document type:
    -   Receipt
    -   Delivery
    -   Internal Transfer
    -   Adjustment
-   Status:
    -   Draft
    -   Waiting
    -   Ready
    -   Done
    -   Canceled
-   Warehouse
-   Location
-   Product category

Dashboard values must be calculated from the database rather than
hardcoded.

------------------------------------------------------------------------

## 7. Product Management

A product contains:

-   Name
-   SKU / Code
-   Category
-   Unit of Measure
-   Initial stock (optional)
-   Unit cost
-   Reorder level

Inventory quantity is stored separately from the product because the
same product can exist at multiple locations.

``` text
Product
   |
   +---- Inventory ---- Location ---- Warehouse
```

------------------------------------------------------------------------

## 8. Warehouse and Location Model

``` text
Warehouse
├── Name
├── Short Code
└── Address
     |
     └── Locations
         ├── Name
         ├── Short Code
         └── Warehouse
```

Examples:

``` text
Main Warehouse
├── Main Store
├── Rack A
├── Rack B
└── Production Floor
```

A location belongs to one warehouse.

------------------------------------------------------------------------

## 9. Receipt Workflow

A Receipt represents incoming goods from a vendor/supplier.

### Flow

``` text
Draft
  |
  | Ready / To Do
  v
Ready
  |
  | Validate
  v
Done
```

A receipt contains:

-   Reference
-   Supplier / received-from contact
-   Schedule date
-   Responsible user
-   Warehouse/location
-   Product lines
-   Quantity per product

### Validation

When a receipt is validated:

``` text
Inventory += received quantity
Stock Ledger += IN movement
Receipt status = DONE
```

Example:

``` text
Steel Rod
Before: 50
Receipt: +100
After: 150
```

------------------------------------------------------------------------

## 10. Delivery Workflow

A Delivery Order represents outgoing stock.

### Flow

``` text
Draft
  |
  +----------------------+
  |                      |
  | Stock available      | Stock unavailable
  v                      v
Ready                  Waiting
  |                      |
  | Validate             | Stock becomes available
  v                      v
Done <---------------- Ready
```

The delivery process supports:

1.  Pick
2.  Pack
3.  Validate
4.  Decrease inventory
5.  Create ledger movement

If requested quantity exceeds available stock:

-   Mark the affected line as unavailable.
-   Show an alert.
-   Mark the line red.
-   Put the delivery into `WAITING` when appropriate.
-   Do not allow inventory to become negative.

------------------------------------------------------------------------

## 11. Internal Transfer

Internal transfers move stock between locations.

Examples:

``` text
Main Warehouse -> Production Floor
Rack A -> Rack B
Warehouse 1 -> Warehouse 2
```

Transfer behavior:

``` text
Source Location Quantity -= Q
Destination Location Quantity += Q
Total Company Stock remains unchanged
```

A ledger entry records:

-   Product
-   Quantity
-   From location
-   To location
-   Reference
-   User
-   Timestamp

------------------------------------------------------------------------

## 12. Inventory Adjustment

An adjustment corrects the difference between recorded inventory and
physical count.

Example:

``` text
Recorded quantity = 50
Physical quantity = 47
Difference = -3
```

Validation:

``` text
Inventory = physical counted quantity
Ledger = ADJUSTMENT -3
```

Adjustments must include a reason.

------------------------------------------------------------------------

## 13. Stock / Availability View

The Stock page displays:

-   Product
-   Unit cost
-   On Hand
-   Free to Use

The current design uses the distinction:

``` text
On Hand = physical recorded quantity
Free to Use = quantity available for new operations
```

For the MVP, reserved quantity can be introduced to support the
distinction.

------------------------------------------------------------------------

## 14. Move History / Stock Ledger

Move History shows completed stock movements.

Each movement can contain:

-   Reference
-   Product
-   Quantity
-   Type
-   From location
-   To location
-   Contact
-   Status
-   Date/time
-   Responsible user

For a reference containing multiple products, display multiple product
rows.

Suggested visual convention from the mockup:

-   Incoming movements: green
-   Outgoing movements: red

------------------------------------------------------------------------

## 15. Reference Number

The current design specifies automatic references following:

``` text
<Warehouse>/<Operation>/<ID>
```

Examples:

``` text
WH/IN/0001
WH/OUT/0001
```

For transfers and adjustments, use distinct operation prefixes in the
implementation, for example:

``` text
WH/TR/0001
WH/ADJ/0001
```

The exact transfer/adjustment prefix can be finalized by the team before
implementation.

Reference IDs must be unique.

------------------------------------------------------------------------

## 16. Status Rules

### Common statuses

-   `DRAFT`
-   `WAITING`
-   `READY`
-   `DONE`
-   `CANCELED`

### Receipt

``` text
DRAFT -> READY -> DONE
DRAFT -> CANCELED
READY -> CANCELED
```

### Delivery

``` text
DRAFT -> READY -> DONE
DRAFT -> WAITING -> READY -> DONE
DRAFT -> CANCELED
READY -> CANCELED
WAITING -> CANCELED
```

### Business rules

-   Draft: initial state.
-   Waiting: blocked because required stock is unavailable.
-   Ready: operation can be executed.
-   Done: stock operation has been completed.
-   Canceled: operation is closed without completing the stock movement.

------------------------------------------------------------------------

## 17. Transaction Safety

Stock-changing operations must be atomic.

Example:

``` text
BEGIN
  update inventory
  insert stock movement
  update operation status
COMMIT
```

If any step fails, the transaction must roll back.

This is especially important for:

-   Receipt validation
-   Delivery validation
-   Transfer validation
-   Adjustment validation

------------------------------------------------------------------------

## 18. Recommended MVP

For the hackathon, the minimum convincing end-to-end flow is:

``` text
Login
  ->
Dashboard
  ->
Create Product
  ->
Create Warehouse + Location
  ->
Receipt +100
  ->
Inventory becomes 100
  ->
Transfer 30
  ->
Location quantities update
  ->
Delivery -20
  ->
Inventory becomes 80
  ->
Adjustment -3
  ->
Inventory becomes 77
  ->
Move History shows all movements
```

This proves the core business value without requiring every enterprise
feature.
