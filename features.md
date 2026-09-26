# StockSense --- Features

## 1. Authentication

### Login

-   Login ID / email
-   Password
-   Credential validation
-   Invalid credential message
-   Redirect to Dashboard after successful login

### Registration

-   Unique Login ID
-   Login ID length validation
-   Unique email
-   Strong password validation
-   Password confirmation

### Password Reset

-   OTP-based password reset requirement from the problem statement
-   Supabase authentication integration for the implemented reset flow

### Profile

-   My Profile
-   Logout
-   Responsible user automatically associated with operations

------------------------------------------------------------------------

## 2. Dashboard

### KPIs

-   Total Products in Stock
-   Low Stock Items
-   Out of Stock Items
-   Pending Receipts
-   Pending Deliveries
-   Internal Transfers Scheduled

### Filters

-   Document type
-   Status
-   Warehouse
-   Location
-   Product category

### Date-based states

The current mockup defines:

-   Late: schedule date is before today's date
-   Operations: schedule date is after today's date
-   Waiting: waiting for stock

------------------------------------------------------------------------

## 3. Product Management

Create and update products.

### Product fields

-   Name
-   SKU / Code
-   Category
-   Unit of Measure
-   Initial Stock
-   Unit Cost
-   Reorder Level

### Product capabilities

-   Search by SKU
-   Search by product name
-   Category filtering
-   Stock availability by location
-   Reordering rules
-   Low-stock detection

------------------------------------------------------------------------

## 4. Stock

The Stock screen displays:

  Field           Meaning
  --------------- ---------------------------------------
  Product         Inventory item
  Per Unit Cost   Cost per unit
  On Hand         Recorded quantity
  Free to Use     Quantity available for new operations

The mockup also indicates that users should be able to update stock from
the Stock page. For the final implementation, direct stock edits should
preferably be represented as an Inventory Adjustment so that every
correction remains auditable.

------------------------------------------------------------------------

## 5. Warehouse Management

Create and manage warehouses.

### Warehouse fields

-   Name
-   Short Code
-   Address

Example:

``` text
WH
Main Warehouse
Warehouse Road
```

------------------------------------------------------------------------

## 6. Location Management

Locations represent warehouse rooms, racks, stores, or other inventory
areas.

### Location fields

-   Name
-   Short Code
-   Warehouse

Example:

``` text
Main Warehouse
├── WH-ST01 Main Store
├── WH-RK01 Rack A
├── WH-RK02 Rack B
└── WH-PR01 Production Floor
```

------------------------------------------------------------------------

## 7. Receipts

Receipts represent incoming goods.

### Receipt fields

-   Reference
-   Receive From / Supplier
-   Schedule Date
-   Responsible User
-   Warehouse
-   Destination Location
-   Status
-   Product lines
-   Quantities

### Actions

-   New
-   To Do / Ready
-   Validate
-   Print
-   Cancel

### Status

``` text
DRAFT -> READY -> DONE
```

### Validation effect

``` text
Stock += Received Quantity
```

A completed receipt creates an `IN` stock movement.

------------------------------------------------------------------------

## 8. Delivery Orders

Delivery Orders represent outgoing goods.

### Delivery fields

-   Reference
-   Delivery Address / Customer
-   Schedule Date
-   Operation Type
-   Responsible User
-   Source Warehouse / Location
-   Status
-   Product lines
-   Quantities

### Actions

-   New
-   Validate
-   Print
-   Cancel

### Status

``` text
DRAFT -> READY -> DONE
```

or, when stock is unavailable:

``` text
DRAFT -> WAITING -> READY -> DONE
```

### Stock validation

If:

``` text
Requested Quantity > Available Quantity
```

then:

-   Highlight the affected line.
-   Show a stock alert.
-   Do not allow negative stock.
-   Put the operation into `WAITING` when appropriate.

### Validation effect

``` text
Stock -= Delivered Quantity
```

