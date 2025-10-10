# Beveren Customer Portal

![Beveren Customer Portal Banner](/.github/images/logo.jpg)

## Overview

Beveren Customer Portal is a comprehensive, modern customer interface designed specifically for ERPNext. This portal provides your customers with a secure, intuitive platform to access their business documents, track orders, manage payments, and submit support tickets—all within a sleek, responsive interface.

Built with React 19, TypeScript, and Vite, the Beveren Customer Portal delivers a lightning-fast user experience with real-time data synchronization to your ERPNext instance.

## Key Features

- **Beautiful Dashboard**: Gives customers a comprehensive overview of their account status, recent activities, and important metrics.
- **Document Management**: Access and manage all sales-related documents in one place.
- **Real-time Tracking**: Follow order status, delivery progress, and payment status with live updates.
- **Intuitive Navigation**: Thoughtfully designed interface for seamless user experience across devices.
- **Dark/Light Mode**: Support for user preference with automatic system detection.
- **Responsive Design**: Optimized for any device from mobile to desktop.
- **Secure Authentication**: Robust security measures to protect customer data.

## Screenshots

### Dashboard View
![Dashboard View](/.github/images/dashboard.png)
*The dashboard provides customers with key metrics, recent activities, and important notifications at a glance.*

### List View
![List View](/.github/images/sales_order_list.png)
*All document types (Sales Orders, Quotations, Invoices, Delivery Notes) share this consistent, filterable list view with quick actions.*

### Detail View
![Detail View](/.github/images/sales_order_detail.png)
*Document details are presented in an organized, intuitive layout with related actions and documents easily accessible.*

## Installation

### Prerequisites
- ERPNext v15
- Python 3.10+
- Node.js 18+ and Yarn
- React and React Router 19

### Quick Install

1. Navigate to your bench directory:
   ```bash
   cd /path/to/your/bench
   ```

2. Get the app from GitHub:
   ```bash
   bench get-app customer_portal https://github.com/beverensoftware/beveren_customer_portal
   ```

3. Install the app to your site:
   ```bash
   bench --site your-site.local install-app customer_portal
   ```

4. Build the frontend assets:
   ```bash
   bench build --app customer_portal
   ```

5. Restart your bench:
   ```bash
   bench restart
   ```

## Development Setup

To set up a development environment:

1. Clone the repository:
   ```bash
   git clone https://github.com/beverensoftware/beveren_customer_portal.git
   cd customer_portal
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Start the development server:
   ```bash
   yarn dev
   ```

4. For production build:
   ```bash
   yarn build
   ```

## Configuration

### Customer Role Permissions

The portal automatically sets up the necessary role permissions for customers during installation. These permissions allow customers to:

- View their own Sales Orders, Quotations, Invoices, and Delivery Notes
- Create and track Support Tickets
- Access their payment history
- View and download shared documents

### Custom Branding

You can customize the portal's appearance:

1. Update the logo at `customer_portal/public/logo.png`
2. Modify color schemes in `portal/src/index.css` (specifically the CSS variables in the `:root` section)
3. Adjust the company name and contact details in the portal settings

## Security Features

- Role-based access control
- User-specific document filtering
- CSRF protection
- Encrypted communication
- Session management

## Technical Architecture

The Beveren Customer Portal consists of:

1. **Frontend**: React 19 single-page application with:
   - TypeScript for type safety
   - React Router for navigation
   - Shadcn UI components (based on Radix UI)
   - Tailwind CSS for styling
   - Context API for state management

2. **Backend**: Frappe/ERPNext integration with:
   - Custom API endpoints for customer data
   - Permission handlers
   - Document event hooks
   - Authentication management

## Frequently Asked Questions

**Q: Can customers create new orders through the portal?**  
A: Currently, the portal focuses on viewing existing documents. Order creation functionality is planned for a future release.

**Q: How are user permissions handled?**  
A: The portal automatically creates and manages user permissions when customers are created or deleted in ERPNext.

**Q: Is the portal mobile-friendly?**  
A: Yes, the responsive design works seamlessly on mobile, tablet, and desktop devices.

## Support and Contribution

For issues, feature requests, or contributions, please visit our [GitHub repository](https://github.com/beverensoftware/beveren_customer_portal).

For commercial support or customization, contact us at support@beverensoftware.com.

## License

This project is licensed under the MIT License - see the [license.txt](license.txt) file for details.

---

© 2024 Beveren Software Inc. All rights reserved.