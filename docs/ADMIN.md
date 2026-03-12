# Admin Guide

## Access

Admin routes:

- `/admin/login`
- `/admin`

Admin authentication is separate from customer authentication.

## Main Sections

### Overview

Use this page to monitor:

- revenue
- order volume
- user count
- pending reviews
- recent users
- recent orders

### Products

Admin can:

- create products
- edit products
- delete products
- upload product images
- mark products as featured

### Orders

Admin can:

- change order status
- update payment status
- review bank-transfer proof submissions
- add tracking carrier, tracking number, tracking URL, and delivery estimate
- add internal admin notes
- send direct customer order emails

### Users

Admin can:

- open user workspace
- edit customer details
- mark email as verified or unverified
- control newsletter opt-in
- suspend or restore users
- send direct user emails
- delete users

### Team

Admin can:

- create operational admins
- change admin role
- activate or deactivate admins
- rotate passwords

### Inbox

Admin can review customer contact submissions from the storefront.

### Settings

Admin runtime settings control:

- store branding
- support details
- hero headlines
- SMTP/email settings
- Paystack keys
- bank transfer account details
- locale and currency settings

These values are read by the live storefront and API.

## Security Recommendations

1. Replace the default admin password immediately.
2. Keep owner credentials private.
3. Use manager/support accounts for day-to-day operations.
4. Only enter live SMTP and payment keys in trusted deployment environments.

