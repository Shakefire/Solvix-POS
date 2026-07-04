# Solvix POS - Point of Sales System

A desktop Point of Sales application built with **Next.js** and **Electron**, providing a modern interface for managing sales transactions with product catalog, shopping cart, and receipt generation.

## Features

- 🛍️ **Product Catalog** - Browse products by category (Electronics, Groceries, Clothing)
- 🛒 **Shopping Cart** - Add/remove items and adjust quantities
- 💰 **Multiple Payment Methods** - Support for cash, card, and check payments
- 🧾 **Invoice Generation** - Automatic receipt generation with tax calculation
- 🖨️ **Print Receipts** - Print transactions for record keeping
- 💻 **Desktop Application** - Runs as a native Windows desktop app

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install Electron is-dev package** (required for development mode detection)
   ```bash
   npm install --save-dev electron-is-dev
   ```

## Development

Run the Next.js development server:
```bash
npm run dev
```

In another terminal, start Electron:
```bash
npm start
```

The application will open with developer tools enabled. You can modify components and see changes reflected in real-time.

## Building for Production

**Solvix POS**

**Elegant Point‑of‑Sale for Modern Businesses**

Solvix POS is a refined desktop point‑of‑sale experience, thoughtfully designed for speed, clarity, and reliability. Built with Next.js, React, TypeScript, and Electron, Solvix delivers a native Windows experience with the polish and simplicity you expect from premium software.

**What's New — Stable Release (July 9, 2026)**

We're proud to announce the first stable release of Solvix POS Solution. Built for performance, simplicity, and flexibility, Solvix POS enables businesses to operate confidently whether they're online or offline. The Community Edition will be available free of charge, and the full source will be published shortly after the stable release to invite community collaboration.

Release Snapshot:
- **Official Release Date:** July 9, 2026
- **Highlights:** Offline-first operation, seamless online synchronization, simple Windows installer for quick deployment.

Release Message
----------------
We're proud to announce the upcoming release of the first stable version of Solvix POS solution - a modern, powerful, and reliable point-of-sale solution built to meet the needs of small, medium, and large businesses.

Official Release Date: July 9, 2026

Built with performance, simplicity, and flexibility in mind, Solvix POS enables businesses to operate efficiently whether they're connected to the internet or not. The system is fully functional offline, while also supporting online synchronization whenever connectivity is available.

Key Features

* Complete sales and point-of-sale management
* Barcode and QR code scanning for faster transactions
* Comprehensive inventory and stock management
* Financial analytics with actionable business insights
* Dynamic reports and data visualization
* Receipt generation and printing
* Tax configuration and management
* Multi-business support with extensive customization options
* Simple Windows installer for quick deployment - no technical expertise required

The Community Edition of Solvix POS will be available free of charge, making enterprise-grade business management accessible to everyone.

Developers are also invited to contribute. Solvix POS is open source, and the complete source code will be published shortly after the stable release, encouraging collaboration and community-driven innovation.

This release marks the beginning of a broader vision by Solvix Innovations to build practical, high-quality software solutions that empower businesses of every size.

We look forward to welcoming you on July 9, 2026.

Built for business. Designed for everyone.

**Key Features**

- **Sales & POS**: Fast checkout flow, clear UI, multiple payment methods (Cash, Card, Check).
- **Inventory Management**: Track stock, categories, and quick add/remove adjustments.
- **Barcode & QR Support**: Scan to add products quickly (scanner support ready).
- **Offline‑First**: Full functionality offline with background sync when online.
- **Receipts & Printing**: Preview and print receipts, configurable tax rates.
- **Multi‑Business Mode**: Manage multiple outlets or businesses from one app.
- **Reports & Analytics**: Dynamic reports to help you understand sales and stock.
- **Customizable**: Tailwind-based UI and TypeScript codebase for easy theming and extension.

**For Users — Windows Installer**

- **Download:** Obtain the official installer from the Solvix release page or your distribution channel.
- **Install:** Double‑click the downloaded `Solvix POS Setup <version>.exe` and follow the installer prompts. You may be asked to approve a Windows UAC prompt.
- **First Run:** After installation, launch Solvix POS from the Start Menu or desktop shortcut. The app runs standalone — no additional configuration required for basic operation.
- **Updates:** When a new release is available, run the installer again or follow the in‑app update prompt (if enabled) to upgrade.
- **Uninstall:** Use Windows Settings → Apps to uninstall, or run the uninstaller from the installation folder.

Quick Troubleshooting

- If the app does not start, ensure your system meets the prerequisites and try restarting Windows.
- For printing issues, verify your printer is installed and set as default in Windows.

**For Developers**

- **Prerequisites:**
  - Install Node.js (recommended LTS) and npm.
  - Git to clone the repository.

- **Get the source:**

```bash
git clone https://github.com/your-org/solvix-pos.git
cd solvix-pos
npm install
```

- **Run in development:**

Start the Next.js dev server:

```bash
npm run dev
```

In another terminal, start the Electron renderer:

```bash
npm start
```

- **Build & Package (Windows installer):**

```bash
npm run pack
```

This script builds the Next.js app, exports static assets, and uses Electron Builder to create a Windows installer. The resulting installer and artifacts appear in the `dist/` folder; for example: `Solvix POS Setup 0.1.0.exe`.

- **Important files:**

- [package.json](package.json): Project scripts and dependencies
- [main.js](main.js): Electron main process
- [preload.js](preload.js): Electron preload bridge
- [app/page.tsx](app/page.tsx): Main POS UI

- **Testing & Contribution**

- To contribute, fork the repo and open a pull request. Follow the existing code style (TypeScript + React hooks + Tailwind). Add tests where applicable and document behavior in component files.

**Project Structure (overview)**

See the key folders and files:

```
kbpos/
├── app/                # Next.js pages and UI
├── components/         # React components: ProductCatalog, Cart, Checkout
├── main.js             # Electron main process
├── preload.js          # Secure renderer bridge
├── package.json        # Scripts and build config
└── tailwind.config.ts  # Styling configuration
```

**Screenshots**

Below are curated screenshots from the Solvix POS interface. Open the images in the `assets/screens/` folder for full resolution.

- **Dashboard:**

   ![Dashboard](assets/screens/dashboard.png)

- **Point of Sale (Billing):**

   ![POS Billing](assets/screens/pos_billing.png)

- **Products & Inventory:**

   ![Products](assets/screens/products.png)
   ![Inventory](assets/screens/inventory.png)

- **Orders & Receipts:**

   ![Orders](assets/screens/oders.png)
   ![Receipt](assets/screens/reciept.png)

- **Customers & Reports:**

   ![Customers](assets/screens/customers.png)
   ![Reports](assets/screens/reports.png)

- **Expenses & Settings:**

   ![Expenses](assets/screens/expenses.png)
   ![Settings](assets/screens/settings.png)


**Support & Contact**

- For support, open an issue on the repository or contact the Solvix team.
- Community discussions, roadmap, and contribution guidelines will be published alongside the source after the stable release.

**License**

- MIT

**Acknowledgements**

- Built with Next.js, Electron, React, TypeScript, and Tailwind CSS.

---

If you'd like, I can also:

- Add screenshots to relevant sections.
- Draft a short release announcement for social channels.
- Add a `CHANGELOG.md` with the release notes.

Would you like me to add screenshots now?
