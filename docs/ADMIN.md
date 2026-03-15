# Admin Guide

## Access

Local admin routes:

- login: `/admin/login`
- dashboard: `/admin`

The initial owner admin comes from your configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`
environment variables during bootstrap.

Rotate that password from the admin dashboard security panel before production use.

## Admin Areas

The admin workspace supports:

- dashboard overview and counts
- product create, edit, delete, and image upload
- order payment review and tracking updates
- customer suspension, editing, deletion, and direct email
- additional admin account management
- runtime settings for brand, support info, email, and payment settings

## Roles

Current roles are:

- `owner`
- `manager`
- `support`

Role capabilities are enforced by the backend. Owners have full access, managers focus on operations, and support has a narrower support-oriented scope.

## Common Workflows

### Review a bank-transfer order

1. Open the order in the admin dashboard.
2. Review the uploaded proof.
3. Update payment status and order status.
4. Add tracking information if available.
5. Notify the customer if needed.

### Send a direct customer email

1. Open the order or user record.
2. Use the email form in the admin UI.
3. Submit the message.

### Add a product

1. Upload a product image.
2. Create the product with name, description, category, price, and stock.
3. Verify it appears on the storefront.

## Operational Notes

- Uploaded files are stored under `backend/uploads/`
- Email delivery depends on valid SMTP credentials
- Suspended customers cannot sign in
- Order tracking lookup requires either the owning account or the matching customer email
