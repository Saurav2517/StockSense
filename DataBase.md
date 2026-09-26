# StockSense --- Database Design

## 1. Database

Database engine:

``` text
PostgreSQL
```

Hosted through:

``` text
Supabase
```

The schema below is the proposed implementation schema derived from the
StockSense problem statement and supplied system mockup.

------------------------------------------------------------------------

## 2. Entity Relationship Overview

``` text
auth.users
    |
    v
profiles
    |
    +----------------------+
    |                      |
    v                      v
warehouses             operations users
    |
    v
locations
    |
    v
inventory
    |
    v
products
    |
    +---- categories
    |
    +---- inventory

suppliers
    |
    v
receipts
    |
    v
receipt_items
    |
    v
products

customers / contacts
    |
    v
deliveries
    |
    v
delivery_items
    |
    v
products

transfers
    |
    v
transfer_items
    |
    v
products

adjustments
    |
    v
adjustment_items
    |
    v
products

all completed operations
    |
    v
stock_movements
```

------------------------------------------------------------------------

# 3. `profiles`

Application-level user profile linked to Supabase Auth.

  Column       Type          Constraints            Description
  ------------ ------------- ---------------------- -------------------------------------
  id           uuid          PK, FK auth.users.id   Authenticated user ID
  login_id     varchar(12)   UNIQUE, NOT NULL       Application login ID
  email        text          UNIQUE, NOT NULL       User email
  full_name    text          NULL                   Display name
  role         text          NOT NULL               Inventory manager / warehouse staff
  created_at   timestamptz   NOT NULL               Creation time
  updated_at   timestamptz   NOT NULL               Last update

Suggested role values:

``` text
INVENTORY_MANAGER
WAREHOUSE_STAFF
```

Do not store passwords in this table. Supabase Auth handles credentials.

------------------------------------------------------------------------

# 4. `categories`

Product categories.

  Column        Type          Constraints        Description
  ------------- ------------- ------------------ ----------------------
  id            uuid          PK                 Category ID
  name          text          UNIQUE, NOT NULL   Category name
  description   text          NULL               Category description
  created_at    timestamptz   NOT NULL           Creation time

------------------------------------------------------------------------

# 5. `products`

Master product catalog.

  Column            Type            Constraints        Description
  ----------------- --------------- ------------------ ----------------------
  id                uuid            PK                 Product ID
  sku               text            UNIQUE, NOT NULL   SKU / product code
  name              text            NOT NULL           Product name
  category_id       uuid            FK categories.id   Product category
  unit_of_measure   text            NOT NULL           Unit such as pcs, kg
  unit_cost         numeric(12,2)   DEFAULT 0          Cost per unit
  reorder_level     numeric(12,3)   DEFAULT 0          Low-stock threshold
  is_active         boolean         DEFAULT true       Product availability
  created_at        timestamptz     NOT NULL           Creation time
  updated_at        timestamptz     NOT NULL           Last update

Initial stock should normally be created through an inventory
initialization/adjustment transaction rather than silently changing
stock without a ledger entry.

------------------------------------------------------------------------

# 6. `warehouses`

Warehouse master data.

  Column       Type          Constraints        Description
  ------------ ------------- ------------------ ----------------------
  id           uuid          PK                 Warehouse ID
  code         varchar(10)   UNIQUE, NOT NULL   Short warehouse code
  name         text          NOT NULL           Warehouse name
  address      text          NULL               Warehouse address
  is_active    boolean       DEFAULT true       Active/inactive
  created_at   timestamptz   NOT NULL           Creation time
  updated_at   timestamptz   NOT NULL           Last update

Example:

``` text
code = WH
name = Main Warehouse
```

------------------------------------------------------------------------

# 7. `locations`

Physical inventory locations inside warehouses.

  Column         Type          Constraints                  Description
  -------------- ------------- ---------------------------- ---------------------
  id             uuid          PK                           Location ID
  warehouse_id   uuid          FK warehouses.id, NOT NULL   Parent warehouse
  code           text          NOT NULL                     Location short code
  name           text          NOT NULL                     Location name
  is_active      boolean       DEFAULT true                 Active/inactive
  created_at     timestamptz   NOT NULL                     Creation time
  updated_at     timestamptz   NOT NULL                     Last update

Recommended constraint:

``` text
UNIQUE(warehouse_id, code)
```

------------------------------------------------------------------------

# 8. `inventory`

Current stock by product and location.

  -------------------------------------------------------------------------
  Column              Type              Constraints       Description
  ------------------- ----------------- ----------------- -----------------
  id                  uuid              PK                Inventory row

  product_id          uuid              FK products.id,   Product
                                        NOT NULL          

  location_id         uuid              FK locations.id,  Location
                                        NOT NULL          

  quantity            numeric(12,3)     NOT NULL, \>= 0   On-hand quantity

  reserved_quantity   numeric(12,3)     NOT NULL, DEFAULT Reserved quantity
                                        0                 

  updated_at          timestamptz       NOT NULL          Last stock update
  -------------------------------------------------------------------------