A completed delivery creates an `OUT` stock movement.

------------------------------------------------------------------------

## 9. Internal Transfers

Transfers move inventory between locations.

Examples:

``` text
Main Store -> Production Rack
Rack A -> Rack B
Warehouse 1 -> Warehouse 2
```

### Fields

-   Reference
-   Source Location
-   Destination Location
-   Product
-   Quantity
-   Responsible User
-   Status
-   Date

### Stock effect

``` text
Source -= Quantity
Destination += Quantity
```

Total stock remains unchanged.

A completed transfer creates a `TRANSFER` movement.

------------------------------------------------------------------------

## 10. Inventory Adjustments

Adjustments reconcile recorded stock with physical stock.

### Inputs

-   Product
-   Location
-   Recorded Quantity
-   Physical Count
-   Difference
-   Reason
-   Responsible User

### Example

``` text
Recorded: 50
Counted: 47
Difference: -3
```

### Result

``` text
Inventory = 47
Ledger = -3 adjustment
```

------------------------------------------------------------------------

## 11. Move History

Move History displays inventory movements.

### Columns

-   Reference
-   Product
-   Contact
-   Quantity
-   Status
-   From
-   To
-   Date
-   Movement Type

### Display behavior

If one reference contains multiple products, show each product on its
own row.

### Movement display

-   Incoming / IN movement --- green visual treatment
-   Outgoing / OUT movement --- red visual treatment
-   Transfer --- neutral/transfer treatment
-   Adjustment --- adjustment treatment

### Search

Search by:

-   Reference
-   Contact

### View

-   List view
-   Optional Kanban view grouped by status

------------------------------------------------------------------------

## 12. Reference Generation

Reference format:

``` text
<Warehouse>/<Operation>/<ID>
```

Examples:

``` text
WH/IN/0001
WH/IN/0002

WH/OUT/0001
WH/OUT/0002
```

Recommended additional prefixes:

``` text
WH/TR/0001
WH/ADJ/0001
```

The ID component must be unique.

------------------------------------------------------------------------

## 13. Notifications and Alerts

-   Low-stock alert
-   Out-of-stock alert
-   Insufficient stock on delivery
-   Waiting-for-stock status
-   Late scheduled operation

------------------------------------------------------------------------

## 14. Search and Filtering

Search:

-   Product name
-   SKU
-   Receipt reference
-   Delivery reference
-   Contact

Filters:

-   Status
-   Warehouse
-   Location
-   Category
-   Operation type

------------------------------------------------------------------------

## 15. Printing

The mockup includes a Print action for completed receipts/deliveries.

For the MVP:

-   Enable printing for `DONE` receipts.
-   Enable printing for `DONE` delivery orders.
-   Use browser print / printable HTML.
-   A generated PDF can be added later if required.

------------------------------------------------------------------------

## 16. Auditability

Every completed stock-changing operation must produce a ledger entry.

``` text
Receipt      -> IN
Delivery     -> OUT
Transfer     -> TRANSFER
Adjustment   -> ADJUSTMENT
```

This is a core StockSense feature, not an optional reporting screen.

------------------------------------------------------------------------

## 17. Hackathon MVP

### Must Have

-   Login
-   Dashboard
-   Products
-   Warehouse
-   Locations
-   Receipts
-   Delivery Orders
-   Inventory
-   Transfers
-   Adjustments
-   Move History
-   Supabase database
-   Deployed PWA

### Can Be Simplified

-   OTP reset UI
-   Kanban
-   Printing
-   Realtime subscriptions
-   Advanced role permissions
-   Advanced notification system

### Demo Priority

``` text
Create Product
     ↓
Receive Stock
     ↓
Inventory increases
     ↓
Transfer Stock
     ↓
Location changes
     ↓
Deliver Stock
     ↓
Inventory decreases
     ↓
Adjust Stock
     ↓
Move History shows everything
```