Recommended constraint:

``` text
UNIQUE(product_id, location_id)
```

Derived value:

``` text
free_to_use = quantity - reserved_quantity
```

Do not allow:

``` text
reserved_quantity > quantity
```

unless a deliberate business rule is added.

------------------------------------------------------------------------

# 9. `suppliers`

Supplier/vendor contacts for receipts.

  Column       Type          Constraints   Description
  ------------ ------------- ------------- ------------------
  id           uuid          PK            Supplier ID
  name         text          NOT NULL      Supplier name
  email        text          NULL          Contact email
  phone        text          NULL          Contact phone
  address      text          NULL          Supplier address
  created_at   timestamptz   NOT NULL      Creation time
  updated_at   timestamptz   NOT NULL      Last update

------------------------------------------------------------------------

# 10. `customers`

Customer/contact data for deliveries.

  Column       Type          Constraints   Description
  ------------ ------------- ------------- -----------------------
  id           uuid          PK            Customer ID
  name         text          NOT NULL      Customer/contact name
  email        text          NULL          Email
  phone        text          NULL          Phone
  address      text          NULL          Delivery address
  created_at   timestamptz   NOT NULL      Creation time
  updated_at   timestamptz   NOT NULL      Last update

For a very small hackathon MVP, this table can be simplified into a
generic `contacts` table, but separate supplier/customer tables are
clearer for the current business model.

------------------------------------------------------------------------

# 11. `receipts`

Receipt header for incoming goods.

  Column                Type          Constraints        Description
  --------------------- ------------- ------------------ ---------------------------
  id                    uuid          PK                 Receipt ID
  reference             text          UNIQUE, NOT NULL   Example WH/IN/0001
  warehouse_id          uuid          FK warehouses.id   Receiving warehouse
  location_id           uuid          FK locations.id    Destination location
  supplier_id           uuid          FK suppliers.id    Supplier
  schedule_date         timestamptz   NOT NULL           Planned date
  status                text          NOT NULL           DRAFT/READY/DONE/CANCELED
  responsible_user_id   uuid          FK profiles.id     Responsible user
  created_by            uuid          FK profiles.id     Creator
  created_at            timestamptz   NOT NULL           Creation time
  updated_at            timestamptz   NOT NULL           Last update
  completed_at          timestamptz   NULL               Completion time

------------------------------------------------------------------------

# 12. `receipt_items`

Products contained in a receipt.

  Column       Type            Constraints      Description
  ------------ --------------- ---------------- -------------------
  id           uuid            PK               Receipt line ID
  receipt_id   uuid            FK receipts.id   Receipt
  product_id   uuid            FK products.id   Product
  quantity     numeric(12,3)   \> 0             Quantity received
  created_at   timestamptz     NOT NULL         Creation time

------------------------------------------------------------------------

# 13. `deliveries`

Delivery order header.

  Column                Type          Constraints        Description
  --------------------- ------------- ------------------ -----------------------------------
  id                    uuid          PK                 Delivery ID
  reference             text          UNIQUE, NOT NULL   Example WH/OUT/0001
  warehouse_id          uuid          FK warehouses.id   Source warehouse
  source_location_id    uuid          FK locations.id    Source location
  customer_id           uuid          FK customers.id    Customer/contact
  schedule_date         timestamptz   NOT NULL           Planned delivery date
  status                text          NOT NULL           DRAFT/WAITING/READY/DONE/CANCELED
  responsible_user_id   uuid          FK profiles.id     Responsible user
  created_by            uuid          FK profiles.id     Creator
  created_at            timestamptz   NOT NULL           Creation time
  updated_at            timestamptz   NOT NULL           Last update
  completed_at          timestamptz   NULL               Completion time

------------------------------------------------------------------------

# 14. `delivery_items`

Products contained in a delivery.

  Column            Type            Constraints        Description
  ----------------- --------------- ------------------ --------------------
  id                uuid            PK                 Delivery line ID
  delivery_id       uuid            FK deliveries.id   Delivery
  product_id        uuid            FK products.id     Product
  quantity          numeric(12,3)   \> 0               Quantity requested
  picked_quantity   numeric(12,3)   DEFAULT 0          Quantity picked
  packed_quantity   numeric(12,3)   DEFAULT 0          Quantity packed
  created_at        timestamptz     NOT NULL           Creation time

------------------------------------------------------------------------

# 15. `transfers`

Internal transfer header.

  Column                    Type          Constraints        Description
  ------------------------- ------------- ------------------ ---------------------------
  id                        uuid          PK                 Transfer ID
  reference                 text          UNIQUE, NOT NULL   Example WH/TR/0001
  source_location_id        uuid          FK locations.id    From location
  destination_location_id   uuid          FK locations.id    To location
  schedule_date             timestamptz   NOT NULL           Planned date
  status                    text          NOT NULL           DRAFT/READY/DONE/CANCELED
  responsible_user_id       uuid          FK profiles.id     Responsible user
  created_by                uuid          FK profiles.id     Creator
  created_at                timestamptz   NOT NULL           Creation time
  updated_at                timestamptz   NOT NULL           Last update
  completed_at              timestamptz   NULL               Completion time

Business rule:

``` text
source_location_id != destination_location_id
```

------------------------------------------------------------------------

# 16. `transfer_items`

Products being transferred.

  Column        Type            Constraints       Description
  ------------- --------------- ----------------- ----------------
  id            uuid            PK                Transfer line
  transfer_id   uuid            FK transfers.id   Transfer
  product_id    uuid            FK products.id    Product
  quantity      numeric(12,3)   \> 0              Quantity moved
  created_at    timestamptz     NOT NULL          Creation time

------------------------------------------------------------------------

# 17. `adjustments`

Inventory adjustment header.

  Column                Type          Constraints        Description
  --------------------- ------------- ------------------ ---------------------------
  id                    uuid          PK                 Adjustment ID
  reference             text          UNIQUE, NOT NULL   Example WH/ADJ/0001
  location_id           uuid          FK locations.id    Location
  schedule_date         timestamptz   NOT NULL           Adjustment date
  status                text          NOT NULL           DRAFT/READY/DONE/CANCELED
  reason                text          NOT NULL           Adjustment reason
  responsible_user_id   uuid          FK profiles.id     Responsible user
  created_by            uuid          FK profiles.id     Creator
  created_at            timestamptz   NOT NULL           Creation time
  updated_at            timestamptz   NOT NULL           Last update
  completed_at          timestamptz   NULL               Completion time

------------------------------------------------------------------------

# 18. `adjustment_items`

Physical count lines.

  -------------------------------------------------------------------------
  Column              Type              Constraints       Description
  ------------------- ----------------- ----------------- -----------------
  id                  uuid              PK                Adjustment line

  adjustment_id       uuid              FK adjustments.id Adjustment

  product_id          uuid              FK products.id    Product

  recorded_quantity   numeric(12,3)     NOT NULL          Quantity before
                                                          adjustment

  counted_quantity    numeric(12,3)     NOT NULL          Physical count

  difference          numeric(12,3)     NOT NULL          Counted -
                                                          recorded

  created_at          timestamptz       NOT NULL          Creation time
  -------------------------------------------------------------------------

Formula:

``` text
difference = counted_quantity - recorded_quantity
```

------------------------------------------------------------------------

# 19. `stock_movements`

Central audit ledger.

  Column             Type            Constraints             Description
  ------------------ --------------- ----------------------- --------------------------------------
  id                 uuid            PK                      Movement ID
  reference          text            NOT NULL                Operation reference
  product_id         uuid            FK products.id          Product
  movement_type      text            NOT NULL                IN/OUT/TRANSFER/ADJUSTMENT
  quantity           numeric(12,3)   NOT NULL                Movement quantity
  from_location_id   uuid            FK locations.id, NULL   Source
  to_location_id     uuid            FK locations.id, NULL   Destination
  operation_id       uuid            NULL                    Related operation ID
  operation_type     text            NULL                    RECEIPT/DELIVERY/TRANSFER/ADJUSTMENT
  performed_by       uuid            FK profiles.id          User
  created_at         timestamptz     NOT NULL                Movement time
  notes              text            NULL                    Optional explanation

Examples:

### Receipt

``` text
movement_type = IN
from_location_id = NULL
to_location_id = Main Store
quantity = 100
```

### Delivery

``` text
movement_type = OUT
from_location_id = Main Store
to_location_id = NULL
quantity = 20
```

### Transfer

``` text
movement_type = TRANSFER
from_location_id = Main Store
to_location_id = Production Rack
quantity = 30
```

### Adjustment

``` text
movement_type = ADJUSTMENT
quantity = -3
```

------------------------------------------------------------------------

# 20. Operation References

Because PostgreSQL foreign keys cannot directly point to different
tables through one column, the MVP can use:

``` text
operation_id
operation_type
```

in `stock_movements`.

Example:

``` text
operation_type = RECEIPT
operation_id = <receipt UUID>
```

or:

``` text
operation_type = DELIVERY
operation_id = <delivery UUID>
```

The application must validate this relationship.

A future normalized alternative is a shared `stock_operations` table,
but it is not required for the hackathon MVP.

------------------------------------------------------------------------

# 21. Recommended Status Enums

Use PostgreSQL enums or check constraints.

### Operation status

``` text
DRAFT
WAITING
READY
DONE
CANCELED
```

### Movement type

``` text
IN
OUT
TRANSFER
ADJUSTMENT
```

### Operation type

``` text
RECEIPT
DELIVERY
TRANSFER
ADJUSTMENT
```

------------------------------------------------------------------------

# 22. Important Indexes

Recommended indexes:

``` text
products(sku)
products(category_id)

locations(warehouse_id)

inventory(product_id, location_id)
inventory(location_id, product_id)

receipts(reference)
receipts(status)
receipts(schedule_date)
receipts(warehouse_id)

deliveries(reference)
deliveries(status)
deliveries(schedule_date)
deliveries(warehouse_id)

transfers(reference)
transfers(status)

adjustments(reference)
adjustments(status)

stock_movements(reference)
stock_movements(product_id)
stock_movements(created_at)
stock_movements(movement_type)
```

------------------------------------------------------------------------

# 23. Important Constraints

### Inventory

``` text
quantity >= 0
reserved_quantity >= 0
reserved_quantity <= quantity
```

### Operation quantities

``` text
receipt quantity > 0
delivery quantity > 0
transfer quantity > 0
```

### Transfer

``` text
source_location != destination_location
```

### Product

``` text
sku UNIQUE
```

### Warehouse

``` text
code UNIQUE
```

### Location

``` text
UNIQUE(warehouse_id, code)
```

------------------------------------------------------------------------

# 24. Stock Calculation

For a location:

``` text
On Hand = inventory.quantity
```

For a product across all locations:

``` sql
SELECT SUM(quantity)
FROM inventory
WHERE product_id = :product_id;
```

Free to use:

``` text
Free to Use = quantity - reserved_quantity
```

------------------------------------------------------------------------

# 25. Low Stock

A product is considered low stock when available quantity reaches or
falls below its reorder level.

Conceptually:

``` text
total_available <= reorder_level
```

Out of stock:

``` text
total_available = 0
```

The exact dashboard query can aggregate inventory across locations.

------------------------------------------------------------------------

# 26. Reference Generation

Recommended approach:

-   Keep a numeric sequence per warehouse and operation.
-   Generate the human-readable reference inside a database function.

Example:

``` text
WH/IN/0001
WH/IN/0002
WH/OUT/0001
WH/OUT/0002
WH/TR/0001
WH/ADJ/0001
```

Do not generate the reference using only frontend counters because two
users can create operations at the same time.

------------------------------------------------------------------------

# 27. RLS Strategy

All application tables should have Row Level Security enabled.

Minimum MVP rule:

``` text
Authenticated users can read application data.
Authenticated users can create/update operations according to role.
```

For a stronger implementation:

``` text
INVENTORY_MANAGER
- Products
- Warehouses
- Locations
- Receipts
- Deliveries
- Transfers
- Adjustments
- Reports

WAREHOUSE_STAFF
- View products/stock
- Receipts
- Deliveries
- Transfers
- Physical counting/adjustments as permitted
```

The exact permissions should be finalized by the team before
implementation.

------------------------------------------------------------------------

# 28. Atomic Stock Operations

Never perform these as unrelated frontend queries:

``` text
UPDATE inventory
INSERT stock_movements
UPDATE receipt
```

Instead use one transaction/function:

``` text
Validate operation
      |
      v
Update inventory
      |
      v
Create ledger movement
      |
      v
Mark operation DONE
```

If any operation fails:

``` text
ROLLBACK
```

This prevents situations such as:

``` text
Inventory updated
but
Ledger missing
```

------------------------------------------------------------------------

# 29. Example Inventory Lifecycle

Initial:

``` text
Main Store
Steel = 0
```

Receipt:

``` text
+100
```

Inventory:

``` text
Main Store = 100
```

Transfer:

``` text
Main Store -> Production Rack
30
```

Inventory:

``` text
Main Store = 70
Production Rack = 30
Total = 100
```

Delivery:

``` text
Production Rack
-20
```

Inventory:

``` text
Main Store = 70
Production Rack = 10
Total = 80
```

Adjustment:

``` text
Production Rack
-3 damaged
```

Inventory:

``` text
Main Store = 70
Production Rack = 7
Total = 77
```

Ledger:

``` text
WH/IN/0001    IN          +100
WH/TR/0001    TRANSFER     30
WH/OUT/0001   OUT          -20
WH/ADJ/0001   ADJUSTMENT    -3
```

------------------------------------------------------------------------

# 30. Database Source of Truth

The authoritative current quantity is:

``` text
inventory.quantity
```

The authoritative historical record is:

``` text
stock_movements
```

Operations such as receipts, deliveries, transfers, and adjustments
explain why inventory changed.

This separation gives StockSense both:

-   Fast current-stock reads
-   Complete movement history
