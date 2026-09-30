import { can, normalizePermissions, permissionPresets, routeModule } from './src/utils/permissions';
import { registerLinkedAccounting, updateVendor, validDate } from './linkedAccountingRoutes';
import { Books } from './accounting/database';
import { registerBooks } from './accounting/routes';
import { priceStoreOrder } from './src/utils/orderPricing';
import { validateDocument } from './src/utils/documentValidation';
import { hashPassword, verifyPassword, startSession, endSession, sessionUserId } from './serverAuth';
import { SEED_BANK_ACCOUNTS } from './src/services/erpStorage';
import { applyVoucherChange, validateVoucher, applySalesCustomerChange } from './src/utils/accounting';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
// Ensure we look for .env in the root dir regardless of execution context
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import express from 'express';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}
import { GoogleGenAI, Type, ThinkingLevel, LiveServerMessage, Modality } from '@google/genai';
import {
  Product,
  Order,
  UserAccount,
  StoreSettings,
  AISuggestionResponse,
  ProductCategory,
  SerialNumberItem,
  InventoryMovement,
  InventorySummaryStats,
  PriceDropAlert,
  CategoryAttributeSchema,
  CategoryAttributeDefinition,
} from './src/types';
import { DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS } from './src/data/defaultCategoryAttributes';
import { optimizeBuildForBudget } from './src/utils/budgetOptimizer';
import { generateProductSKU, generateSerialNumber } from './src/utils/skuGenerator';
import { generateAccurateProductAttributes } from './src/utils/productAttributeAutoFiller';
import { queryTrack123Live, importTrack123Tracking, deleteTrack123Tracking, PAKISTAN_TRACK123_COURIERS, detectCourierFromTrackingNumber } from './src/services/track123';
import { INITIAL_PRODUCTS } from './src/data/initialProducts';

// In-Memory Database initialized empty / from defaults (populated via loadPersistedData)
let productsDB: Product[] = [];
let serialsDB: SerialNumberItem[] = [];
let movementsDB: InventoryMovement[] = [];
let alertsDB: PriceDropAlert[] = [];
let wishlistDB: { id: string; userId?: string; email?: string; productId: string; createdAt: string }[] = [];
let ordersDB: Order[] = [];
let categoryAttributesDB: CategoryAttributeSchema[] = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS));

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  bannerImage?: string;
  description?: string;
  brands?: string[];
  isCustom?: boolean;
  createdAt: string;
}

let categoriesDB: CategoryItem[] = [
  { id: 'cat-cpu', name: 'Processor', slug: 'processor', icon: '⚡', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&auto=format&fit=crop&q=80', description: 'Intel Core & AMD Ryzen CPUs', brands: ['AMD', 'Intel'], createdAt: new Date().toISOString() },
  { id: 'cat-mobo', name: 'Motherboard', slug: 'motherboard', icon: '🎛️', image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=900&auto=format&fit=crop&q=80', description: 'AM5, AM4, LGA1700 Motherboards', brands: ['MSI', 'ASUS', 'Gigabyte'], createdAt: new Date().toISOString() },
  { id: 'cat-gpu', name: 'Graphic Card', slug: 'graphic-card', icon: '🎮', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=900&auto=format&fit=crop&q=80', description: 'NVIDIA RTX 50 & 40 Series, AMD RX Series', brands: ['MSI', 'ASUS', 'Zotac', 'Gigabyte', 'PNY', 'Sapphire'], createdAt: new Date().toISOString() },
  { id: 'cat-ram', name: 'RAM', slug: 'ram', icon: '🧠', image: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=900&auto=format&fit=crop&q=80', description: 'DDR4 & DDR5 Gaming Memory Kits', brands: ['Corsair', 'XPG', 'G.SKILL', 'Kingston', 'Lexar', 'HIKSEMI'], createdAt: new Date().toISOString() },
  { id: 'cat-storage', name: 'Storage', slug: 'storage', icon: '💾', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=900&auto=format&fit=crop&q=80', description: 'PCIe Gen5, Gen4 NVMe & SATA SSDs', brands: ['Samsung', 'WD', 'XPG', 'Lexar', 'Kingston', 'ADATA'], createdAt: new Date().toISOString() },
  { id: 'cat-psu', name: 'Power Supply', slug: 'power-supply', icon: '🔌', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=900&auto=format&fit=crop&q=80', description: '80+ Bronze/Gold PCIe 5.0 Modular PSUs', brands: ['MSI', 'Corsair', 'XPG', 'SilverStone', '1stPlayer', 'Darkflash'], createdAt: new Date().toISOString() },
  { id: 'cat-casing', name: 'Casing', slug: 'casing', icon: '📦', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=900&auto=format&fit=crop&q=80', description: 'Panoramic Glass & High-Airflow Cases', brands: ['MSI', 'Darkflash', 'DeepCool', 'Thunder', 'Boost'], createdAt: new Date().toISOString() },
  { id: 'cat-cooler', name: 'CPU Cooler', slug: 'cpu-cooler', icon: '❄️', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80', description: 'ARGB Liquid AIOs & Dual-Tower Coolers', brands: ['MSI', 'DeepCool', 'Thermalright', 'Darkflash'], createdAt: new Date().toISOString() },
  { id: 'cat-pc-case-fans', name: 'PC Case Fans', slug: 'pc-case-fans', icon: '🌀', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80', description: 'Chassis Cooling Fans, 120mm/140mm ARGB, Reverse Blade & High Static Pressure Fans', brands: ['Lian Li', 'Corsair', 'Thermalright', 'Darkflash', 'DeepCool', 'Noctua', 'NZXT'], createdAt: new Date().toISOString() },
  { id: 'cat-casing-fans', name: 'Casing Fans', slug: 'casing-fans', icon: '🌀', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80', description: '120mm/140mm ARGB & Reverse Blade Fans', brands: ['Darkflash', 'DeepCool', 'Lian Li', 'Thermalright'], createdAt: new Date().toISOString() },
  { id: 'cat-monitor', name: 'Monitor', slug: 'monitor', icon: '🖥️', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=900&auto=format&fit=crop&q=80', description: '165Hz - 240Hz Fast IPS & QD-OLED Displays', brands: ['MSI', 'ASUS', 'Thunder'], createdAt: new Date().toISOString() },
  { id: 'cat-mouse', name: 'Gaming Mouse', slug: 'gaming-mouse', icon: '🖱️', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=900&auto=format&fit=crop&q=80', description: 'Ultra-lightweight & Wireless Gaming Mice', brands: ['Logitech', 'Razer', 'Glorious'], createdAt: new Date().toISOString() },
  { id: 'cat-keyboard', name: 'Gaming Keyboard', slug: 'gaming-keyboard', icon: '⌨️', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop&q=80', description: 'Mechanical RGB & Wireless Keyboards', brands: ['Logitech', 'Corsair', 'Redragon'], createdAt: new Date().toISOString() },
  { id: 'cat-headset', name: 'Gaming Headset', slug: 'gaming-headset', icon: '🎧', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&auto=format&fit=crop&q=80', description: 'Spatial Audio & Noise Cancelling Headsets', brands: ['HyperX', 'Razer', 'Logitech'], createdAt: new Date().toISOString() },
  { id: 'cat-controller', name: 'Gaming Controller', slug: 'gaming-controller', icon: '🕹️', image: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=800&auto=format&fit=crop&q=80', description: 'Hall Effect Wireless & Multi-Platform Gamepads', brands: ['Flydigi', 'Xbox', 'PlayStation', '8BitDo'], createdAt: new Date().toISOString() },
  { id: 'cat-chair', name: 'Gaming Chair', slug: 'gaming-chair', icon: '🪑', image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=900&auto=format&fit=crop&q=80', description: 'Ergonomic Heavy-Duty Gaming Chairs', brands: ['Thunder', 'Cougar', 'Secretlab'], createdAt: new Date().toISOString() },
  { id: 'cat-table', name: 'Gaming Table', slug: 'gaming-table', icon: '🪚', image: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&auto=format&fit=crop&q=80', description: 'Electric Sit-Stand & Carbon Fiber Gaming Desks', brands: ['Thunder', 'Eureka Ergonomic', 'Cougar'], createdAt: new Date().toISOString() },
  { id: 'cat-monitor-arm', name: 'Monitor Arm', slug: 'monitor-arm', icon: '🦾', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80', description: 'Heavy-Duty Gas Spring Display Arms', brands: ['North Bayou', 'Thunder', 'Brateck'], createdAt: new Date().toISOString() },
  { id: 'cat-wheel', name: 'Steering Wheel', slug: 'steering-wheel', icon: '🏎️', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900&auto=format&fit=crop&q=80', description: 'Force Feedback Sim Racing Wheels & Pedals', brands: ['Logitech', 'Moza', 'Thrustmaster', 'Fanatec'], createdAt: new Date().toISOString() },
  { id: 'cat-microphone', name: 'Microphone', slug: 'microphone', icon: '🎙️', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&auto=format&fit=crop&q=80', description: 'Studio Quality USB Condenser Microphones', brands: ['HyperX', 'Fifine', 'Rode', 'Elgato'], createdAt: new Date().toISOString() },
  { id: 'cat-mouse-pad', name: 'Mouse Pad', slug: 'mouse-pad', icon: '⬛', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80', description: 'Extended Esports Speed & Control Mats', brands: ['Apex Rigs', 'SteelSeries', 'Razer', 'Artisan'], createdAt: new Date().toISOString() },
  { id: 'cat-thermal', name: 'Thermal Solution', slug: 'thermal-solution', icon: '🧪', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80', description: 'High Conductivity Pastes & Thermal Pads', brands: ['Thermal Grizzly', 'Arctic', 'Noctua', 'Kingpin'], createdAt: new Date().toISOString() },
  { id: 'cat-networking', name: 'Networking & Router', slug: 'networking-router', icon: '📡', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80', description: 'Wi-Fi 7/6E Gaming Routers & PCIe Adapters', brands: ['ASUS ROG', 'TP-Link', 'Netgear'], createdAt: new Date().toISOString() },
  { id: 'cat-cables', name: 'Cables & Accessories', slug: 'cables-accessories', icon: '🪢', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80', description: 'Custom Sleeved PSU Cables & GPU Brackets', brands: ['Lian Li', 'Asiahorse', 'EZDIY-FAB', 'Apex'], createdAt: new Date().toISOString() },
  { id: 'cat-earbuds', name: 'Earbuds', slug: 'earbuds', icon: '👂', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&auto=format&fit=crop&q=80', description: 'Low-Latency ANC Wireless Gaming Earbuds', brands: ['Razer', 'Logitech', 'Sony'], createdAt: new Date().toISOString() },
  { id: 'cat-peripherals', name: 'Peripherals', slug: 'peripherals', icon: '🕹️', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80', description: 'Capture Cards, USB Hubs & Stream Gear', brands: ['Elgato', 'Razer', 'Logitech'], createdAt: new Date().toISOString() },
  { id: 'cat-prebuilt', name: 'Pre-Built PC', slug: 'pre-built-pc', icon: '🚀', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80', description: 'Ready-to-Ship Tested Gaming Rigs', brands: ['Apex Rigs'], createdAt: new Date().toISOString() },
];

interface StoredUserAccount {
  permissions?: import('./src/utils/permissions').Permissions;
  id: string;
  fullName: string;
  username?: string;
  email: string;
  password?: string;
  phone: string;
  city: string;
  address: string;
  role: 'customer' | 'admin';
  isOwner?: boolean;
  createdAt: string;
}

// Store Owner Primary Root Credentials
const OWNER_USERNAME = 'sheedatalli';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Rabbait@3108.';
const OWNER_EMAIL = 'bhaiisheeda@gmail.com';

let usersDB: StoredUserAccount[] = [
  {
    id: 'user-owner-1',
    fullName: 'Hammad Ur Rehman (Owner)',
    username: 'sheedatalli',
    email: 'bhaiisheeda@gmail.com',
    password: hashPassword(OWNER_PASSWORD),
    phone: '+447597030688',
    city: 'Lahore',
    address: 'Shop 12-A, 3rd Floor, Hafeez Center, Gulberg iii, Lahore',
    role: 'admin',
    isOwner: true,
    createdAt: new Date().toISOString(),
  },
];

let storeSettings: StoreSettings = {
  storeName: 'ApexRig PC & Hardware Store',
  tagline: 'Pakistan\'s Premier Custom PC Builder & Hardware Hub',
  ownerName: 'Hammad Ur Rehman',
  ownerTitle: 'Store Owner & Lead Hardware Architect',
  adminUsername: 'sheedatalli',
  phone: '+447597030688',
  whatsappNumber: '+447597030688',
  email: 'bhaiisheeda@gmail.com',
  address: 'Shop 12-A, 3rd Floor, Hafeez Center, Gulberg iii, Lahore',
  city: 'Lahore, Pakistan',
  freeShippingThreshold: 50000,
  defaultShippingFee: 1500,
  bankDetails: {
    bankName: 'Meezan Bank Ltd.',
    accountTitle: 'ApexRig PC Hardware',
    accountNumber: '01020304050607',
    iban: 'PK45MEZN0001020304050607',
  },
};

let accountingControls: { lockDate: string; audit: any[] } = { lockDate: '', audit: [] };
let purchaseDocsDB: any[] = [];
let vendorsDB: any[] = [];
let salesDocsDB: any[] = [];
let vouchersDB: any[] = [];
let customersDB: any[] = [];
let bankAccountsDB: any[] = structuredClone(SEED_BANK_ACCOUNTS);
let deletedProductIdsDB: string[] = [];

function sanitizeUser(u: StoredUserAccount): UserAccount {
  const { password, ...safe } = u;
  return { ...safe, permissions: u.isOwner ? permissionPresets['Full administrator'] : u.permissions ?? permissionPresets['Read only'] };
}

const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(process.cwd(), 'store_data.json'));

function safeParseStoreJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  // 1. First attempt: standard parse
  try {
    return JSON.parse(raw);
  } catch (err1) {
    // 2. Second attempt: sanitize unescaped control characters & raw line breaks inside JSON strings
    try {
      const sanitized = raw.replace(/"(?:\\.|[^"\\])*"/g, (match) => {
        return match.replace(/[\u0000-\u001F]/g, (ctrlChar) => {
          if (ctrlChar === '\n') return '\\n';
          if (ctrlChar === '\r') return '\\r';
          if (ctrlChar === '\t') return '\\t';
          if (ctrlChar === '\b') return '\\b';
          if (ctrlChar === '\f') return '\\f';
          const code = ctrlChar.charCodeAt(0);
          return `\\u${code.toString(16).padStart(4, '0')}`;
        });
      });
      return JSON.parse(sanitized);
    } catch (err2) {
      // 3. Third attempt: try cleaning outside strings as well
      try {
        const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
        return JSON.parse(cleaned);
      } catch (err3) {
        // 4. Fourth attempt: salvage individual arrays/objects (orders, users, serials, wishlist, storeSettings)
        const partialData: any = {};
        try {
          const keys = ['orders', 'products', 'categories', 'users', 'serials', 'movements', 'alerts', 'wishlist', 'storeSettings'];
          for (const key of keys) {
            const regex = new RegExp(`"${key}"\\s*:\\s*(\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\})\\s*(?:,\\s*"|\\})`, 'm');
            const match = raw.match(regex);
            if (match && match[1]) {
              try {
                const cleanedBlock = match[1].replace(/[\u0000-\u001F]/g, (c) => {
                  if (c === '\n') return '\\n';
                  if (c === '\r') return '\\r';
                  if (c === '\t') return '\\t';
                  return '';
                });
                partialData[key] = JSON.parse(cleanedBlock);
              } catch {
                // skip this block if unparseable
              }
            }
          }
          if (Object.keys(partialData).length > 0) {
            console.log(`[Persistence] Salvaged ${Object.keys(partialData).join(', ')} from corrupted store data.`);
            return partialData;
          }
        } catch {
          // ignore
        }

        throw err1;
      }
    }
  }
}

// HELPER: Reconcile ERP Sales Invoices, Customer Balances and Receivables
function reconcileErpSalesAndReceivables() {
  try {
    // 1. Synchronize all sales documents with linked orders or item sums
    salesDocsDB.forEach((doc: any) => {
      const orderNum = (doc.docNumber || '').replace(/^INV-/, '').replace(/^#/, '');
      const linkedOrder = ordersDB.find(
        (o) =>
          o.id === doc.id ||
          `sdoc-inv-${o.id}` === doc.id ||
          o.orderNumber === orderNum ||
          `APX-${orderNum}` === o.orderNumber ||
          (o.orderNumber && doc.notes?.includes(o.orderNumber))
      );

      if (linkedOrder && Array.isArray(linkedOrder.items) && linkedOrder.items.length > 0) {
        doc.items = linkedOrder.items.map((it: any, idx: number) => {
          const itemPrice = Number(it.price ?? it.unitPrice ?? 0);
          const itemQty = Number(it.quantity || 1);
          return {
            id: it.id || `line-${idx}`,
            productId: it.productId || `prod-${idx}`,
            productName: it.name || it.productName || 'Hardware Component',
            sku: it.sku || `SKU-${idx + 100}`,
            category: it.category || 'Hardware',
            quantity: itemQty,
            unitCostPkr: productsDB.find((p) => p.id === it.productId)?.costPrice ?? 0,
            unitPricePkr: itemPrice,
            discountPkr: 0,
            taxRatePercent: 0,
            taxAmountPkr: 0,
            totalPkr: itemPrice * itemQty,
            warehouseId: 'lahore_hafeez',
            serialNumber: it.serialNumber,
            serialNumbers: it.serialNumbers || (it.serialNumber ? [it.serialNumber] : undefined),
          };
        });

        const itemsSum = doc.items.reduce((s: number, it: any) => s + (Number(it.totalPkr) || 0), 0);
        doc.subtotalPkr = itemsSum;
        doc.shippingChargesPkr = Number(linkedOrder.shippingFee) || (itemsSum >= 100000 ? 0 : 1500);
        doc.totalDiscountPkr = Number(linkedOrder.discount) || 0;
        doc.totalGstTaxPkr = 0;
        doc.grandTotalPkr = itemsSum + (doc.shippingChargesPkr || 0) - (doc.totalDiscountPkr || 0);
        doc.balanceDuePkr = Math.max(0, doc.grandTotalPkr - (Number(doc.paidAmountPkr) || 0));
      } else if (Array.isArray(doc.items) && doc.items.length > 0) {
        const itemsSum = doc.items.reduce(
          (s: number, it: any) => s + (Number(it.totalPkr) || Number(it.unitPricePkr || it.price || 0) * Number(it.quantity || 1)),
          0
        );
        if (itemsSum > 0 && doc.grandTotalPkr <= 1500 && itemsSum > 1500) {
          doc.subtotalPkr = itemsSum;
          doc.shippingChargesPkr = Number(doc.shippingChargesPkr) || 0;
          doc.grandTotalPkr = itemsSum + (doc.shippingChargesPkr || 0) - (Number(doc.totalDiscountPkr) || 0);
          doc.balanceDuePkr = Math.max(0, doc.grandTotalPkr - (Number(doc.paidAmountPkr) || 0));
        }
      }
    });

    // 2. Re-calculate customer current balances and total sales
    customersDB.forEach((cust) => {
      const custInvoices = salesDocsDB.filter(
        (d: any) =>
          (d.customerId === cust.id || d.customerName === cust.name || (cust.phone && d.customerPhone === cust.phone)) &&
          d.status !== 'CANCELLED' &&
          d.status !== 'DRAFT'
      );
      if (custInvoices.length > 0) {
        cust.totalSalesPkr = custInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotalPkr) || 0), 0);
        const totalBalance = custInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDuePkr) || 0), 0);
        cust.currentBalancePkr = totalBalance;
        cust.totalReceivablesPkr = totalBalance;
      }
    });
  } catch (e) {
    console.warn('reconcileErpSalesAndReceivables notice:', e);
  }
}

function loadPersistedData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      let data: any = null;
      try {
        data = safeParseStoreJson(raw);
      } catch (parseErr: any) {
        console.warn(`[Persistence] Notice: Recovering from unparseable store data (${parseErr?.message || parseErr}). Creating backup...`);
        try {
          const backupPath = path.join(process.cwd(), `store_data.corrupted.${Date.now()}.bak`);
          fs.writeFileSync(backupPath, raw, 'utf-8');
        } catch {
          // ignore backup err
        }
      }

      if (data && typeof data === 'object') {
        if (Array.isArray(data.deletedProductIds)) {
          deletedProductIdsDB = data.deletedProductIds;
        }

        if (Array.isArray(data.orders)) {
          ordersDB = data.orders.map((o: any) => {
            if (Array.isArray(o.items) && o.items.length > 0) {
              const itemSum = o.items.reduce((sum: number, it: any) => {
                const p = Number(it.price ?? it.unitPrice ?? 0);
                const q = Number(it.quantity || 1);
                return sum + p * q;
              }, 0);
              if (itemSum > 0 && (!o.subtotal || o.subtotal === 0 || o.total <= (o.shippingFee || 1500))) {
                const subtotal = itemSum;
                const shippingFee = Number(o.shippingFee) || (subtotal >= 100000 ? 0 : 1500);
                const discount = Number(o.discount) || 0;
                const total = Math.max(0, subtotal + shippingFee - discount);
                return {
                  ...o,
                  subtotal,
                  shippingFee,
                  total,
                };
              }
            }
            return o;
          });
        }
        
        if (Array.isArray(data.products) && data.products.length > 0) {
          // Strictly retain only products that haven't been deleted
          productsDB = data.products.filter((p: any) => !deletedProductIdsDB.includes(p.id));
        } else if (Array.isArray(INITIAL_PRODUCTS) && INITIAL_PRODUCTS.length > 0) {
          productsDB = INITIAL_PRODUCTS.filter((p: any) => !deletedProductIdsDB.includes(p.id));
        } else {
          productsDB = [];
        }

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const existingCatNames = new Set(data.categories.map((c: any) => (c.name || '').toLowerCase()));
          const defaultCategoriesToEnsure: CategoryItem[] = [
            { id: 'cat-pc-case-fans', name: 'PC Case Fans', slug: 'pc-case-fans', icon: '🌀', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80', description: 'Chassis Cooling Fans, 120mm/140mm ARGB, Reverse Blade & High Static Pressure Fans', brands: ['Lian Li', 'Corsair', 'Thermalright', 'Darkflash', 'DeepCool', 'Noctua', 'NZXT'], createdAt: new Date().toISOString() },
          ];
          defaultCategoriesToEnsure.forEach((cat) => {
            if (!existingCatNames.has(cat.name.toLowerCase())) {
              data.categories.push(cat);
            }
          });
          categoriesDB = data.categories;
        }
        
        if (Array.isArray(data.users)) {
          usersDB = data.users;
          // Ensure owner is present with valid credentials without wiping stored password
          const ownerIndex = usersDB.findIndex((u) => u.isOwner || u.username === OWNER_USERNAME || u.email === OWNER_EMAIL);
          if (ownerIndex >= 0) {
            usersDB[ownerIndex] = {
              ...usersDB[ownerIndex],
              username: OWNER_USERNAME,
              email: OWNER_EMAIL,
              password: usersDB[ownerIndex].password || hashPassword(OWNER_PASSWORD),
              role: 'admin',
              isOwner: true,
            };
          } else {
            usersDB.unshift({
              id: 'user-owner-1',
              fullName: 'Hammad Ur Rehman (Owner)',
              username: OWNER_USERNAME,
              email: OWNER_EMAIL,
              password: hashPassword(OWNER_PASSWORD),
              phone: '+447597030688',
              city: 'Lahore',
              address: 'Shop #G-14, Ground Floor, Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan',
              role: 'admin',
              isOwner: true,
              createdAt: new Date().toISOString(),
            });
          }
        }
        if (Array.isArray(data.serials)) {
          serialsDB = data.serials;
        } else {
          serialsDB = [];
        }
        if (Array.isArray(data.movements)) movementsDB = data.movements;
        else movementsDB = [];
        if (Array.isArray(data.purchaseDocs)) purchaseDocsDB = data.purchaseDocs;
        else purchaseDocsDB = [];
        if (Array.isArray(data.vendors)) vendorsDB = data.vendors;
        else vendorsDB = [];
        if (Array.isArray(data.salesDocs)) salesDocsDB = data.salesDocs;
        else salesDocsDB = [];
        if (Array.isArray(data.vouchers)) vouchersDB = data.vouchers;
        else vouchersDB = [];
        if (Array.isArray(data.customers)) customersDB = data.customers;
        else customersDB = [];
        if (data.accountingControls) accountingControls = { lockDate: data.accountingControls.lockDate || '', audit: data.accountingControls.audit || [] };
        if (Array.isArray(data.bankAccounts) && data.bankAccounts.length) bankAccountsDB = data.bankAccounts;
        if (Array.isArray(data.alerts)) alertsDB = data.alerts;
        else alertsDB = [];
        if (Array.isArray(data.wishlist)) wishlistDB = data.wishlist;
        else wishlistDB = [];
        if (Array.isArray(data.categoryAttributes) && data.categoryAttributes.length > 0) {
          // Merge existing persisted schemas with any new category schemas from defaults
          const existingMap = new Map(data.categoryAttributes.map((s: CategoryAttributeSchema) => [s.category.toLowerCase(), s]));
          DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS.forEach((defaultSchema) => {
            if (!existingMap.has(defaultSchema.category.toLowerCase())) {
              data.categoryAttributes.push(defaultSchema);
            }
          });
          categoryAttributesDB = data.categoryAttributes;
        } else {
          categoryAttributesDB = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS));
        }

        if (data.storeSettings && typeof data.storeSettings === 'object') {
          storeSettings = { ...storeSettings, ...data.storeSettings, adminUsername: OWNER_USERNAME };
        }
        reconcileErpSalesAndReceivables();
        console.log(`[Persistence] Loaded ${ordersDB.length} orders, ${productsDB.length} products, ${categoriesDB.length} categories, ${categoryAttributesDB.length} category schemas, ${usersDB.length} users, ${serialsDB.length} serials, ${movementsDB.length} movements, ${alertsDB.length} price alerts, ${wishlistDB.length} wishlist items.`);
      } else {
        throw new Error('Store data is invalid. Restore a valid backup before starting.');
        productsDB = [];
        serialsDB = [];
        movementsDB = [];
        categoryAttributesDB = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS));
      }
      savePersistedData();
    } else {
      productsDB = (INITIAL_PRODUCTS || []).map(p => ({ ...p, stock: 0 }));
      serialsDB = [];
      movementsDB = [];
      categoryAttributesDB = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS));
      savePersistedData();
    }
  } catch (err) {
    throw new Error('Cannot load store data safely. Original data has been preserved.', { cause: err });
  }
}

function savePersistedData() {
  usersDB.forEach(user => { if (user.password && !user.password.startsWith('scrypt:')) user.password = hashPassword(user.password); });
  try {
    const payload = {
      orders: ordersDB,
      products: productsDB,
      deletedProductIds: deletedProductIdsDB,
      categories: categoriesDB,
      categoryAttributes: categoryAttributesDB,
      users: usersDB,
      serials: serialsDB,
      movements: movementsDB,
      purchaseDocs: purchaseDocsDB,
      vendors: vendorsDB,
      salesDocs: salesDocsDB,
      vouchers: vouchersDB,
      customers: customersDB,
      bankAccounts: bankAccountsDB,
      accountingControls,
      alerts: alertsDB,
      wishlist: wishlistDB,
      storeSettings: storeSettings,
      lastSaved: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, jsonString, 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('[Persistence] Save failed; original file retained.');
    throw err;
  }
}

// Helper to sanitize hardware specifications based on product category
function sanitizeProductSpecifications(category: string, specs?: any): any {
  if (!specs || typeof specs !== 'object') return {};
  const catLower = (category || '').toLowerCase();
  const isCpu = catLower === 'processor' || catLower === 'cpu' || (catLower.includes('processor') && !catLower.includes('cooler'));
  const isGpu = catLower.includes('graphic') || catLower.includes('gpu') || catLower.includes('video card');
  const isMobo = catLower.includes('motherboard') || catLower.includes('mobo');
  const isRam = catLower.includes('ram') || catLower.includes('memory');
  const isPsu = catLower.includes('power supply') || catLower.includes('psu');
  const isCooler = catLower.includes('cooler');
  const isCasing = catLower.includes('casing') || catLower.includes('case');
  const isPrebuilt = catLower.includes('pre-built') || catLower.includes('prebuilt') || catLower.includes('pc build');

  const clean: any = { ...specs };

  if (!(isCpu || isMobo || isCooler || isPrebuilt)) {
    delete clean.socket;
  }
  if (!(isCpu || isPrebuilt)) {
    delete clean.cores;
    delete clean.threads;
  }
  if (!(isCpu || isGpu || isPrebuilt)) {
    delete clean.baseClockGhz;
    delete clean.boostClockGhz;
  }
  if (!(isRam || isMobo || isCpu || isPrebuilt)) {
    delete clean.ramType;
  }
  if (!(isMobo || isPsu || isCasing || isPrebuilt)) {
    delete clean.formFactor;
  }
  if (!(isGpu || isPrebuilt)) {
    delete clean.vramGb;
    delete clean.recommendedPsuWatts;
  }
  if (!(isCpu || isGpu || isCooler || isPrebuilt)) {
    delete clean.tdpWatts;
  }
  if (!(isPsu || isPrebuilt)) {
    delete clean.psuWattage;
  }

  return clean;
}

// Initial load
loadPersistedData();
// Sanitize and enrich all products upon startup
productsDB.forEach((p) => {
  const enriched = generateAccurateProductAttributes(p);
  p.specifications = sanitizeProductSpecifications(p.category, {
    ...p.specifications,
    ...enriched.specifications,
    customAttributes: {
      ...(enriched.customAttributes || {}),
    },
  });
});
savePersistedData();

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
const missingKeyMessage = `⚠️ **API Key Missing**

It looks like you're running the app locally but haven't configured your Gemini API key. 

To enable the AI Rig Master:
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a \`.env\` file in the root folder of your project
3. Add \`GEMINI_API_KEY=your_key_here\`
4. Restart the server.`;

  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
  // Per environment constraints, dev server must run on port 3000. Port 8080 is reserved for Nginx ingress.
  const candidatePort = (!isNaN(cliPort) && cliPort > 0)
    ? cliPort
    : (process.env.PORT && Number(process.env.PORT) !== 8080 ? Number(process.env.PORT) : 3000);
  const PORT = candidatePort === 8080 ? 3000 : candidatePort;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Same-origin cookies carry server-verified identities; browser flags are not authorization.
  const loginAttempts = new Map<string, { count: number; until: number }>();
  app.use('/api', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host && req.headers.origin !== process.env.APP_URL)
          return res.status(403).json({ error: 'Cross-origin writes are not allowed.' });
      } catch { return res.status(403).json({ error: 'Invalid origin.' }); }
    }
    if (req.path.startsWith('/auth/') && req.path.includes('login')) {
      const key = req.ip || 'unknown';
      for (const [k, a] of loginAttempts) if (a.until < Date.now()) loginAttempts.delete(k);
      const attempt = loginAttempts.get(key) || { count: 0, until: Date.now() + 60000 };
      attempt.count++;
      loginAttempts.set(key, attempt);
      if (attempt.count > 20) return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
    }
    const publicRead = req.method === 'GET' && (/^\/(health|settings|products|categories|category-attributes|tracking)(\/|$)/.test(req.path) || req.path === '/orders/lookup' || req.path === '/auth/me');
    const publicWrite = req.method === 'POST' && (req.path.startsWith('/auth/') || ['/orders', '/alerts/price-drop', '/ai/chat', '/ai/chat/stream', '/ai/build-assistant'].includes(req.path));
    if (publicRead || publicWrite) {
      const u = usersDB.find(u => u.id === sessionUserId(req));
      if (req.path === '/orders' && req.method === 'POST' && u?.role === 'admin' && (!can(u, 'sales', 'write') || !can(u, 'sales', 'post'))) return res.status(403).json({ error: 'Sales entry and posting rights required.' });
      return next();
    }
    const user = usersDB.find(u => u.id === sessionUserId(req));
    if (!user) return res.status(401).json({ error: 'Please sign in again.' });
    if ((['/auth/me', '/wishlist', '/alerts/price-drop'].includes(req.path) || (['/orders', '/user/orders'].includes(req.path) && user.role !== 'admin')) && req.method === 'GET') return next();
    if (req.path === '/wishlist' || req.path.startsWith('/wishlist/') || req.path.startsWith('/alerts/price-drop/')) return next();
    if (user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    // Versioned accounting endpoints apply company membership and resource/action permissions themselves.
    if (req.path.startsWith('/v1/')) return next();
    if ((req.path.startsWith('/admin/users') || req.path === '/admin/clean-slate') && !user.isOwner)
      return res.status(403).json({ error: 'Owner access required.' });
    const module = routeModule(req.path);
    if (!(req.path === '/erp/workspace' && req.method === 'GET') && !user.isOwner) {
      const action = req.method === 'GET' ? 'view' : req.method === 'DELETE' ? 'delete' : /\/(approve|receipts|payments)$/.test(req.path) || req.path === '/erp/vouchers' ? 'post' : 'write';
      if (!module || !can(user, module, action)) return res.status(403).json({ error: 'The owner has not granted this action for your account.' });
      if (/\/(receipts|payments)$/.test(req.path) && !can(user, 'banking', 'post')) return res.status(403).json({ error: 'Banking posting rights are required to settle a document.' });
      if (!['GET','HEAD'].includes(req.method) && /^\/orders\//.test(req.path) && (!can(user, 'sales', 'post') || !can(user, 'orders', 'post'))) return res.status(403).json({ error: 'Sales and order posting rights required to modify order financial status.' });
      if (req.method === 'POST' && /^\/inventory\//.test(req.path) && (!can(user, 'purchases', 'post') || !can(user, 'inventory', 'post'))) return res.status(403).json({ error: 'Purchase and inventory posting rights required for stock intake.' });
      if (['POST', 'PUT'].includes(req.method) && /^\/erp\/(sales|purchase)-docs$|^\/erp\/(sales|purchase)-docs\/[^/]+$/.test(req.path) && req.body.status !== 'DRAFT' && !can(user, module, 'post')) return res.status(403).json({ error: 'Posting rights required. Save as a draft for approval.' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && /^\/erp\/(sales-docs|purchase-docs|vouchers)/.test(req.path)) {
      const docs = req.path.includes('sales-docs') ? salesDocsDB : req.path.includes('purchase-docs') ? purchaseDocsDB : vouchersDB;
      const id = req.path.split('/')[3] || req.body.id;
      const previous = docs.find(d => d.id === id || d.docNumber === id || d.voucherNumber === id);
      const settlement = /\/(receipts|payments)$/.test(req.path);
      if (accountingControls.lockDate && [req.body.issueDate || req.body.date, !settlement && (previous?.issueDate || previous?.date)].some(date => date && date <= accountingControls.lockDate)) return res.status(409).json({ error: 'This accounting period is locked by the owner.' });
      if (previous && !['DRAFT'].includes(previous.status) && !settlement && !/\/convert$/.test(req.path) && !user.isOwner && module && !can(user, module, 'post')) return res.status(403).json({ error: 'Posting rights are required to change a posted document.' });
      if (previous && !settlement && !/\/(convert|approve)$/.test(req.path) && ['POST', 'PUT'].includes(req.method)) {
        const linked = vouchersDB.filter(v => v.invoiceId === previous.id || v.billId === previous.id);
        if (linked.length && (req.body.id !== previous.id || req.body.type !== previous.type || req.body.customerId !== previous.customerId || req.body.vendorId !== previous.vendorId || req.body.paidAmountPkr !== previous.paidAmountPkr || req.body.grandTotalPkr < previous.paidAmountPkr || ['DRAFT', 'CANCELLED', 'REJECTED'].includes(req.body.status))) return res.status(409).json({ error: 'Allocated payments must be retained. Party, type and paid amount cannot be changed.' });
      }
    }
    next();
  });
  const accountingDB = {
    get: () => ({ salesDocsDB, purchaseDocsDB, customersDB, vendorsDB, bankAccountsDB, vouchersDB, accountingControls, ordersDB }),
    set: (s: any) => { ({ salesDocsDB, purchaseDocsDB, customersDB, vendorsDB, bankAccountsDB, vouchersDB, accountingControls } = s); },
  };
  registerLinkedAccounting(app, accountingDB, savePersistedData, req => usersDB.find(u => u.id === sessionUserId(req)));
  const books = new Books(process.env.ACCOUNTING_DB || `${DATA_FILE}.accounting.sqlite`);
  registerBooks(app, books, req => usersDB.find(u => u.id === sessionUserId(req)), () => ({ products: productsDB, customers: customersDB, suppliers: vendorsDB, banks: bankAccountsDB, users: usersDB.map(u => ({ id: u.id, role: u.role, isOwner: u.isOwner })) }));
  app.put('/api/admin/users/:id/permissions', (req, res) => {
    const user = usersDB.find(u => u.id === req.params.id);
    if (!user || user.role !== 'admin' || user.isOwner) return res.status(400).json({ error: 'Choose a staff administrator. Owner access cannot be reduced.' });
    const old = structuredClone({ usersDB, accountingControls });
    try {
      user.permissions = normalizePermissions(req.body.permissions);
      accountingControls.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: usersDB.find(u => u.id === sessionUserId(req))!.fullName, action: 'Updated access for ' + user.fullName });
      savePersistedData(); res.json({ success: true, user: sanitizeUser(user) });
    } catch (e: any) { ({ usersDB, accountingControls } = old); res.status(400).json({ error: e.message }); }
  });
  app.post('/api/auth/logout', (req, res) => { endSession(req, res); res.json({ success: true }); });
  app.get('/api/auth/me', (req, res) => {
    const uid = sessionUserId(req);
    const u = uid ? usersDB.find(usr => usr.id === uid) : null;
    res.json({ user: u ? sanitizeUser(u) : null });
  });

  // Helper for Gemini AI client
  function getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      httpOptions: { apiVersion: "v1alpha" },
      apiKey
    });
  }

  // --- API ROUTES ---

  // Disable aggressive HTTP caching for all dynamic API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), productsCount: productsDB.length });
  });

  // Store Settings
  app.get('/api/settings', (req, res) => {
    res.json(storeSettings);
  });

  app.put('/api/settings', (req, res) => {
    storeSettings = { ...storeSettings, ...req.body };
    savePersistedData();
    res.json({ success: true, settings: storeSettings });
  });

  // BOTTLENECK CALCULATOR: GAMES PERSISTENCE & CRUD
  const BOTTLENECK_GAMES_FILE = path.resolve(process.cwd(), 'bottleneck_games.json');
  let bottleneckGamesDB: any[] = [];
  try {
    if (fs.existsSync(BOTTLENECK_GAMES_FILE)) {
      bottleneckGamesDB = JSON.parse(fs.readFileSync(BOTTLENECK_GAMES_FILE, 'utf-8'));
    }
  } catch (e) {
    bottleneckGamesDB = [];
  }
  const saveBottleneckGames = () => {
    try {
      fs.writeFileSync(BOTTLENECK_GAMES_FILE, JSON.stringify(bottleneckGamesDB, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Bottleneck] Failed to save bottleneck games:', err);
    }
  };

  app.get('/api/bottleneck-games', (req, res) => {
    res.json({ games: bottleneckGamesDB });
  });

  app.post('/api/bottleneck-games', (req, res) => {
    const gameData = req.body;
    if (!gameData || !gameData.title) {
      return res.status(400).json({ error: 'Game title is required' });
    }
    const newGame = {
      ...gameData,
      id: gameData.id || `custom-game-${Date.now()}`,
      releaseYear: parseInt(gameData.releaseYear, 10) || new Date().getFullYear(),
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
    bottleneckGamesDB.unshift(newGame);
    saveBottleneckGames();
    res.json({ success: true, game: newGame });
  });

  app.put('/api/bottleneck-games/:id', (req, res) => {
    const { id } = req.params;
    const idx = bottleneckGamesDB.findIndex((g) => g.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Game not found' });
    }
    bottleneckGamesDB[idx] = {
      ...bottleneckGamesDB[idx],
      ...req.body,
      id,
      updatedAt: new Date().toISOString(),
    };
    saveBottleneckGames();
    res.json({ success: true, game: bottleneckGamesDB[idx] });
  });

  app.delete('/api/bottleneck-games/:id', (req, res) => {
    const { id } = req.params;
    bottleneckGamesDB = bottleneckGamesDB.filter((g) => g.id !== id);
    saveBottleneckGames();
    res.json({ success: true, message: 'Game deleted successfully' });
  });

  // PRODUCTS: GET All
  app.get('/api/products', (req, res) => {
    const { category, brand, search, inStockOnly } = req.query;
    let filtered = [...productsDB];

    if (category && category !== 'All') {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (brand && brand !== 'All') {
      filtered = filtered.filter((p) => p.brand.toLowerCase().includes(String(brand).toLowerCase()));
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (inStockOnly === 'true') {
      filtered = filtered.filter((p) => p.inStock && p.stockCount > 0);
    }

    res.json(filtered);
  });

  // PRODUCTS: GET Single
  app.get('/api/products/:id', (req, res) => {
    const product = productsDB.find((p) => p.id === req.params.id || p.sku === req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  });

  // PRODUCTS: CREATE (Admin)
  app.post('/api/products', (req, res) => {
    const generatedSku = req.body.sku?.trim() || generateProductSKU(req.body, productsDB);
    const initialStock = Number(req.body.stockCount ?? 0);
    if (!Number.isInteger(initialStock) || initialStock < 0) return res.status(400).json({ error: 'Stock must be a nonnegative whole number.' });
    const primarySerial = req.body.serialNumber?.trim() || generateSerialNumber({ ...req.body, sku: generatedSku }, 1);

    const newProduct: Product = {
      id: req.body.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sku: generatedSku,
      serialNumber: primarySerial,
      name: req.body.name || 'New Hardware Product',
      brand: req.body.brand || 'Apex',
      category: req.body.category || 'Processor',
      price: Number(req.body.price) || 0,
      costPrice: Number(req.body.costPrice) || 0,
      originalPrice: req.body.originalPrice ? Number(req.body.originalPrice) : undefined,
      description: req.body.description || '',
      inStock: req.body.inStock ?? true,
      stockCount: initialStock,
      featured: req.body.featured ?? false,
      isVariable: req.body.isVariable ?? false,
      variants: req.body.variants || [],
      image: req.body.image || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80',
      additionalImages: req.body.additionalImages || [],
      specifications: sanitizeProductSpecifications(
        req.body.category || 'Processor',
        req.body.specifications || {}
      ),
      rating: 5.0,
      reviewCount: 1,
      tags: req.body.tags || [],
      createdAt: new Date().toISOString(),
    };

    productsDB.unshift(newProduct);

    // Automatically create sequential serial numbers in serialsDB for every unit in stock
    const autoCreatedSerials: SerialNumberItem[] = [];
    const countToGenerate = Math.min(initialStock, 100);
    const warrantyMonths = Number(newProduct.specifications?.warrantyMonths) || 36;
    const todayStr = new Date().toISOString().split('T')[0];
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);
    const expiryStr = expiryDate.toISOString().split('T')[0];
    const unitCost = Number((newProduct as any).costPrice) || Math.round(newProduct.price * 0.88);

    for (let i = 1; i <= countToGenerate; i++) {
      const snCode = i === 1 && req.body.serialNumber?.trim()
        ? req.body.serialNumber.trim().toUpperCase()
        : generateSerialNumber(newProduct, i);

      // Avoid duplicate serials
      if (!serialsDB.some((s) => s.serialNumber.toUpperCase() === snCode.toUpperCase())) {
        const snItem: SerialNumberItem = {
          id: `sn-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          serialNumber: snCode,
          productId: newProduct.id,
          productName: newProduct.name,
          sku: newProduct.sku,
          brand: newProduct.brand,
          category: newProduct.category,
          costPrice: unitCost,
          sellingPrice: newProduct.price,
          status: 'In Stock',
          warrantyPeriodMonths: warrantyMonths,
          warrantyExpiryDate: expiryStr,
          purchasedDate: todayStr,
          supplier: 'Apex Inward Distribution',
          notes: 'Auto-generated on product catalog creation',
          createdAt: new Date().toISOString(),
        };
        serialsDB.unshift(snItem);
        autoCreatedSerials.push(snItem);
      }
    }

    savePersistedData();
    res.status(201).json({
      ...newProduct,
      generatedSerialsCount: autoCreatedSerials.length,
      generatedSerials: autoCreatedSerials,
    });
  });

  // PRODUCTS: UPDATE (Admin)
  app.put('/api/products/:id', (req, res) => {
    const index = productsDB.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updatedProduct = {
      ...productsDB[index],
      ...req.body,
      id: req.params.id, // preserve ID
    };

    if (req.body.price !== undefined) {
      updatedProduct.price = Number(req.body.price) || 0;
    }

    if (req.body.costPrice !== undefined) {
      updatedProduct.costPrice = Math.max(0, Number(req.body.costPrice) || 0);
    }

    if (req.body.stockCount !== undefined) {
      const stockNum = Math.max(0, Number(req.body.stockCount) || 0);
      updatedProduct.stockCount = stockNum;
      updatedProduct.inStock = stockNum > 0;
    } else if (req.body.inStock !== undefined) {
      updatedProduct.inStock = Boolean(req.body.inStock);
    }

    if (req.body.ean !== undefined) {
      updatedProduct.ean = String(req.body.ean || '').trim();
      updatedProduct.barcode = updatedProduct.ean;
    }

    if (req.body.barcode !== undefined && !updatedProduct.ean) {
      updatedProduct.barcode = String(req.body.barcode || '').trim();
      updatedProduct.ean = updatedProduct.barcode;
    }

    if (req.body.serialNumber !== undefined) {
      updatedProduct.serialNumber = String(req.body.serialNumber || '').trim();
    }

    if (req.body.originalPrice === null || req.body.originalPrice === undefined || req.body.originalPrice === '' || Number(req.body.originalPrice) === 0) {
      delete updatedProduct.originalPrice;
    } else {
      updatedProduct.originalPrice = Number(req.body.originalPrice);
    }

    if (updatedProduct.specifications) {
      updatedProduct.specifications = sanitizeProductSpecifications(
        updatedProduct.category,
        updatedProduct.specifications
      );
    }

    productsDB[index] = updatedProduct;
    savePersistedData();

    res.json(productsDB[index]);
  });

  // PRODUCTS: DELETE (Admin)
  app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    const index = productsDB.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const removed = productsDB.splice(index, 1);
    if (!deletedProductIdsDB.includes(id)) {
      deletedProductIdsDB.push(id);
    }
    serialsDB = serialsDB.filter((s) => s.productId !== id);
    savePersistedData();
    res.json({ success: true, removed: removed[0] });
  });

  // PRODUCTS: CLEAR CATALOGUE (Admin) - Seed starter is removed; once deleted, products stay deleted
  app.post('/api/products/manage/reset', (req, res) => {
    const { action } = req.body;
    if (action === 'clear') {
      productsDB.forEach((p) => {
        if (!deletedProductIdsDB.includes(p.id)) {
          deletedProductIdsDB.push(p.id);
        }
      });
      productsDB = [];
      savePersistedData();
      return res.json({ success: true, message: 'All products cleared.', count: 0 });
    } else {
      return res.status(400).json({ error: 'Seed starter has been disabled. Once deleted, products stay deleted.' });
    }
  });

  // PRODUCTS: SET ALL STOCK TO 0
  app.post('/api/products/manage/zero-stock', (req, res) => {
    productsDB.forEach((p: any) => {
      p.stock = 0;
      p.stockCount = 0;
      p.inStock = false;
      if (Array.isArray(p.variants)) {
        p.variants.forEach((v: any) => {
          v.stock = 0;
        });
      }
    });
    savePersistedData();
    return res.json({ success: true, message: 'Every product stock set to 0.', count: productsDB.length });
  });

  // CATEGORIES: GET All
  app.get('/api/categories', (req, res) => {
    // Augment each category with dynamic product count
    const enriched = categoriesDB.map((cat) => {
      const count = productsDB.filter((p) => p.category === cat.name).length;
      // Also get all distinct brands in this category from products
      const categoryProducts = productsDB.filter((p) => p.category === cat.name);
      const productBrands = Array.from(new Set(categoryProducts.map((p) => p.brand).filter(Boolean)));
      const mergedBrands = Array.from(new Set([...(cat.brands || []), ...productBrands]));
      return {
        ...cat,
        productCount: count,
        brands: mergedBrands,
      };
    });
    res.json(enriched);
  });

  // CATEGORIES: CREATE
  app.post('/api/categories', (req, res) => {
    try {
      const { name, icon, image, bannerImage, description, brands } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      const trimmedName = name.trim();
      const existing = categoriesDB.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'Category already exists' });
      }

      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const parsedBrands = Array.isArray(brands)
        ? brands
        : typeof brands === 'string'
        ? brands.split(',').map((b) => b.trim()).filter(Boolean)
        : [];

      const newCategory: CategoryItem = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        slug,
        icon: icon || '📦',
        image: image || undefined,
        bannerImage: bannerImage || undefined,
        description: description || '',
        brands: parsedBrands,
        isCustom: true,
        createdAt: new Date().toISOString(),
      };

      categoriesDB.push(newCategory);
      savePersistedData();
      res.status(201).json({ success: true, category: newCategory });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to create category' });
    }
  });

  // CATEGORIES: UPDATE (Edit existing category)
  app.put('/api/categories/:id', (req, res) => {
    try {
      const { name, icon, image, bannerImage, description, brands } = req.body;
      const catId = req.params.id;
      const catIndex = categoriesDB.findIndex(
        (c) => c.id === catId || c.slug === catId || c.name.toLowerCase() === catId.toLowerCase()
      );

      if (catIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const existingCat = categoriesDB[catIndex];
      const oldName = existingCat.name;
      const newName = name && typeof name === 'string' && name.trim() ? name.trim() : existingCat.name;

      const parsedBrands = Array.isArray(brands)
        ? brands
        : typeof brands === 'string'
        ? brands.split(',').map((b) => b.trim()).filter(Boolean)
        : existingCat.brands;

      const updatedCategory: CategoryItem = {
        ...existingCat,
        name: newName,
        slug: newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        icon: icon !== undefined ? icon : existingCat.icon,
        image: image !== undefined ? image : existingCat.image,
        bannerImage: bannerImage !== undefined ? bannerImage : existingCat.bannerImage,
        description: description !== undefined ? description : existingCat.description,
        brands: parsedBrands,
      };

      categoriesDB[catIndex] = updatedCategory;

      // If category name was renamed, update existing products with old category name
      if (oldName !== newName) {
        productsDB.forEach((p) => {
          if (p.category === oldName) {
            p.category = newName;
          }
        });
      }
      savePersistedData();

      res.json({ success: true, category: updatedCategory });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to update category' });
    }
  });

  // CATEGORIES: DELETE
  app.delete('/api/categories/:id', (req, res) => {
    const index = categoriesDB.findIndex((c) => c.id === req.params.id || c.name === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const removed = categoriesDB.splice(index, 1);
    savePersistedData();
    res.json({ success: true, removed: removed[0] });
  });

  // --- CATEGORY HARDWARE ATTRIBUTE SCHEMAS (Dynamic Spec Engine) ---

  // GET all category attribute schemas
  app.get('/api/category-attributes', (req, res) => {
    try {
      res.json({ success: true, schemas: categoryAttributesDB });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to fetch category schemas' });
    }
  });

  // GET single category attribute schema by category name or id
  app.get('/api/category-attributes/:id', (req, res) => {
    try {
      const target = decodeURIComponent(req.params.id).trim().toLowerCase();
      const schema = categoryAttributesDB.find(
        (s) => s.id.toLowerCase() === target || s.category.toLowerCase() === target
      );
      if (!schema) {
        return res.status(404).json({ success: false, error: 'Category schema not found' });
      }
      res.json({ success: true, schema });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to fetch schema' });
    }
  });

  // CREATE or UPDATE a category attribute schema
  app.post('/api/category-attributes', (req, res) => {
    try {
      const { id, category, description, attributes } = req.body;
      if (!category || typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ success: false, error: 'Category name is required' });
      }

      const catName = category.trim();
      const schemaId = id || `schema-${catName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const validAttributes: CategoryAttributeDefinition[] = Array.isArray(attributes)
        ? attributes.map((attr: any, idx: number) => ({
            id: attr.id ? String(attr.id).trim() : `attr_${idx}_${Date.now()}`,
            name: attr.name ? String(attr.name).trim() : `Attribute ${idx + 1}`,
            type: ['text', 'number', 'select', 'boolean'].includes(attr.type) ? attr.type : 'text',
            unit: attr.unit ? String(attr.unit).trim() : undefined,
            options: Array.isArray(attr.options)
              ? attr.options.map(String).filter(Boolean)
              : typeof attr.options === 'string'
              ? attr.options.split(',').map((o: string) => o.trim()).filter(Boolean)
              : undefined,
            required: Boolean(attr.required),
            placeholder: attr.placeholder ? String(attr.placeholder).trim() : undefined,
            defaultValue: attr.defaultValue !== undefined ? attr.defaultValue : undefined,
            helpText: attr.helpText ? String(attr.helpText).trim() : undefined,
            displayInOverview: attr.displayInOverview !== undefined ? Boolean(attr.displayInOverview) : true,
          }))
        : [];

      const existingIndex = categoryAttributesDB.findIndex(
        (s) => s.id === schemaId || s.category.toLowerCase() === catName.toLowerCase()
      );

      const newSchema: CategoryAttributeSchema = {
        id: schemaId,
        category: catName,
        description: description || `Hardware specifications schema for ${catName}`,
        attributes: validAttributes,
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        categoryAttributesDB[existingIndex] = newSchema;
      } else {
        categoryAttributesDB.push(newSchema);
      }

      savePersistedData();
      res.json({ success: true, schema: newSchema, message: `Hardware schema for ${catName} saved successfully.` });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to save category attribute schema' });
    }
  });

  // PUT single category attribute schema
  app.put('/api/category-attributes/:id', (req, res) => {
    try {
      const categoryFromParam = decodeURIComponent(req.params.id).trim();
      const body = req.body || {};
      const catName = (body.category || categoryFromParam).trim();
      if (!catName) {
        return res.status(400).json({ success: false, error: 'Category name is required' });
      }

      const schemaId = body.id || `schema-${catName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const validAttributes: CategoryAttributeDefinition[] = Array.isArray(body.attributes)
        ? body.attributes.map((attr: any, idx: number) => ({
            id: attr.id ? String(attr.id).trim() : `attr_${idx}_${Date.now()}`,
            name: attr.name ? String(attr.name).trim() : `Attribute ${idx + 1}`,
            type: ['text', 'number', 'select', 'boolean'].includes(attr.type) ? attr.type : 'text',
            unit: attr.unit ? String(attr.unit).trim() : undefined,
            options: Array.isArray(attr.options)
              ? attr.options.map(String).filter(Boolean)
              : typeof attr.options === 'string'
              ? attr.options.split(',').map((o: string) => o.trim()).filter(Boolean)
              : undefined,
            required: Boolean(attr.required),
            placeholder: attr.placeholder ? String(attr.placeholder).trim() : undefined,
            defaultValue: attr.defaultValue !== undefined ? attr.defaultValue : undefined,
            helpText: attr.helpText ? String(attr.helpText).trim() : undefined,
            displayInOverview: attr.displayInOverview !== undefined ? Boolean(attr.displayInOverview) : true,
          }))
        : [];

      const existingIndex = categoryAttributesDB.findIndex(
        (s) => s.id === schemaId || s.category.toLowerCase() === catName.toLowerCase() || s.id.toLowerCase() === categoryFromParam.toLowerCase()
      );

      const newSchema: CategoryAttributeSchema = {
        id: schemaId,
        category: catName,
        description: body.description || `Hardware specifications schema for ${catName}`,
        attributes: validAttributes,
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        categoryAttributesDB[existingIndex] = newSchema;
      } else {
        categoryAttributesDB.push(newSchema);
      }

      savePersistedData();
      res.json({ success: true, schema: newSchema, message: `Hardware schema for ${catName} saved successfully.` });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to update category attribute schema' });
    }
  });

  // DELETE a category attribute schema
  app.delete('/api/category-attributes/:id', (req, res) => {
    try {
      const target = decodeURIComponent(req.params.id).trim().toLowerCase();
      const initialLength = categoryAttributesDB.length;
      categoryAttributesDB = categoryAttributesDB.filter(
        (s) => s.id.toLowerCase() !== target && s.category.toLowerCase() !== target
      );

      if (categoryAttributesDB.length < initialLength) {
        savePersistedData();
        res.json({ success: true, message: 'Category attribute schema deleted successfully' });
      } else {
        res.status(404).json({ success: false, error: 'Category attribute schema not found' });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to delete schema' });
    }
  });

  // RESET all category attribute schemas to defaults
  app.post('/api/category-attributes/reset', (req, res) => {
    try {
      categoryAttributesDB = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS));
      savePersistedData();
      res.json({
        success: true,
        message: 'All category hardware attribute schemas reset to standard defaults',
        schemas: categoryAttributesDB,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to reset schemas' });
    }
  });

  // IMAGE UPLOAD: Handles base64 data URLs, files, or direct image upload payloads
  app.post('/api/upload', (req, res) => {
    try {
      const { image, data, name } = req.body;
      const payload = image || data;
      if (!payload) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      const imageUrl =
        payload.startsWith('data:') || payload.startsWith('http://') || payload.startsWith('https://')
          ? payload
          : `data:image/jpeg;base64,${payload}`;

      res.json({
        success: true,
        url: imageUrl,
        name: name || `upload-${Date.now()}`,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Image upload failed' });
    }
  });

  // IMAGE PROXY: Fetch external images securely with CORS headers for canvas cropping & framing
  app.get('/api/proxy-image', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: 'Missing image url parameter' });
      }
      if (targetUrl.startsWith('data:')) {
        const parts = targetUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const buffer = Buffer.from(parts[1], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(buffer);
      }
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'Invalid URL scheme' });
      }

      let response: Response;
      try {
        response = await fetch(targetUrl, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'image/webp,image/jpeg,image/png,image/*;q=0.8',
          },
        });
      } catch (fetchErr: any) {
        // Generate responsive SVG fallback if network fetch fails
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" fill="#0f172a">
          <rect width="800" height="800" fill="#0b1120"/>
          <circle cx="400" cy="360" r="120" fill="#1e293b" stroke="#3b82f6" stroke-width="4"/>
          <path d="M340 360 L460 360 M400 300 L400 420" stroke="#60a5fa" stroke-width="8" stroke-linecap="round"/>
          <text x="400" y="540" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" text-anchor="middle">Hardware Image Unavailable</text>
          <text x="400" y="580" fill="#64748b" font-family="system-ui, sans-serif" font-size="20" text-anchor="middle">Please upload a file or choose a preset</text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(svg);
      }

      if (!response.ok) {
        // If remote image returned 404/403, provide clean SVG fallback instead of breaking canvas
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" fill="#0f172a">
          <rect width="800" height="800" fill="#0b1120"/>
          <circle cx="400" cy="360" r="120" fill="#1e293b" stroke="#f59e0b" stroke-width="4"/>
          <path d="M340 360 L460 360 M400 300 L400 420" stroke="#fbbf24" stroke-width="8" stroke-linecap="round"/>
          <text x="400" y="540" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" text-anchor="middle">Hardware Image (404 Not Found)</text>
          <text x="400" y="580" fill="#64748b" font-family="system-ui, sans-serif" font-size="20" text-anchor="middle">Source URL removed by host - Upload new image</text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(svg);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to proxy image' });
    }
  });

  // CATALOG SYNC: Disabled - Production Mode with manual product and ledger entries
  app.post('/api/catalog/sync-rbtech', (req, res) => {
    return res.status(400).json({
      success: false,
      error: 'Catalog seed sync has been permanently disabled. All products and ledgers are manually managed.',
    });
  });

  // PRODUCTION RESET: Clean slate wipe for launch
  app.post('/api/admin/clean-slate', (req, res) => {
    try {
      productsDB = [];
      serialsDB = [];
      movementsDB = [];
      ordersDB = [];
      purchaseDocsDB = [];
      vendorsDB = [];
      salesDocsDB = [];
      vouchersDB = [];
      customersDB = [];
      alertsDB = [];
      wishlistDB = [];
      deletedProductIdsDB = [];
      savePersistedData();
      return res.json({
        success: true,
        message: 'All store data, inventory, transactions, and account records have been wiped clean for production launch.',
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Failed to wipe data' });
    }
  });

  // --- INVENTORY & ACCOUNTING ENDPOINTS ---

  // INVENTORY: Summary & Valuation Stats
  app.get('/api/inventory/stats', (req, res) => {
    try {
      let totalUnits = 0;
      let totalCostValuation = 0;
      let totalRetailValuation = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const categoryMap: Record<string, { count: number; units: number; costValuation: number; retailValuation: number }> = {};

      productsDB.forEach((p) => {
        const units = Number(p.stockCount) || 0;
        const retailPrice = Number(p.price) || 0;
        const costPrice = Number(p.costPrice) || Math.round(retailPrice * 0.88);

        totalUnits += units;
        totalCostValuation += costPrice * units;
        totalRetailValuation += retailPrice * units;

        if (units === 0) {
          outOfStockCount++;
        } else if (units <= 5) {
          lowStockCount++;
        }

        const cat = p.category || 'Other';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { count: 0, units: 0, costValuation: 0, retailValuation: 0 };
        }
        categoryMap[cat].count += 1;
        categoryMap[cat].units += units;
        categoryMap[cat].costValuation += costPrice * units;
        categoryMap[cat].retailValuation += retailPrice * units;
      });

      const unrealizedGrossProfit = totalRetailValuation - totalCostValuation;
      const averageMarginPercentage = totalRetailValuation > 0
        ? Math.round((unrealizedGrossProfit / totalRetailValuation) * 100)
        : 0;

      const categoryBreakdown = Object.entries(categoryMap).map(([category, data]) => ({
        category,
        skus: data.count,
        units: data.units,
        costValuation: data.costValuation,
        retailValuation: data.retailValuation,
        profit: data.retailValuation - data.costValuation,
        margin: data.retailValuation > 0 ? Math.round(((data.retailValuation - data.costValuation) / data.retailValuation) * 100) : 0,
      }));

      const activeSerialNumbersInStock = serialsDB.filter((s) => s.status === 'In Stock').length;
      const soldSerialNumbers = serialsDB.filter((s) => s.status === 'Sold').length;
      const rmaSerialNumbers = serialsDB.filter((s) => s.status === 'RMA / Defective').length;

      // Warranty tracking (expiring in <= 30 days & expired)
      const now = new Date();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      let expiringWarrantiesCount = 0;
      let expiredWarrantiesCount = 0;

      serialsDB.forEach((s) => {
        if (!s.warrantyExpiryDate) {
          const base = s.purchasedDate ? new Date(s.purchasedDate) : new Date(s.createdAt || Date.now());
          const d = isNaN(base.getTime()) ? new Date() : new Date(base);
          d.setMonth(d.getMonth() + (s.warrantyPeriodMonths || 36));
          s.warrantyExpiryDate = d.toISOString().split('T')[0];
        }
        const expDate = new Date(s.warrantyExpiryDate);
        if (!isNaN(expDate.getTime())) {
          const diffMs = expDate.getTime() - now.getTime();
          if (diffMs < 0) {
            expiredWarrantiesCount++;
          } else if (diffMs <= thirtyDaysMs) {
            expiringWarrantiesCount++;
          }
        }
      });

      const stats: InventorySummaryStats & {
        categoryBreakdown: typeof categoryBreakdown;
        soldSerialNumbers: number;
        rmaSerialNumbers: number;
      } = {
        totalSkus: productsDB.length,
        totalUnits,
        totalCostValuation,
        totalRetailValuation,
        unrealizedGrossProfit,
        averageMarginPercentage,
        lowStockCount,
        outOfStockCount,
        trackedSerialNumbersCount: serialsDB.length,
        activeSerialNumbersInStock,
        soldSerialNumbers,
        rmaSerialNumbers,
        expiringWarrantiesCount,
        expiredWarrantiesCount,
        categoryBreakdown,
      };

      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to compute inventory valuation stats' });
    }
  });

  // SERIAL NUMBERS: GET List
  app.get('/api/inventory/serials', (req, res) => {
    try {
      const { status, category, search, productId, orderId, warrantyStatus } = req.query;
      let list = [...serialsDB];

      // Ensure warrantyExpiryDate is populated for all returned serials
      const now = new Date();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      list.forEach((s) => {
        if (!s.warrantyExpiryDate) {
          const base = s.purchasedDate ? new Date(s.purchasedDate) : new Date(s.createdAt || Date.now());
          const d = isNaN(base.getTime()) ? new Date() : new Date(base);
          d.setMonth(d.getMonth() + (s.warrantyPeriodMonths || 36));
          s.warrantyExpiryDate = d.toISOString().split('T')[0];
        }
      });

      if (warrantyStatus === 'expiring_soon') {
        list = list.filter((s) => {
          if (!s.warrantyExpiryDate) return false;
          const exp = new Date(s.warrantyExpiryDate).getTime();
          const diff = exp - now.getTime();
          return diff >= 0 && diff <= thirtyDaysMs;
        });
      } else if (warrantyStatus === 'expired') {
        list = list.filter((s) => {
          if (!s.warrantyExpiryDate) return false;
          const exp = new Date(s.warrantyExpiryDate).getTime();
          return exp < now.getTime();
        });
      } else if (warrantyStatus === 'active') {
        list = list.filter((s) => {
          if (!s.warrantyExpiryDate) return true;
          const exp = new Date(s.warrantyExpiryDate).getTime();
          return exp >= now.getTime();
        });
      }

      if (status && status !== 'All') {
        list = list.filter((s) => s.status === status);
      }
      if (category && category !== 'All') {
        list = list.filter((s) => s.category === category);
      }
      if (productId) {
        list = list.filter((s) => s.productId === productId);
      }
      if (orderId) {
        list = list.filter((s) => s.orderId === orderId || s.orderNumber === orderId);
      }
      if (search) {
        const q = String(search).toLowerCase().trim();
        list = list.filter(
          (s) =>
            s.serialNumber.toLowerCase().includes(q) ||
            s.sku.toLowerCase().includes(q) ||
            s.productName.toLowerCase().includes(q) ||
            s.brand.toLowerCase().includes(q) ||
            s.orderNumber?.toLowerCase().includes(q) ||
            s.customerName?.toLowerCase().includes(q) ||
            s.supplier?.toLowerCase().includes(q) ||
            s.notes?.toLowerCase().includes(q)
        );
      }

      res.json(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to retrieve serial numbers' });
    }
  });

  // --- UNIFIED GLOBAL BACKEND OMNI-SEARCH ENGINE ---
  // Searches across Serial Numbers (with Sold-To Customer and Where-Purchased trace), EAN-13, Products, Invoices, and Bills
  app.get('/api/backend/omni-search', (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q) {
        return res.json({ serials: [], products: [], invoices: [], bills: [], customers: [], suppliers: [] });
      }

      // 1. Trace Serial Numbers (Where purchased from & Where sold to)
      const matchedSerials = serialsDB
        .filter((s) =>
          s.serialNumber.toLowerCase().includes(q) ||
          s.sku.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q) ||
          (s.customerName && s.customerName.toLowerCase().includes(q)) ||
          (s.orderNumber && s.orderNumber.toLowerCase().includes(q)) ||
          (s.supplier && s.supplier.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        )
        .slice(0, 30)
        .map((s) => {
          // Find associated product
          const prod = productsDB.find((p) => p.id === s.productId || p.sku === s.sku);

          // Find sales invoice containing this serial or linked to order
          const invoice = salesDocsDB.find(
            (inv) =>
              inv.id === s.invoiceId ||
              inv.docNumber === s.invoiceId ||
              inv.orderId === s.orderId ||
              inv.items?.some((it: any) => it.serialNumbers?.includes(s.serialNumber) || it.productId === s.productId)
          );

          // Find purchase bill containing this serial or linked to supplier
          const bill = purchaseDocsDB.find(
            (b) =>
              b.items?.some((it: any) => it.serialNumbers?.includes(s.serialNumber) || it.productId === s.productId) ||
              (s.supplier && b.vendorName?.toLowerCase() === s.supplier.toLowerCase())
          );

          const customerName = s.customerName || invoice?.customerName || (s.status === 'Sold' ? 'Walk-in Counter Customer' : undefined);
          const customerPhone = s.customerPhone || invoice?.customerPhone;
          const invoiceNumber = s.invoiceId || invoice?.docNumber;
          const supplierName = s.supplier || bill?.vendorName || 'Hafeez Center Procurement';
          const billNumber = bill?.docNumber;

          return {
            ...s,
            productImage: prod?.image,
            productCategory: prod?.category || s.category,
            productEan: (prod as any)?.ean || (prod as any)?.barcode,
            soldToCustomer: customerName,
            soldToPhone: customerPhone,
            soldInvoiceNumber: invoiceNumber,
            soldDate: s.soldDate || invoice?.issueDate,
            soldPrice: s.sellingPrice || invoice?.items?.find((it: any) => it.productId === s.productId)?.unitPricePkr || prod?.price,
            purchasedFromSupplier: supplierName,
            purchaseBillNumber: billNumber,
            purchasedDate: s.purchasedDate || bill?.issueDate,
            purchaseCost: s.costPrice || bill?.items?.find((it: any) => it.productId === s.productId)?.unitCostPkr || prod?.costPrice,
          };
        });

      // 2. Products search by EAN, Barcode, SKU, Name, Brand
      const matchedProducts = productsDB
        .filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          ((p as any).ean && String((p as any).ean).toLowerCase().includes(q)) ||
          ((p as any).barcode && String((p as any).barcode).toLowerCase().includes(q))
        )
        .slice(0, 20)
        .map((p) => {
          const assigned = serialsDB.filter((s) => s.productId === p.id || s.sku === p.sku);
          return {
            ...p,
            totalSerialsCount: assigned.length,
            inStockSerials: assigned.filter((s) => s.status === 'In Stock').map((s) => s.serialNumber),
            soldSerials: assigned.filter((s) => s.status === 'Sold').map((s) => ({
              serialNumber: s.serialNumber,
              customerName: s.customerName,
              invoiceId: s.invoiceId,
            })),
          };
        });

      // 3. Sales Invoices
      const matchedInvoices = salesDocsDB
        .filter((inv) =>
          inv.docNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          (inv.customerPhone && inv.customerPhone.toLowerCase().includes(q)) ||
          inv.items?.some((it: any) =>
            it.productName.toLowerCase().includes(q) ||
            (it.sku && it.sku.toLowerCase().includes(q)) ||
            it.serialNumbers?.some((sn: string) => sn.toLowerCase().includes(q))
          )
        )
        .slice(0, 15);

      // 4. Purchase Bills
      const matchedBills = purchaseDocsDB
        .filter((b) =>
          b.docNumber.toLowerCase().includes(q) ||
          b.vendorName.toLowerCase().includes(q) ||
          b.items?.some((it: any) =>
            it.productName.toLowerCase().includes(q) ||
            (it.sku && it.sku.toLowerCase().includes(q)) ||
            it.serialNumbers?.some((sn: string) => sn.toLowerCase().includes(q))
          )
        )
        .slice(0, 15);

      // 5. Customers and Suppliers
      const matchedCustomers = customersDB
        .filter((c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
        )
        .slice(0, 10);

      const matchedSuppliers = vendorsDB
        .filter((v) =>
          v.name.toLowerCase().includes(q) ||
          (v.companyName && v.companyName.toLowerCase().includes(q)) ||
          (v.phone && v.phone.toLowerCase().includes(q)) ||
          (v.city && v.city.toLowerCase().includes(q))
        )
        .slice(0, 10);

      res.json({
        query: q,
        serials: matchedSerials,
        products: matchedProducts,
        invoices: matchedInvoices,
        bills: matchedBills,
        customers: matchedCustomers,
        suppliers: matchedSuppliers,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Global search failed' });
    }
  });

  // SERIAL NUMBERS: CREATE (Single or Bulk Intake)
  app.post('/api/inventory/serials', (req, res) => {
    try {
      const {
        productId,
        productName,
        sku,
        brand,
        category,
        variantId,
        variantName,
        costPrice,
        sellingPrice,
        warrantyPeriodMonths,
        warrantyExpiryDate,
        purchasedDate,
        supplier,
        notes,
        batchSerials,
        serialNumber,
        countToAutoGenerate,
      } = req.body;

      const targetProduct = productsDB.find((p) => p.id === productId || p.sku === sku);
      const finalProductName = productName || targetProduct?.name || 'Hardware Component';
      const finalSku = sku || targetProduct?.sku || generateProductSKU({ name: finalProductName, brand, category }, productsDB);
      const finalBrand = brand || targetProduct?.brand || 'Apex';
      const finalCategory = category || targetProduct?.category || 'Processor';
      const finalCost = Number(costPrice) || Number(targetProduct?.costPrice) || Math.round((Number(sellingPrice) || Number(targetProduct?.price) || 50000) * 0.88);
      const finalSelling = Number(sellingPrice) || Number(targetProduct?.price) || Math.round(finalCost * 1.15);
      const finalWarranty = Number(warrantyPeriodMonths) || (targetProduct?.specifications?.warrantyMonths as number) || 36;
      const finalPurchased = purchasedDate || new Date().toISOString().split('T')[0];

      // Compute expiry date if not explicitly supplied
      const computeFinalExpiry = (baseDateStr: string, months: number): string => {
        if (warrantyExpiryDate && typeof warrantyExpiryDate === 'string' && warrantyExpiryDate.trim()) {
          return warrantyExpiryDate.trim();
        }
        const base = new Date(baseDateStr);
        const d = isNaN(base.getTime()) ? new Date() : new Date(base);
        d.setMonth(d.getMonth() + months);
        return d.toISOString().split('T')[0];
      };

      const finalExpiryDate = computeFinalExpiry(finalPurchased, finalWarranty);
      const createdItems: SerialNumberItem[] = [];

      // Case A: Batch list provided (string or array)
      if (batchSerials) {
        const rawLines: string[] = Array.isArray(batchSerials)
          ? batchSerials
          : String(batchSerials).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

        rawLines.forEach((sn) => {
          if (!sn) return;
          const cleanSN = sn.trim().toUpperCase();
          // Avoid duplicate within DB
          const existing = serialsDB.find((s) => s.serialNumber.toUpperCase() === cleanSN);
          if (!existing) {
            const newItem: SerialNumberItem = {
              id: `sn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              serialNumber: cleanSN,
              productId: productId || targetProduct?.id || `prod-${Date.now()}`,
              productName: finalProductName,
              sku: finalSku,
              brand: finalBrand,
              category: finalCategory,
              variantId: variantId || undefined,
              variantName: variantName || undefined,
              costPrice: finalCost,
              sellingPrice: finalSelling,
              status: 'In Stock',
              warrantyPeriodMonths: finalWarranty,
              warrantyExpiryDate: finalExpiryDate,
              purchasedDate: finalPurchased,
              supplier: supplier || 'Authorized Distribution Pakistan',
              notes: notes || '',
              createdAt: new Date().toISOString(),
            };
            serialsDB.unshift(newItem);
            createdItems.push(newItem);
          }
        });
      } else if (countToAutoGenerate && Number(countToAutoGenerate) > 0) {
        // Case B: Auto-generate sequential serial numbers (continuing sequentially from existing count)
        const count = Math.min(Number(countToAutoGenerate), 100);
        const existingForProduct = serialsDB.filter(
          (s) => (productId && s.productId === productId) || (finalSku && s.sku === finalSku)
        );
        const startingSeq = existingForProduct.length + 1;

        for (let i = 0; i < count; i++) {
          const seqIndex = startingSeq + i;
          const generatedSN = generateSerialNumber(
            { id: productId, name: finalProductName, brand: finalBrand, category: finalCategory as ProductCategory, sku: finalSku },
            seqIndex
          );
          const newItem: SerialNumberItem = {
            id: `sn-${Date.now()}-${seqIndex}-${Math.random().toString(36).substring(2, 6)}`,
            serialNumber: generatedSN,
            productId: productId || targetProduct?.id || `prod-${Date.now()}`,
            productName: finalProductName,
            sku: finalSku,
            brand: finalBrand,
            category: finalCategory,
            variantId: variantId || undefined,
            variantName: variantName || undefined,
            costPrice: finalCost,
            sellingPrice: finalSelling,
            status: 'In Stock',
            warrantyPeriodMonths: finalWarranty,
            warrantyExpiryDate: finalExpiryDate,
            purchasedDate: finalPurchased,
            supplier: supplier || 'Apex Inward Intake',
            notes: notes || 'Sequential batch intake',
            createdAt: new Date().toISOString(),
          };
          serialsDB.unshift(newItem);
          createdItems.push(newItem);
        }
      } else {
        // Case C: Single Serial Number
        const singleSN = (serialNumber || generateSerialNumber({ id: productId, name: finalProductName, brand: finalBrand, category: finalCategory as ProductCategory })).trim().toUpperCase();
        const newItem: SerialNumberItem = {
          id: `sn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          serialNumber: singleSN,
          productId: productId || targetProduct?.id || `prod-${Date.now()}`,
          productName: finalProductName,
          sku: finalSku,
          brand: finalBrand,
          category: finalCategory,
          variantId: variantId || undefined,
          variantName: variantName || undefined,
          costPrice: finalCost,
          sellingPrice: finalSelling,
          status: 'In Stock',
          warrantyPeriodMonths: finalWarranty,
          warrantyExpiryDate: finalExpiryDate,
          purchasedDate: finalPurchased,
          supplier: supplier || '',
          notes: notes || '',
          createdAt: new Date().toISOString(),
        };
        serialsDB.unshift(newItem);
        createdItems.push(newItem);
      }

      savePersistedData();
      res.status(201).json({ success: true, createdCount: createdItems.length, items: createdItems });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to add serial numbers' });
    }
  });

  // FAST INTAKE & 1-CLICK PURCHASE BILL ENDPOINT
  app.post('/api/inventory/fast-intake', (req, res) => {
    try {
      const {
        product,
        vendorName,
        billNumber,
        quantity,
        unitCost,
        sellingPrice,
        generatedSerials,
        variantSerials,
        warrantyMonths,
        paymentStatus,
      } = req.body;

      const qty = Math.max(1, Number(quantity) || 1);
      const cost = Number(unitCost) || 0;
      const price = Number(sellingPrice) || Math.round(cost * 1.25);
      const wMonths = Number(warrantyMonths) || 36;
      const isPaid = paymentStatus === 'paid';
      const vendor = vendorName || 'Direct Vendor Intake';
      const bill = billNumber || `BILL-${Date.now()}`;
      const nowStr = new Date().toISOString().split('T')[0];

      let targetProduct: Product | undefined;

      // 1. Locate or create the catalog product
      if (product?.id) {
        targetProduct = productsDB.find((p) => p.id === product.id);
      }

      if (!targetProduct && product?.sku) {
        targetProduct = productsDB.find((p) => p.sku === product.sku);
      }

      if (targetProduct) {
        // Update existing product stock & cost & specifications if provided
        const prevStock = Number(targetProduct.stockCount) || 0;
        targetProduct.stockCount = prevStock + qty;
        targetProduct.inStock = true;
        targetProduct.costPrice = cost;
        targetProduct.price = price;
        if (product?.originalPrice !== undefined) targetProduct.originalPrice = product.originalPrice;
        if (product?.description) targetProduct.description = product.description;
        if (product?.image) targetProduct.image = product.image;
        if (product?.additionalImages) targetProduct.additionalImages = product.additionalImages;
        if (product?.featured !== undefined) targetProduct.featured = product.featured;
        if (product?.isVariable !== undefined) targetProduct.isVariable = product.isVariable;
        if (product?.variants) targetProduct.variants = product.variants;
        if (product?.specifications) {
          targetProduct.specifications = {
            ...(targetProduct.specifications || {}),
            ...product.specifications,
            warrantyMonths: wMonths,
          };
        }
      } else {
        // Create new catalog product with all rich fields
        const newProdId = `prod-${Date.now()}`;
        const newSku = product?.sku || generateProductSKU({
          name: product?.name || 'Hardware Unit',
          brand: product?.brand || 'Apex',
          category: product?.category || 'RAM',
        }, productsDB);

        targetProduct = {
          id: newProdId,
          sku: newSku,
          name: product?.name || 'Hardware Component',
          brand: product?.brand || 'Apex',
          category: product?.category || 'RAM',
          price,
          costPrice: cost,
          originalPrice: product?.originalPrice,
          description: product?.description || `${product?.brand || 'Apex'} high performance ${product?.category || 'component'}.`,
          inStock: true,
          stockCount: qty,
          featured: Boolean(product?.featured),
          isVariable: Boolean(product?.isVariable),
          variants: product?.variants || [],
          image: product?.image || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=60',
          additionalImages: product?.additionalImages || [],
          specifications: {
            warrantyMonths: wMonths,
            ...(product?.specifications || {}),
          },
          createdAt: new Date().toISOString(),
        };

        productsDB.unshift(targetProduct);
      }

      // 2. Compute warranty expiry date
      const expDate = new Date(nowStr);
      expDate.setMonth(expDate.getMonth() + wMonths);
      const warrantyExpiryDate = expDate.toISOString().split('T')[0];

      // 3. Register sequential Serial Numbers
      const createdSerials: SerialNumberItem[] = [];
      
      const processSerial = (sn: string, variantId?: string, variantName?: string) => {
        const cleanSN = sn.trim().toUpperCase();
        const existing = serialsDB.find((s) => s.serialNumber.toUpperCase() === cleanSN);
        if (!existing) {
          const newSNItem: SerialNumberItem = {
            id: `sn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            serialNumber: cleanSN,
            productId: targetProduct!.id,
            productName: targetProduct!.name,
            sku: targetProduct!.sku || 'SKU-001',
            brand: targetProduct!.brand,
            category: targetProduct!.category,
            variantId: variantId,
            variantName: variantName,
            costPrice: cost,
            sellingPrice: price,
            status: 'In Stock',
            warrantyPeriodMonths: wMonths,
            warrantyExpiryDate,
            purchasedDate: nowStr,
            supplier: vendor,
            notes: `Auto-intake via Purchase Bill ${bill}`,
            createdAt: new Date().toISOString(),
          };
          serialsDB.unshift(newSNItem);
          createdSerials.push(newSNItem);
        }
      };

      if (variantSerials && variantSerials.length > 0) {
        variantSerials.forEach((vs: any) => {
          vs.serials.forEach((sn: string) => {
            processSerial(sn, vs.variantId, vs.variantName);
          });
        });
      } else {
        const serialList: string[] = Array.isArray(generatedSerials) && generatedSerials.length > 0
          ? generatedSerials
          : Array.from({ length: qty }).map((_, i) => `${targetProduct!.sku || 'SN'}-${String(i + 1).padStart(4, '0')}`);
        serialList.forEach((sn) => processSerial(sn));
      }


      // 4. Log Inventory Ledger Movement
      const prevStockCount = Math.max(0, (targetProduct.stockCount || 0) - qty);
      const newMovement: InventoryMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: targetProduct.id,
        productName: targetProduct.name,
        sku: targetProduct.sku || 'SKU-001',
        type: 'PURCHASE_INWARD',
        quantity: qty,
        unitCost: cost,
        totalValue: cost * qty,
        previousStock: prevStockCount,
        newStock: targetProduct.stockCount,
        reference: bill,
        notes: `Fast-intake shipment from ${vendor} (${qty} serialized units)`,
        performedBy: 'Fast-Intake Station',
        date: new Date().toISOString(),
      };
      movementsDB.unshift(newMovement);

      // 5. Create or Update Supplier Vendor in ERP
      const cleanVendorName = String(vendor || 'Direct Distributor').trim();
      let targetVendor = vendorsDB.find(
        (v) => (v.name && v.name.toLowerCase() === cleanVendorName.toLowerCase()) ||
               (v.companyName && v.companyName.toLowerCase() === cleanVendorName.toLowerCase())
      );
      if (!targetVendor) {
        targetVendor = {
          id: `vend-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: cleanVendorName,
          companyName: cleanVendorName,
          contactPerson: 'Authorized Sales Representative',
          email: `accounts@${cleanVendorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'distributor'}.com`,
          phone: '+92 42 3578 9901',
          city: 'Lahore',
          address: 'Shop 12-A, 3rd Floor, Hafeez Center, Gulberg iii, Lahore',
          ntn: '3892104-5',
          isFiler: true,
          paymentTermsDays: 30,
          status: 'ACTIVE',
          totalPurchasesPkr: cost * qty,
          currentPayableBalancePkr: isPaid ? 0 : cost * qty,
          productCategoriesSupplied: [targetProduct.category || 'Hardware Components'],
          createdAt: new Date().toISOString(),
        };
        vendorsDB.unshift(targetVendor);
      } else {
        targetVendor.totalPurchasesPkr = (targetVendor.totalPurchasesPkr || 0) + (cost * qty);
        if (!isPaid) {
          targetVendor.currentPayableBalancePkr = (targetVendor.currentPayableBalancePkr || 0) + (cost * qty);
        }
      }

      // 6. Record Official Purchase Document (Bill) in ERP
      const billDoc = {
        id: `doc-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        docNumber: bill,
        type: 'BILL',
        vendorId: targetVendor.id,
        vendorName: targetVendor.name,
        vendorNtn: targetVendor.ntn || '3892104-5',
        vendorIsFiler: targetVendor.isFiler ?? true,
        branchId: 'lahore_hafeez',
        issueDate: nowStr,
        deliveryDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: isPaid ? 'PAID' : 'RECEIVED',
        items: [
          {
            id: `item-${Date.now()}`,
            productId: targetProduct.id,
            productName: targetProduct.name,
            sku: targetProduct.sku || 'SKU-001',
            orderedQty: qty,
            receivedQty: qty,
            billedQty: qty,
            unitCostPkr: cost,
            taxRatePercent: 0,
            taxAmountPkr: 0,
            totalPkr: cost * qty,
            warehouseId: 'lahore_hafeez',
            serialNumbers: createdSerials.map(s => s.serialNumber),
          },
        ],
        subtotalPkr: cost * qty,
        inputGstPkr: 0,
        whtDeductionRate: 0,
        whtDeductionPkr: 0,
        freightShippingPkr: 0,
        customsAndClearancePkr: 0,
        grandTotalPkr: cost * qty,
        paidAmountPkr: isPaid ? cost * qty : 0,
        balancePayablePkr: isPaid ? 0 : cost * qty,
        notes: `Fast-intake supplier bill logged for ${qty}x ${targetProduct.name}${isPaid ? ' (Paid in Full)' : ' (Payable on Credit)'}`,
        createdBy: 'Fast-Intake Station',
        createdAt: new Date().toISOString(),
      };
      purchaseDocsDB.unshift(billDoc);

      savePersistedData();

      res.status(201).json({
        success: true,
        product: targetProduct,
        createdSerialsCount: createdSerials.length,
        billNumber: bill,
        bill: billDoc,
        vendor: targetVendor,
        movement: newMovement,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to process fast-intake' });
    }
  });

  // ERP PURCHASE DOCUMENTS: GET & POST
  app.get('/api/erp/purchase-docs', (req, res) => {
    res.json(purchaseDocsDB);
  });

  app.post('/api/erp/purchase-docs', (req, res) => {
    try {
      const doc = req.body;
      if (!doc || !doc.id || !doc.docNumber) {
        return res.status(400).json({ error: 'Invalid purchase document payload' });
      }
      const invalid = validateDocument(doc, 'purchase');
      if (invalid) return res.status(400).json({ error: invalid });
      if (purchaseDocsDB.some(d => d.id !== doc.id && d.docNumber === doc.docNumber)) return res.status(409).json({ error: 'Document number already exists.' });
      const existingIdx = purchaseDocsDB.findIndex((d) => d.id === doc.id || d.docNumber === doc.docNumber);
      if (existingIdx >= 0) {
        updateVendor(vendorsDB, purchaseDocsDB[existingIdx], doc);
        purchaseDocsDB[existingIdx] = doc;
      } else {
        updateVendor(vendorsDB, undefined, doc);
        purchaseDocsDB.unshift(doc);
      }
      savePersistedData();
      res.json({ success: true, doc });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to save purchase document' });
    }
  });

  app.delete('/api/erp/purchase-docs/:id', (req, res) => {
    try {
      const docId = decodeURIComponent(req.params.id);
      const previous = purchaseDocsDB.find(d => d.id === docId || d.docNumber === docId);
      if (purchaseDocsDB.some(d => d.sourceDocumentId === previous?.id)) return res.status(409).json({ error: 'Document has linked successors and cannot be deleted.' });
      if (vouchersDB.some(v => v.billId === previous?.id)) return res.status(409).json({ error: 'Bill has allocated payments and cannot be deleted.' });
      updateVendor(vendorsDB, previous);
      purchaseDocsDB = purchaseDocsDB.filter((d) => d.id !== docId && d.docNumber !== docId);
      savePersistedData();
      res.json({ success: true, message: 'Purchase document deleted successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to delete purchase document' });
    }
  });

  // ERP SALES DOCUMENTS: GET, POST & DELETE
  app.get('/api/erp/sales-docs', (req, res) => {
    reconcileErpSalesAndReceivables();
    res.json(salesDocsDB);
  });

  app.post('/api/erp/sales-docs', (req, res) => {
    try {
      const doc = req.body;
      if (!doc || !doc.id || !doc.docNumber) {
        return res.status(400).json({ error: 'Invalid sales document payload' });
      }
      const invalid = validateDocument(doc, 'sales');
      if (invalid) return res.status(400).json({ error: invalid });
      if (salesDocsDB.some(d => d.id !== doc.id && d.docNumber === doc.docNumber)) return res.status(409).json({ error: 'Document number already exists.' });
      const existingIdx = salesDocsDB.findIndex((d) => d.id === doc.id || d.docNumber === doc.docNumber);
      customersDB = applySalesCustomerChange(customersDB, salesDocsDB[existingIdx], doc);
      if (existingIdx >= 0) {
        salesDocsDB[existingIdx] = doc;
      } else {
        salesDocsDB.unshift(doc);
      }
      savePersistedData();
      res.json({ success: true, doc });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to save sales document' });
    }
  });

  app.put('/api/erp/sales-docs/:id', (req, res) => {
    try {
      const docId = decodeURIComponent(req.params.id);
      const updatedDoc = req.body;
      if (!updatedDoc || !updatedDoc.id || !updatedDoc.docNumber) return res.status(400).json({ error: 'Document ID and number required.' });
      const invalid = validateDocument(updatedDoc, 'sales');
      if (invalid) return res.status(400).json({ error: invalid });
      if (salesDocsDB.some(d => d.id !== updatedDoc.id && d.docNumber === updatedDoc.docNumber)) return res.status(409).json({ error: 'Document number already exists.' });
      const idx = salesDocsDB.findIndex((d) => d.id === docId || d.docNumber === docId);
      if (idx >= 0) {
        const nextDoc = { ...salesDocsDB[idx], ...updatedDoc, updatedAt: new Date().toISOString() };
        customersDB = applySalesCustomerChange(customersDB, salesDocsDB[idx], nextDoc);
        salesDocsDB[idx] = nextDoc;
      } else {
        return res.status(404).json({ error: 'Sales document not found.' });
      }
      savePersistedData();
      res.json({ success: true, doc: salesDocsDB[idx >= 0 ? idx : 0] });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to update sales document' });
    }
  });

  app.delete('/api/erp/sales-docs/:id', (req, res) => {
    try {
      const docId = decodeURIComponent(req.params.id);
      const priorDoc = salesDocsDB.find(d => d.id === docId || d.docNumber === docId);
      if (salesDocsDB.some(d => d.sourceDocumentId === priorDoc?.id)) return res.status(409).json({ error: 'Document has linked successors and cannot be deleted.' });
      if (vouchersDB.some(v => v.invoiceId === priorDoc?.id)) return res.status(409).json({ error: 'Invoice has allocated receipts and cannot be deleted.' });
      customersDB = applySalesCustomerChange(customersDB, priorDoc);
      salesDocsDB = salesDocsDB.filter((d) => d.id !== docId && d.docNumber !== docId);
      
      // Also delete the corresponding Custom Order and restore stock
      const orderToDelete = ordersDB.find((o) => o.id === docId || o.orderNumber === docId);
      if (orderToDelete) {
        if (orderToDelete.stockDeducted) {
          orderToDelete.items.forEach(item => {
            const product = productsDB.find(p => p.id === item.productId);
            if (product) {
              product.stockCount += item.quantity;
              if (item.variantId && product.variants) {
                const variant = product.variants.find(v => v.id === item.variantId);
                if (variant) variant.stock += item.quantity;
              }
            }
          });
        }
        ordersDB = ordersDB.filter((o) => o.id !== docId && o.orderNumber !== docId);
      }

      savePersistedData();
      res.json({ success: true, message: 'Sales document deleted successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to delete sales document' });
    }
  });

  app.get('/api/erp/treasury', (req, res) => res.json({ bankAccounts: bankAccountsDB, vouchers: vouchersDB }));

  // A receipt updates receivables and cash together and is safe to retry by ID.
  app.post('/api/erp/sales-docs/:id/receipts', (req, res) => {
    const doc = salesDocsDB.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    const { id, amount, bankAccountId, date, reference } = req.body;
    if (typeof id !== 'string' || !id.trim()) return res.status(400).json({ error: 'Receipt ID required.' });
    const prior = vouchersDB.find(v => v.id === id);
    if (prior) {
      if (prior.invoiceId !== doc.id || prior.amountPkr !== amount || prior.bankAccountId !== bankAccountId)
        return res.status(409).json({ error: 'Receipt ID already used for a different payment.' });
      return res.json({ success: true, doc, voucher: prior });
    }
    if (doc.type !== 'INVOICE' || ['DRAFT', 'CANCELLED', 'REFUNDED'].includes(doc.status)) return res.status(400).json({ error: 'Only active invoices accept receipts.' });
    if (!validDate(date) || date < doc.issueDate) return res.status(400).json({ error: 'Receipt date must be on or after the invoice date.' });
    if (typeof amount !== 'number' || !Number.isFinite(amount) || Math.round(amount * 100) / 100 !== amount || amount <= 0 || amount > doc.balanceDuePkr)
      return res.status(400).json({ error: 'Amount must be positive and cannot exceed the outstanding balance.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date))) return res.status(400).json({ error: 'Valid receipt date required.' });
    const bank = bankAccountsDB.find(b => b.id === bankAccountId && b.isActive);
    if (!bank) return res.status(400).json({ error: 'Choose an active bank or cash account.' });
    const actor = usersDB.find(u => u.id === sessionUserId(req))!;
    const voucher = {
      id, invoiceId: doc.id, voucherNumber: `RCPT-${id}`, type: bank.type === 'CASH_DRAWER' ? 'CRV' : 'BRV',
      date, bankAccountId, bankAccountName: bank.accountName, partyType: 'CUSTOMER', partyId: doc.customerId,
      partyName: doc.customerName, paymentMode: bank.type === 'CASH_DRAWER' ? 'CASH' : 'ONLINE_TRANSFER',
      chequeOrRefNumber: reference || doc.docNumber, narration: `Receipt against ${doc.docNumber}`,
      amountPkr: amount, netPaidOrReceivedPkr: amount, debitAccountCode: bank.glAccountCode,
      debitAccountName: bank.accountName, creditAccountCode: '1100', creditAccountName: 'Accounts Receivable',
      preparedBy: actor.fullName, branchId: doc.branchId, createdAt: new Date().toISOString(),
    };
    const old = structuredClone({ salesDocsDB, bankAccountsDB, vouchersDB, customersDB, accountingControls });
    try {
      bankAccountsDB = applyVoucherChange(bankAccountsDB, undefined, voucher as any);
      vouchersDB.unshift(voucher);
      doc.paidAmountPkr = Math.round(((doc.paidAmountPkr || 0) + amount) * 100) / 100;
      doc.balanceDuePkr = Math.round((doc.grandTotalPkr - doc.paidAmountPkr) * 100) / 100;
      doc.status = doc.balanceDuePkr === 0 ? 'PAID' : 'PARTIALLY_PAID';
      const customer = customersDB.find(c => c.id === doc.customerId);
      if (customer) customer.currentBalancePkr = Math.round(((customer.currentBalancePkr || 0) - amount) * 100) / 100;
      savePersistedData();
      res.json({ success: true, doc, voucher });
    } catch {
      ({ salesDocsDB, bankAccountsDB, vouchersDB, customersDB, accountingControls } = old);
      res.status(500).json({ error: 'Receipt could not be saved. No balances were changed.' });
    }
  });

  // ERP BANK ACCOUNTS: GET, POST & DELETE
  app.get('/api/erp/bank-accounts', (req, res) => {
    res.json(bankAccountsDB);
  });

  app.post('/api/erp/bank-accounts', (req, res) => {
    try {
      const acc = req.body;
      if (!acc || !acc.id || !acc.accountName) {
        return res.status(400).json({ error: 'Bank account name required' });
      }
      const existingIdx = bankAccountsDB.findIndex((a) => a.id === acc.id || a.accountName === acc.accountName);
      if (existingIdx >= 0) {
        bankAccountsDB[existingIdx] = { ...acc, currentBalancePkr: bankAccountsDB[existingIdx].currentBalancePkr, glAccountCode: bankAccountsDB[existingIdx].glAccountCode };
      } else {
        bankAccountsDB.push(acc);
      }
      savePersistedData();
      res.json({ success: true, bankAccount: acc });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to save bank account' });
    }
  });

  app.delete('/api/erp/bank-accounts/:id', (req, res) => {
    try {
      const accId = decodeURIComponent(req.params.id);
      if (vouchersDB.some(v => v.bankAccountId === accId || v.transferToBankId === accId)) return res.status(409).json({ error: 'This account has posted vouchers and cannot be deleted.' });
      bankAccountsDB = bankAccountsDB.filter((a) => a.id !== accId && a.accountName !== accId);
      savePersistedData();
      res.json({ success: true, message: 'Bank account deleted successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to delete bank account' });
    }
  });

  // ERP FINANCIAL VOUCHERS: GET, POST & DELETE
  app.get('/api/erp/vouchers', (req, res) => {
    res.json(vouchersDB);
  });

  app.post('/api/erp/vouchers', (req, res) => {
    try {
      const voucher = req.body;
      if (voucher?.transferToBankId || vouchersDB.some(v => v.id === voucher?.id && v.transferToBankId)) return res.status(409).json({ error: 'Transfers must use treasury entries.' });
      if (voucher?.invoiceId || voucher?.billId || vouchersDB.some(v => v.id === voucher?.id && (v.invoiceId || v.billId))) return res.status(409).json({ error: 'Invoice receipts must be managed through their invoice.' });
      if (!voucher || !voucher.voucherNumber) {
        return res.status(400).json({ error: 'Invalid voucher payload' });
      }
      try { validateVoucher(voucher); } catch (error: any) { return res.status(400).json({ error: error.message }); }
      if (vouchersDB.some(v => v.id !== voucher.id && v.voucherNumber === voucher.voucherNumber)) return res.status(409).json({ error: 'Voucher number already exists.' });
      const existingIdx = vouchersDB.findIndex((v) => v.id === voucher.id || v.voucherNumber === voucher.voucherNumber);
      let updatedBanks;
      try { updatedBanks = applyVoucherChange(bankAccountsDB, vouchersDB[existingIdx], voucher); } catch (error: any) { return res.status(400).json({ error: error.message }); }
      bankAccountsDB = updatedBanks;
      if (existingIdx >= 0) {
        vouchersDB[existingIdx] = voucher;
      } else {
        vouchersDB.unshift(voucher);
      }
      savePersistedData();
      res.json({ success: true, voucher, vouchers: vouchersDB, bankAccounts: bankAccountsDB });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to save voucher' });
    }
  });

  app.delete('/api/erp/vouchers/:id', (req, res) => {
    try {
      const voucherId = decodeURIComponent(req.params.id);
      const previous = vouchersDB.find(v => v.id === voucherId || v.voucherNumber === voucherId);
      if (previous?.invoiceId || previous?.billId) return res.status(409).json({ error: 'An allocated invoice receipt cannot be deleted as a standalone voucher.' });
      bankAccountsDB = applyVoucherChange(bankAccountsDB, previous);
      vouchersDB = vouchersDB.filter((v) => v.id !== voucherId && v.voucherNumber !== voucherId);
      savePersistedData();
      res.json({ success: true, vouchers: vouchersDB, bankAccounts: bankAccountsDB });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to delete voucher' });
    }
  });

  // ERP CUSTOMERS: GET, POST & DELETE
  app.get('/api/erp/customers', (req, res) => {
    reconcileErpSalesAndReceivables();
    res.json(customersDB);
  });

  app.post('/api/erp/customers', (req, res) => {
    try {
      const customer = req.body;
      if (!customer || !customer.id || !customer.name) {
        return res.status(400).json({ error: 'Customer name required' });
      }
      const idx = customersDB.findIndex((c) => c.id === customer.id);
      if (idx >= 0) {
        customersDB[idx] = { ...customer, currentBalancePkr: customersDB[idx].currentBalancePkr, totalSalesPkr: customersDB[idx].totalSalesPkr };
      } else {
        customersDB.unshift(customer);
      }
      savePersistedData();
      res.json({ success: true, customer });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to save customer' });
    }
  });

  app.delete('/api/erp/customers/:id', (req, res) => {
    try {
      const customerId = decodeURIComponent(req.params.id);
      if (salesDocsDB.some(d => d.customerId === customerId)) return res.status(409).json({ error: 'Customer has linked documents and cannot be deleted.' });
      customersDB = customersDB.filter((c) => c.id !== customerId && c.name !== customerId);
      savePersistedData();
      res.json({ success: true, message: 'Customer removed successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to remove customer' });
    }
  });

  // ERP VENDORS: GET & POST
  app.get('/api/erp/vendors', (req, res) => {
    res.json(vendorsDB);
  });

  app.post('/api/erp/vendors', (req, res) => {
    try {
      const vendor = req.body;
      if (!vendor || !vendor.id || !vendor.name) {
        return res.status(400).json({ error: 'Vendor name required' });
      }
      const idx = vendorsDB.findIndex((v) => v.id === vendor.id);
      if (idx >= 0) {
        vendorsDB[idx] = { ...vendor, currentPayableBalancePkr: vendorsDB[idx].currentPayableBalancePkr, totalPurchasesPkr: vendorsDB[idx].totalPurchasesPkr };
      } else {
        vendorsDB.unshift(vendor);
      }
      savePersistedData();
      res.json({ success: true, vendor });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to save vendor' });
    }
  });

  app.delete('/api/erp/vendors/:id', (req, res) => {
    try {
      const vendorId = decodeURIComponent(req.params.id);
      if (purchaseDocsDB.some(d => d.vendorId === vendorId)) return res.status(409).json({ error: 'Supplier has linked documents and cannot be deleted.' });
      vendorsDB = vendorsDB.filter((v) => v.id !== vendorId && v.name !== vendorId);
      savePersistedData();
      res.json({ success: true, message: 'Vendor removed successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to remove vendor' });
    }
  });

  // SERIAL NUMBERS: UPDATE (Status, Link Order, Warranty, Expiry, RMA)
  app.put('/api/inventory/serials/:id', (req, res) => {
    try {
      const snId = req.params.id;
      const index = serialsDB.findIndex((s) => s.id === snId || s.serialNumber.toUpperCase() === snId.toUpperCase());
      if (index === -1) {
        return res.status(404).json({ error: 'Serial number record not found' });
      }

      const existing = serialsDB[index];
      let newWarrantyExpiryDate = req.body.warrantyExpiryDate !== undefined ? req.body.warrantyExpiryDate : existing.warrantyExpiryDate;
      
      // If warrantyPeriodMonths changed but warrantyExpiryDate wasn't explicitly changed, recalculate
      if (req.body.warrantyPeriodMonths && req.body.warrantyPeriodMonths !== existing.warrantyPeriodMonths && !req.body.warrantyExpiryDate) {
        const base = existing.purchasedDate ? new Date(existing.purchasedDate) : new Date(existing.createdAt || Date.now());
        const d = isNaN(base.getTime()) ? new Date() : new Date(base);
        d.setMonth(d.getMonth() + Number(req.body.warrantyPeriodMonths));
        newWarrantyExpiryDate = d.toISOString().split('T')[0];
      }

      const updated: SerialNumberItem = {
        ...existing,
        ...req.body,
        id: existing.id,
        serialNumber: req.body.serialNumber ? String(req.body.serialNumber).trim().toUpperCase() : existing.serialNumber,
        warrantyExpiryDate: newWarrantyExpiryDate,
        updatedAt: new Date().toISOString(),
      };

      serialsDB[index] = updated;
      savePersistedData();
      res.json({ success: true, item: updated });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to update serial number' });
    }
  });

  // SERIAL NUMBERS: DELETE
  app.delete('/api/inventory/serials/:id', (req, res) => {
    try {
      const snId = req.params.id;
      const initial = serialsDB.length;
      serialsDB = serialsDB.filter((s) => s.id !== snId && s.serialNumber.toUpperCase() !== snId.toUpperCase());
      savePersistedData();

      if (serialsDB.length < initial) {
        res.json({ success: true, message: 'Serial number deleted' });
      } else {
        res.status(404).json({ error: 'Serial number not found' });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to delete serial number' });
    }
  });

  // INVENTORY MOVEMENTS / LEDGER: GET All
  app.get('/api/inventory/movements', (req, res) => {
    try {
      const { productId, type } = req.query;
      let list = [...movementsDB];
      if (productId) {
        list = list.filter((m) => m.productId === productId);
      }
      if (type && type !== 'All') {
        list = list.filter((m) => m.type === type);
      }
      res.json(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to retrieve stock ledger movements' });
    }
  });

  // INVENTORY MOVEMENTS: POST (Record Stock Transaction & Auto-Adjust Product Stock)
  app.post('/api/inventory/movements', (req, res) => {
    try {
      const { productId, type, quantity, unitCost, reference, notes, performedBy } = req.body;
      const targetProductIndex = productsDB.findIndex((p) => p.id === productId);
      if (targetProductIndex === -1) {
        return res.status(404).json({ error: 'Product not found for inventory movement' });
      }

      const prod = productsDB[targetProductIndex];
      const prevStock = Number(prod.stockCount) || 0;
      const qty = Number(quantity) || 0;
      const newStock = Math.max(0, prevStock + qty);
      const cost = Number(unitCost) || Number(prod.costPrice) || Math.round(Number(prod.price) * 0.88);

      // Update product stock in database
      productsDB[targetProductIndex] = {
        ...prod,
        stockCount: newStock,
        inStock: newStock > 0,
        costPrice: cost,
      };

      const newMovement: InventoryMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || 'APX-SKU',
        type: type || 'MANUAL_ADJUSTMENT',
        quantity: qty,
        unitCost: cost,
        totalValue: cost * qty,
        previousStock: prevStock,
        newStock,
        reference: reference || 'Manual Adjustment',
        notes: notes || '',
        performedBy: performedBy || 'Store Admin',
        date: new Date().toISOString(),
      };

      movementsDB.unshift(newMovement);
      savePersistedData();

      res.status(201).json({
        success: true,
        movement: newMovement,
        updatedProduct: productsDB[targetProductIndex],
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to record inventory movement' });
    }
  });

  // INVENTORY MOVEMENTS: DELETE (Permanently remove entry from Movement Audit Trail)
  app.delete('/api/inventory/movements/:id', (req, res) => {
    try {
      const rawId = req.params.id;
      let decodedId = rawId;
      try {
        decodedId = decodeURIComponent(rawId).trim();
      } catch {}

      const initialLength = movementsDB.length;
      movementsDB = movementsDB.filter((m) => m.id !== rawId && m.id !== decodedId && m.id !== rawId.trim());

      savePersistedData();
      res.json({ success: true, message: 'Movement audit record permanently deleted', deletedId: decodedId });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to delete inventory movement record' });
    }
  });

  // UNIVERSAL SKU & SERIAL NUMBER LOOKUP
  app.get('/api/inventory/lookup', (req, res) => {
    try {
      const query = String(req.query.q || '').trim();
      if (!query) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }

      const cleanQ = query.toUpperCase();

      // Check for exact or partial serial match
      const matchedSerials = serialsDB.filter(
        (s) =>
          s.serialNumber.toUpperCase() === cleanQ ||
          s.serialNumber.toUpperCase().includes(cleanQ) ||
          s.sku.toUpperCase() === cleanQ
      );

      // Check for matching product by SKU, ID or name
      const matchedProducts = productsDB.filter(
        (p) =>
          (p.sku && p.sku.toUpperCase() === cleanQ) ||
          (p.sku && p.sku.toUpperCase().includes(cleanQ)) ||
          p.id.toUpperCase() === cleanQ ||
          p.variants?.some((v) => v.sku && v.sku.toUpperCase() === cleanQ)
      );

      // Check related orders
      const matchedOrders = ordersDB.filter(
        (o) =>
          o.orderNumber.toUpperCase() === cleanQ ||
          matchedSerials.some((s) => s.orderId === o.id || s.orderNumber === o.orderNumber)
      );

      res.json({
        success: true,
        query,
        products: matchedProducts,
        serials: matchedSerials,
        orders: matchedOrders,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Lookup search failed' });
    }
  });


  // AUTH: ADMIN LOGIN (Strictly Owner or Backend-Created Admins Only)
  app.post('/api/auth/admin/login', (req, res) => {
    try {
      const { username, email, emailOrUsername, password } = req.body;
      const rawUser = username || email || emailOrUsername;
      const u = (rawUser || '').trim().toLowerCase();
      const p = (password || '').trim();

      if (!u || !p) {
        return res.status(400).json({ success: false, error: 'Please enter both username/email and password.' });
      }

      // Check Owner Credentials
      const isOwnerIdentity = (u === OWNER_USERNAME.toLowerCase() || u === OWNER_EMAIL.toLowerCase());
      const ownerAcc = usersDB.find((usr) => usr.isOwner || usr.username?.toLowerCase() === OWNER_USERNAME.toLowerCase() || usr.email.toLowerCase() === OWNER_EMAIL.toLowerCase());

      const isOwnerPasswordCorrect = (OWNER_PASSWORD && p === OWNER_PASSWORD) || (ownerAcc?.password && verifyPassword(p, ownerAcc.password));

      if (isOwnerIdentity && isOwnerPasswordCorrect) {
        const safeOwner = ownerAcc ? sanitizeUser(ownerAcc) : {
          id: 'user-owner-1',
          fullName: 'Hammad Ur Rehman (Owner)',
          username: OWNER_USERNAME,
          email: OWNER_EMAIL,
          phone: '+447597030688',
          city: 'Lahore',
          address: 'Shop #G-14, Ground Floor, Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan',
          role: 'admin' as const,
          isOwner: true,
          createdAt: new Date().toISOString(),
        };
        const sessionToken = startSession(req, res, safeOwner.id);
        return res.json({
          success: true,
          token: sessionToken,
          user: {
            ...safeOwner,
            token: sessionToken,
          },
        });
      }

      // Check Backend Created Admin Accounts
      const matchedAdmin = usersDB.find(
        (usr) =>
          usr.role === 'admin' &&
          (usr.username?.toLowerCase() === u || usr.email.toLowerCase() === u) &&
          (verifyPassword(p, usr.password) || (usr.isOwner && OWNER_PASSWORD && p === OWNER_PASSWORD))
      );

      if (matchedAdmin) {
        const sessionToken = startSession(req, res, matchedAdmin.id);
        return res.json({
          success: true,
          token: sessionToken,
          user: {
            ...sanitizeUser(matchedAdmin),
            token: sessionToken,
          },
        });
      }

      // If user exists as admin or owner but password was incorrect
      const adminExists = isOwnerIdentity || usersDB.some(
        (usr) => usr.role === 'admin' && (usr.username?.toLowerCase() === u || usr.email.toLowerCase() === u)
      );

      if (adminExists) {
        return res.status(401).json({
          success: false,
          error: 'Wrong password. Please enter the correct password and try again.',
        });
      }

      res.status(401).json({
        success: false,
        error: 'Access denied. Only the store owner (sheedatalli) or authorized backend admins created by the owner can sign in.',
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Server error' });
    }
  });

  // AUTH: CUSTOMER REGISTER (Website User Registration Flow)
  const handleRegister = (req: express.Request, res: express.Response) => {
    try {
      const { fullName, email, phone, city, address, password, username } = req.body;
      if (!email || !fullName || !password || !phone || !city || !address) {
        return res.status(400).json({ error: 'All fields are required: Full name, email, password, phone, city, and delivery address.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username ? username.trim().toLowerCase() : '';

      if (cleanEmail === OWNER_EMAIL.toLowerCase() || cleanUsername === OWNER_USERNAME.toLowerCase()) {
        return res.status(400).json({ error: 'This username or email is reserved for store administration.' });
      }

      const existing = usersDB.find(
        (u) => u.email.toLowerCase() === cleanEmail || (cleanUsername && u.username?.toLowerCase() === cleanUsername)
      );
      if (existing) {
        return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
      }

      // Public registration STRICTLY creates customer role (Admin can only be created by owner in backend)
      const newUser: StoredUserAccount = {
        id: `user-${Date.now()}`,
        fullName: fullName.trim(),
        username: cleanUsername || undefined,
        email: cleanEmail,
        password: hashPassword(password.trim()),
        phone: (phone || '').trim(),
        city: (city || 'Lahore').trim(),
        address: (address || '').trim(),
        role: 'customer',
        isOwner: false,
        createdAt: new Date().toISOString(),
      };

      usersDB.push(newUser);
      savePersistedData();
      if (req.path.startsWith('/api/auth/')) startSession(req, res, newUser.id);
      res.status(201).json({ success: true, user: sanitizeUser(newUser) });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Registration error' });
    }
  };

  app.post('/api/auth/user/register', handleRegister);
  app.post('/api/auth/register', handleRegister);

  // AUTH: USER LOGIN (Strictly registered database accounts & owner only)
  const handleLogin = (req: express.Request, res: express.Response) => {
    try {
      const { email, username, emailOrUsername, password } = req.body;
      const rawUser = email || username || emailOrUsername;
      if (!rawUser || !password) {
        return res.status(400).json({ error: 'Please provide both email/username and password.' });
      }

      const inputStr = String(rawUser).trim().toLowerCase();
      const passStr = String(password).trim();

      // Check for Owner Credentials
      const isOwnerIdentity = (inputStr === OWNER_USERNAME.toLowerCase() || inputStr === OWNER_EMAIL.toLowerCase());
      const ownerAcc = usersDB.find((usr) => usr.isOwner || usr.username?.toLowerCase() === OWNER_USERNAME.toLowerCase() || usr.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
      const isOwnerPasswordCorrect = (OWNER_PASSWORD && passStr === OWNER_PASSWORD) || (ownerAcc?.password && verifyPassword(passStr, ownerAcc.password));

      if (isOwnerIdentity && isOwnerPasswordCorrect) {
        const safeOwner = ownerAcc ? sanitizeUser(ownerAcc) : {
          id: 'user-owner-1',
          fullName: 'Hammad Ur Rehman (Owner)',
          username: OWNER_USERNAME,
          email: OWNER_EMAIL,
          phone: '+447597030688',
          city: 'Lahore',
          address: 'Shop #G-14, Ground Floor, Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan',
          role: 'admin' as const,
          isOwner: true,
          createdAt: new Date().toISOString(),
        };
        const sessionToken = startSession(req, res, safeOwner.id);
        return res.json({ success: true, token: sessionToken, user: { ...safeOwner, token: sessionToken } });
      }

      // Check registered users in database
      const user = usersDB.find(
        (u) =>
          u.email.toLowerCase() === inputStr ||
          (u.username && u.username.toLowerCase() === inputStr)
      );

      if (!user) {
        return res.status(401).json({
          error: 'No account found with this email. You must create an account on the website first.',
        });
      }

      const isUserPasswordCorrect = verifyPassword(passStr, user.password) || (user.isOwner && OWNER_PASSWORD && passStr === OWNER_PASSWORD);
      if (!isUserPasswordCorrect) {
        return res.status(401).json({ error: 'Wrong password. Please check your credentials and try again.' });
      }

      const sessionToken = startSession(req, res, user.id);
      res.json({ success: true, token: sessionToken, user: { ...sanitizeUser(user), token: sessionToken } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Login error' });
    }
  };

  app.post('/api/auth/user/login', handleLogin);
  app.post('/api/auth/login', handleLogin);

  // AUTH: UPDATE USER PROFILE (Name, Phone, City, Address)
  const handleUpdateProfile = (req: express.Request, res: express.Response) => {
    try {
      const { id, email, fullName, phone, city, address } = req.body;
      const uid = sessionUserId(req) || id;
      
      let user = usersDB.find(u => (uid && u.id === uid) || (email && u.email.toLowerCase() === String(email).trim().toLowerCase()));
      if (!user) {
        return res.status(404).json({ error: 'User account not found' });
      }

      if (fullName && fullName.trim()) user.fullName = fullName.trim();
      if (phone !== undefined) user.phone = String(phone).trim();
      if (city !== undefined) user.city = String(city).trim();
      if (address !== undefined) user.address = String(address).trim();

      savePersistedData();
      res.json({ success: true, user: sanitizeUser(user) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to update profile' });
    }
  };

  app.put('/api/auth/profile', handleUpdateProfile);
  app.post('/api/auth/profile', handleUpdateProfile);
  app.put('/api/auth/user/profile', handleUpdateProfile);
  app.post('/api/auth/user/profile', handleUpdateProfile);

  // --- ADMIN USER MANAGEMENT (OWNER EXCLUSIVE) ---
  // GET ALL USERS
  app.get('/api/admin/users', (req, res) => {
    try {
      const safeList = usersDB.map(sanitizeUser);
      res.json(safeList);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  });

  // CREATE ADMIN USER (Only by Owner in Backend)
  app.post('/api/admin/users', (req, res) => {
    try {
      const { fullName, email, username, password, phone, city, address, role } = req.body;
      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'Full name, email, and password are required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username ? username.trim().toLowerCase() : '';

      const existing = usersDB.find(
        (u) => u.email.toLowerCase() === cleanEmail || (cleanUsername && u.username?.toLowerCase() === cleanUsername)
      );
      if (existing) {
        return res.status(400).json({ error: 'A user with this email or username already exists.' });
      }

      const targetRole = role === 'admin' ? 'admin' : 'customer';

      const newUser: StoredUserAccount = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fullName: fullName.trim(),
        username: cleanUsername || undefined,
        email: cleanEmail,
        password: hashPassword(String(password).trim()),
        phone: (phone || '').trim(),
        city: city || 'Lahore',
        address: address || '',
        role: targetRole,
        isOwner: false,
        createdAt: new Date().toISOString(),
      };

      usersDB.push(newUser);
      savePersistedData();
      if (req.path.startsWith('/api/auth/')) startSession(req, res, newUser.id);
      res.status(201).json({ success: true, user: sanitizeUser(newUser) });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to create user' });
    }
  });

  // UPDATE USER (Owner Only)
  app.put('/api/admin/users/:id', (req, res) => {
    try {
      const userId = req.params.id;
      const index = usersDB.findIndex((u) => u.id === userId);
      if (index === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      const existing = usersDB[index];
      if (existing.isOwner && req.body.role && req.body.role !== 'admin') {
        return res.status(400).json({ error: 'Cannot remove admin role from primary owner account' });
      }

      const updated: StoredUserAccount = {
        ...existing,
        fullName: req.body.fullName ?? existing.fullName,
        phone: req.body.phone ?? existing.phone,
        city: req.body.city ?? existing.city,
        address: req.body.address ?? existing.address,
        role: req.body.role === 'admin' ? 'admin' : req.body.role === 'customer' ? 'customer' : existing.role,
        password: req.body.password ? hashPassword(String(req.body.password).trim()) : existing.password,
      };

      usersDB[index] = updated;
      savePersistedData();
      res.json({ success: true, user: sanitizeUser(updated) });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to update user' });
    }
  });

  // DELETE USER (Owner Only)
  app.delete('/api/admin/users/:id', (req, res) => {
    try {
      const rawId = req.params.id;
      const targetId = decodeURIComponent(rawId).trim();
      const user = usersDB.find((u) => u.id === targetId || u.id === rawId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found in database' });
      }

      if (
        user.isOwner ||
        user.username?.toLowerCase() === OWNER_USERNAME.toLowerCase() ||
        user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
      ) {
        return res.status(400).json({ success: false, error: 'Cannot delete the primary store owner account.' });
      }

      usersDB = usersDB.filter((u) => u.id !== user.id);
      savePersistedData();
      res.json({ success: true, message: `Account "${user.fullName}" deleted successfully` });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to delete user' });
    }
  });

  // ORDERS: GET (Supports both /api/orders and /api/user/orders)
  const handleGetOrders = (req: express.Request, res: express.Response) => {
    try {
      const { userId, email } = req.query;
      const uid = sessionUserId(req);
      const user = uid ? usersDB.find(u => u.id === uid) : null;
      
      let list = ordersDB.map((o) => {
        if (Array.isArray(o.items) && o.items.length > 0) {
          const itemSum = o.items.reduce((sum: number, it: any) => {
            const p = Number(it.price ?? it.unitPrice ?? 0);
            const q = Number(it.quantity || 1);
            return sum + p * q;
          }, 0);
          if (itemSum > 0 && (!o.subtotal || o.subtotal === 0 || o.total <= (o.shippingFee || 1500))) {
            const subtotal = itemSum;
            const shippingFee = Number(o.shippingFee) || (subtotal >= 100000 ? 0 : 1500);
            const discount = Number(o.discount) || 0;
            const total = Math.max(0, subtotal + shippingFee - discount);
            return {
              ...o,
              subtotal,
              shippingFee,
              total,
            };
          }
        }
        return o;
      });

      if (user && user.role !== 'admin') {
        const uEmail = (user.email || '').trim().toLowerCase();
        const uPhone = (user.phone || '').replace(/[^0-9]/g, '');
        list = list.filter((o) => {
          if (o.userId && o.userId === user.id) return true;
          if (uEmail && o.customer?.email && o.customer.email.trim().toLowerCase() === uEmail) return true;
          if (uPhone && o.customer?.phone) {
            const op = o.customer.phone.replace(/[^0-9]/g, '');
            if (op && (op === uPhone || op.endsWith(uPhone) || uPhone.endsWith(op))) return true;
          }
          return false;
        });
      } else if (!user && (userId || email || req.query.phone)) {
        const cleanEmail = email ? String(email).trim().toLowerCase() : '';
        const cleanPhone = req.query.phone ? String(req.query.phone).replace(/[^0-9]/g, '') : '';
        const cleanUid = userId ? String(userId).trim() : '';
        list = list.filter((o) => {
          if (cleanUid && o.userId === cleanUid) return true;
          if (cleanEmail && o.customer?.email?.trim().toLowerCase() === cleanEmail) return true;
          if (cleanPhone && o.customer?.phone) {
            const op = o.customer.phone.replace(/[^0-9]/g, '');
            if (op && (op === cleanPhone || op.endsWith(cleanPhone) || cleanPhone.endsWith(op))) return true;
          }
          return false;
        });
      }

      res.json(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Could not fetch orders' });
    }
  };

  app.get('/api/orders', handleGetOrders);
  app.get('/api/user/orders', handleGetOrders);

  // ORDERS: LOOKUP by ID, Order Number, Tracking Number or Phone
  app.get('/api/orders/lookup', (req, res) => {
    try {
      const query = String(req.query.query || req.query.id || req.query.orderNumber || '').trim().toLowerCase();
      if (!query) {
        return res.status(400).json({ success: false, error: 'Please provide an Order ID or Tracking Number to search.' });
      }

      const cleanQuery = query.replace(/^#/, '');

      const foundOrder = ordersDB.find((o) => {
        const orderNum = (o.orderNumber || '').toLowerCase().replace(/^#/, '');
        const orderId = (o.id || '').toLowerCase();
        const tracking = (o.trackingNumber || '').toLowerCase();
        const phone = (o.customer?.phone || '').replace(/[^0-9]/g, '');
        const searchPhone = cleanQuery.replace(/[^0-9]/g, '');

        return (
          orderNum === cleanQuery ||
          orderId === cleanQuery ||
          tracking === cleanQuery ||
          false
        );
      });

      if (!foundOrder) {
        return res.status(404).json({
          success: false,
          error: `No order found matching "${req.query.query}". Please check your order ID or tracking code.`,
        });
      }

      const viewer = usersDB.find(u => u.id === sessionUserId(req));
      const canRead = viewer && (viewer.role === 'admin' || foundOrder.userId === viewer.id || foundOrder.customer.email?.toLowerCase() === viewer.email.toLowerCase());
      if (!canRead) return res.status(401).json({ error: 'Sign in to the account that placed this order to view its details.' });
      res.json({ success: true, order: foundOrder });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Lookup search failed' });
    }
  });

  // COURIERS LIST: All Pakistan couriers available on Track123
  app.get('/api/tracking/couriers', (req, res) => {
    try {
      res.json({ success: true, couriers: PAKISTAN_TRACK123_COURIERS });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to fetch couriers list' });
    }
  });

  // LIVE SHIPMENT TRACKING via Track123 API Gateway
  app.get('/api/tracking/live', async (req, res) => {
    try {
      const query = String(req.query.trackNo || req.query.query || req.query.orderNumber || '').trim();
      const requestedCourier = String(req.query.courierCode || req.query.carrier || req.query.courier || 'auto').trim();

      if (!query) {
        return res.status(400).json({ success: false, error: 'Tracking number or Order Number is required.' });
      }

      const cleanQuery = query.replace(/^#/, '');

      // Check if it's an internal order first
      const matchedOrder = ordersDB.find((o) => {
        const orderNum = (o.orderNumber || '').toLowerCase().replace(/^#/, '');
        const orderId = (o.id || '').toLowerCase();
        const tracking = (o.trackingNumber || '').toLowerCase();
        return (
          orderNum === cleanQuery.toLowerCase() ||
          orderId === cleanQuery.toLowerCase() ||
          tracking === cleanQuery.toLowerCase()
        );
      });

      let trackNoToQuery = cleanQuery;
      let orderNoForTracking: string | undefined = undefined;
      let resolvedCourierCode = requestedCourier;

      if (matchedOrder) {
        orderNoForTracking = matchedOrder.orderNumber;
        const isStorePickup = (matchedOrder.paymentMethod || '').toLowerCase().includes('pickup') || (matchedOrder.courierName || '').toLowerCase().includes('pickup') || (matchedOrder.courierName || '').toLowerCase().includes('store');
        const hasPcBuild = matchedOrder.items?.some((i: any) => i.isCustomRig || i.category === 'Pre-Built PC' || (i.category && i.category.toLowerCase().includes('build')));

        // If it's a store pickup order, return custom store pickup tracking without calling external Track123
        if (isStorePickup) {
          return res.json({
            success: true,
            order: matchedOrder,
            tracking: {
              trackingNumber: matchedOrder.orderNumber,
              courierCode: 'store_pickup',
              courierName: 'ApexRig Store Pickup (Hafeez Centre Lahore)',
              transitStatus: matchedOrder.status === 'Delivered' ? 'DELIVERED' : 'PICKED_UP',
              transitStatusDisplay: matchedOrder.status === 'Delivered' ? 'Picked Up / Delivered' : 'Ready for In-Store Pickup',
              originCity: 'Hafeez Centre, Lahore, Pakistan',
              destinationCity: matchedOrder.customer?.city || 'Lahore',
              latestEvent: matchedOrder.status === 'Delivered'
                ? 'Order physically collected by customer from Hafeez Centre flagship store.'
                : 'Order registered for in-store pickup at Shop 12-A, 3rd Floor, Hafeez Centre, Lahore. Ready for collection.',
              estimatedDelivery: 'Ready for Collection',
              carrierPhone: '+447597030688',
              carrierWebsite: 'https://apexforge.pk',
              directTrackingUrl: 'https://apexforge.pk',
              checkpoints: [
                {
                  time: matchedOrder.createdAt,
                  status: 'Order Placed for Store Pickup',
                  location: 'Hafeez Centre Flagship Store, Lahore',
                  details: 'Order verified and reserved in store inventory.',
                  transitStatus: 'PENDING_PICKUP',
                },
                {
                  time: new Date(new Date(matchedOrder.createdAt).getTime() + 2 * 60 * 60 * 1000).toISOString(),
                  status: matchedOrder.status === 'Delivered' ? 'Collected by Customer' : 'Ready for Handover',
                  location: 'Hafeez Centre Counter, Lahore',
                  details: matchedOrder.status === 'Delivered' ? 'Verified with invoice receipt.' : 'Customer may visit during store hours (11:00 AM - 9:00 PM).',
                  transitStatus: matchedOrder.status === 'Delivered' ? 'DELIVERED' : 'PICKED_UP',
                }
              ]
            }
          });
        }

        // If order has no tracking assigned yet (e.g. PC build awaiting cargo dispatch)
        if (!matchedOrder.trackingNumber) {
          return res.json({
            success: true,
            order: matchedOrder,
            tracking: {
              trackingNumber: matchedOrder.orderNumber,
              courierCode: hasPcBuild ? 'daewoo-fastex' : (matchedOrder.courierName ? detectCourierFromTrackingNumber(matchedOrder.courierName).code : 'auto'),
              courierName: matchedOrder.courierName || (hasPcBuild ? 'Daewoo FastEx (Heavy Cargo Freight)' : 'Pending Express Dispatch'),
              transitStatus: 'PENDING_PICKUP',
              transitStatusDisplay: 'Processing & Packaging',
              originCity: 'Hafeez Centre, Lahore, Punjab',
              destinationCity: matchedOrder.customer?.city || 'Pakistan',
              latestEvent: hasPcBuild
                ? 'Custom PC Rig on assembly & thermal benchmark station. Dedicated courier CN will be assigned upon dispatch.'
                : 'Order packed in bubble-sealed anti-static shipping box. Courier pickup scheduled today.',
              estimatedDelivery: 'Dispatch in 24h',
              checkpoints: [
                {
                  time: matchedOrder.createdAt,
                  status: 'Order Confirmed & Payment Verified',
                  location: 'ApexRig Central Logistics, Lahore',
                  details: hasPcBuild ? 'Custom PC Rig logged for assembly, cable routing, and cargo dispatch.' : 'Inventory allocated for express courier dispatch.',
                  transitStatus: 'PENDING_PICKUP',
                }
              ]
            }
          });
        }

        trackNoToQuery = matchedOrder.trackingNumber;
        if (resolvedCourierCode === 'auto' && matchedOrder.courierName) {
          const detected = PAKISTAN_TRACK123_COURIERS.find(c => c.name.toLowerCase().includes(matchedOrder.courierName!.toLowerCase()) || matchedOrder.courierName!.toLowerCase().includes(c.shortName.toLowerCase()));
          if (detected) resolvedCourierCode = detected.code;
        }
      }

      const result = await queryTrack123Live(
        trackNoToQuery,
        resolvedCourierCode,
        orderNoForTracking
      );

      if (result.success && result.tracking) {
        // Enrich with matched store order metadata if fields are blank
        if (matchedOrder) {
          if (!result.tracking.destinationCity && matchedOrder.customer?.city) {
            result.tracking.destinationCity = matchedOrder.customer.city;
          }
          if (!result.tracking.consignee && matchedOrder.customer?.fullName) {
            result.tracking.consignee = matchedOrder.customer.fullName;
          }
          if (!result.tracking.signedBy && matchedOrder.status === 'Delivered' && matchedOrder.customer?.fullName) {
            result.tracking.signedBy = matchedOrder.customer.fullName;
          }

          const ts = (result.tracking.transitStatus || '').toUpperCase();
          if (ts === 'DELIVERED' && matchedOrder.status !== 'Delivered') {
            matchedOrder.status = 'Delivered';
            matchedOrder.updatedAt = new Date().toISOString();
            savePersistedData();
          } else if ((ts === 'IN_TRANSIT' || ts === 'OUT_FOR_DELIVERY') && matchedOrder.status === 'Pending') {
            matchedOrder.status = 'Shipped';
            matchedOrder.updatedAt = new Date().toISOString();
            savePersistedData();
          }
        }

        return res.json({
          success: true,
          tracking: result.tracking,
          order: matchedOrder || null,
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error || 'No live tracking records found for this shipment.',
          order: matchedOrder || null,
        });
      }
    } catch (e: any) {
      console.error('Tracking API error:', e);
      return res.status(500).json({ success: false, error: e?.message || 'Failed to query live shipment tracking' });
    }
  });

  // LIVE TRACKING: Register or Import into Track123
  app.post('/api/tracking/import', async (req, res) => {
    try {
      const { trackNo, courierCode = 'auto', orderNo } = req.body;
      if (!trackNo) {
        return res.status(400).json({ success: false, error: 'Tracking number is required' });
      }

      const importRes = await importTrack123Tracking(trackNo, courierCode, orderNo);
      res.json(importRes);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Tracking import failed' });
    }
  });

  // LIVE TRACKING: Delete / Unregister from Track123 Gateway
  app.delete('/api/tracking/delete', async (req, res) => {
    try {
      const { trackNo, courierCode = 'auto' } = req.body;
      if (!trackNo) {
        return res.status(400).json({ success: false, error: 'Tracking number is required' });
      }

      const delRes = await deleteTrack123Tracking(trackNo, courierCode);
      res.json(delRes);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Tracking deletion failed' });
    }
  });

  // ORDERS: 1-CLICK DISPATCH VIA LEOPARDS COURIER
  app.post('/api/orders/:id/dispatch-leopards', async (req, res) => {
    try {
      const order = ordersDB.find((o) => o.id === req.params.id || o.orderNumber === req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const leopardsTrackingNo = String(req.body.trackingNumber || order.trackingNumber || '').trim();
      if (!leopardsTrackingNo || /^LCS-\d+-PK$/.test(leopardsTrackingNo)) return res.status(400).json({ error: 'Enter an actual carrier-issued tracking number before dispatch. Track123 tracks shipments; it does not book them.' });
      if (!order.stockDeducted) {
        const totals = new Map<string, number>();
        for (const item of order.items) if (!item.isCustomRig) totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
        for (const [id, quantity] of totals) {
          const product = productsDB.find(p => p.id === id);
          if (!product || product.stockCount < quantity) return res.status(409).json({ error: 'Insufficient stock to dispatch this order.' });
        }
      }
      order.trackingNumber = leopardsTrackingNo;
      order.courierName = 'Leopards Courier';
      order.status = 'Shipped';
      order.updatedAt = new Date().toISOString();

      // Ensure stock is deducted if not already
      if (!order.stockDeducted) {
        order.items.forEach((item: any) => {
          const product = productsDB.find((p: any) => p.id === item.productId);
          if (product) {
            product.stockCount = Math.max(0, product.stockCount - (item.quantity || 1));
          }
        });
        order.stockDeducted = true;
      }

      // Auto-generate or sync Sales Invoice
      try {
        syncSalesInvoiceForConfirmedOrder(order, 'Admin / Store Owner');
      } catch (err) {
        console.warn('Sales Invoice sync notice on dispatch:', err);
      }

      // Register with Track123 gateway
      await importTrack123Tracking(leopardsTrackingNo, 'leopardscourier', order.orderNumber);
      const liveData = await queryTrack123Live(leopardsTrackingNo, 'leopardscourier', order.orderNumber);

      savePersistedData();

      res.json({
        success: true,
        message: `Order ${order.orderNumber} dispatched via Leopards Courier with CN ${leopardsTrackingNo}`,
        order,
        tracking: liveData.tracking,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Leopards dispatch failed' });
    }
  });

  // HELPER: ERP Customer auto-sync from Order
  function syncErpCustomerFromOrder(cust: any): any {
    if (!cust || !cust.fullName) return null;
    const cleanPhone = (cust.phone || '').replace(/[^0-9+]/g, '');
    const cleanEmail = (cust.email || '').trim().toLowerCase();
    const cleanName = (cust.fullName || '').trim().toLowerCase();

    let matched = customersDB.find((c: any) => {
      const cPhone = (c.phone || '').replace(/[^0-9+]/g, '');
      const cEmail = (c.email || '').trim().toLowerCase();
      const cName = (c.name || '').trim().toLowerCase();
      if (cleanPhone && cPhone && (cleanPhone === cPhone || cleanPhone.endsWith(cPhone) || cPhone.endsWith(cleanPhone))) return true;
      if (cleanEmail && cEmail && cleanEmail === cEmail) return true;
      if (cleanName && cName && cleanName === cName) return true;
      return false;
    });

    if (matched) {
      if (cust.email && !matched.email) matched.email = cust.email.trim();
      if (cust.address && !matched.address) matched.address = cust.address.trim();
      if (cust.city && (!matched.city || matched.city === 'Pakistan')) matched.city = cust.city.trim();
      return matched;
    }

    const newCustomer = {
      id: `cust-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      code: `CUST-${String(customersDB.length + 101).padStart(4, '0')}`,
      name: cust.fullName.trim(),
      companyName: '',
      email: cust.email ? cust.email.trim() : '',
      phone: cust.phone ? cust.phone.trim() : '',
      whatsapp: cust.phone ? cust.phone.trim() : '',
      city: cust.city ? cust.city.trim() : 'Lahore',
      address: cust.address ? cust.address.trim() : '',
      ntn: '',
      taxNumber: '',
      strn: '',
      isFiler: false,
      priceTier: 'RETAIL',
      creditLimitPkr: 0,
      creditLimit: 0,
      creditDaysAllowed: 0,
      currentBalancePkr: 0,
      currentBalance: 0,
      totalSalesPkr: 0,
      notes: cust.notes ? `Online Customer • Delivery Notes: ${cust.notes}` : 'Created automatically via Website Order',
      createdAt: new Date().toISOString(),
    };

    customersDB.unshift(newCustomer);
    return newCustomer;
  }

  // HELPER: ERP Sales Invoice auto-generation upon Order Confirmation
  function syncSalesInvoiceForConfirmedOrder(order: any, adminName = 'Admin / Store Owner'): any {
    if (!order) return null;
    const orderNum = (order.orderNumber || '').replace(/^#/, '');
    const invDocNum = `INV-${orderNum}`;

    const existingDoc = salesDocsDB.find(
      (d: any) =>
        d.id === `sdoc-inv-${order.id}` ||
        d.docNumber === invDocNum ||
        d.docNumber === orderNum ||
        d.notes?.includes(order.orderNumber)
    );
    if (existingDoc) {
      return existingDoc;
    }

    const customer = syncErpCustomerFromOrder(order.customer);
    const isPaid = false; // Payment method or delivery is not proof of settlement.

    const grandTotal = Number(order.total) || 0;
    const paidAmount = isPaid ? grandTotal : 0;
    const balanceDue = Math.max(0, grandTotal - paidAmount);

    const items = (order.items || []).map((item: any, idx: number) => ({
      id: `line-${idx}-${Date.now()}`,
      productId: item.productId || `prod-${idx}`,
      productName: item.name || 'Hardware Component',
      sku: item.sku || `SKU-${idx + 100}`,
      category: item.category || 'Hardware',
      quantity: Number(item.quantity) || 1,
      unitCostPkr: productsDB.find(p => p.id === item.productId)?.costPrice ?? 0,
      unitPricePkr: Number(item.price) || 0,
      discountPkr: 0,
      taxRatePercent: 0,
      taxAmountPkr: 0,
      totalPkr: (Number(item.price) || 0) * (Number(item.quantity) || 1),
      warehouseId: 'lahore_hafeez',
      serialNumber: item.serialNumber,
      serialNumbers: item.serialNumbers || (item.serialNumber ? [item.serialNumber] : undefined),
    }));

    const newSalesInvoice = {
      id: `sdoc-inv-${order.id || order.orderNumber}`,
      docNumber: invDocNum,
      type: 'INVOICE',
      customerId: customer ? customer.id : `cust-${order.id}`,
      customerName: order.customer?.fullName || 'Online Customer',
      customerPhone: order.customer?.phone || '',
      customerEmail: order.customer?.email || '',
      customerAddress: `${order.customer?.address || ''}, ${order.customer?.city || ''}`,
      customerNtn: customer?.ntn || '',
      customerIsFiler: customer?.isFiler || false,
      branchId: 'lahore_hafeez',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      termDays: 7,
      previousBalancePkr: customer?.currentBalancePkr || 0,
      status: isPaid ? 'PAID' : 'CONFIRMED',
      items,
      subtotalPkr: Number(order.subtotal) || grandTotal,
      totalDiscountPkr: Number(order.discount) || 0,
      totalGstTaxPkr: 0,
      whtDeductionRate: 0,
      whtDeductionPkr: 0,
      shippingChargesPkr: Number(order.shippingFee) || 0,
      assemblyLaborFeePkr: 0,
      grandTotalPkr: grandTotal,
      paidAmountPkr: paidAmount,
      balanceDuePkr: balanceDue,
      paymentMethod: order.paymentMethod,
      notes: `Sales Invoice generated upon order confirmation for Order #${order.orderNumber}. Payment Method: ${order.paymentMethod}`,
      salesAgent: adminName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByType: 'admin',
      createdByName: adminName,
      editHistory: [],
    };

    salesDocsDB.unshift(newSalesInvoice);

    if (customer) {
      customer.totalSalesPkr = (customer.totalSalesPkr || 0) + grandTotal;
      if (!isPaid) {
        customer.currentBalancePkr = (customer.currentBalancePkr || 0) + balanceDue;
      }
    }

    return newSalesInvoice;
  }

  // ORDERS: CREATE
  app.post('/api/orders', async (req, res) => {
    try {
      const { customer, items, paymentMethod, subtotal, shippingFee, discount = 0, total, userId, source, id, orderNumber: reqOrderNumber } = req.body;

      if (!customer?.fullName || !customer?.phone || !items?.length) {
        return res.status(400).json({ error: 'Customer contact and cart items are required' });
      }

      if (id && ordersDB.some(o => o.id === id)) return res.status(409).json({ error: 'Order ID already exists.' });
      if (reqOrderNumber && ordersDB.some(o => o.orderNumber === reqOrderNumber)) return res.status(409).json({ error: 'Order number already exists.' });
      if (!Array.isArray(items) || items.some((item: any) => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.price) || item.price < 0) || [subtotal, shippingFee, discount, total].some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return res.status(400).json({ error: 'Invalid order quantities or amounts.' });
      // Automatically register customer in ERP suite
      syncErpCustomerFromOrder(customer);

      const methodStr = (paymentMethod || 'Cash on Delivery (COD)').trim();
      const isStorePickup = methodStr.toLowerCase().includes('pickup');
      const hasPcBuild = items.some((i: any) => {
        if (i.isCustomRig) return true;
        if (i.rigConfig && Object.keys(i.rigConfig).length > 0) return true;
        const cat = (i.category || '').toLowerCase();
        if (cat.includes('pre-built') || cat.includes('custom pc') || cat.includes('pc build') || cat.includes('gaming pc')) return true;
        const name = (i.name || '').toLowerCase();
        if (name.includes('custom pc rig') || name.includes('pre-built gaming') || name.includes('workstation rig')) return true;
        return false;
      });

      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      const orderNumber = reqOrderNumber || `APX-${randomDigits}`;

      let trackingNumber: string | undefined = undefined;
      let courierName = 'Store Pickup';

      if (isStorePickup) {
        // Local Store pickup: NO tracking auto-assigned to save API tokens
        trackingNumber = undefined;
        courierName = 'Store Pickup';
      } else if (hasPcBuild) {
        // Full PC Build: Shipped via dedicated Cargo service (Daewoo/Faisal Movers).
        // Tracking number is manually assigned by admin after build & bench testing.
        trackingNumber = undefined;
        courierName = 'Cargo Service';
      } else {
        trackingNumber = undefined;
        courierName = 'Leopards Courier';
        // An actual carrier-issued tracking number is assigned during dispatch.
      }

      const uidFromSession = sessionUserId(req);
      const effectiveUserId = uidFromSession || (typeof userId === 'string' && userId.trim() ? userId.trim() : undefined);
      const actor = usersDB.find(u => u.id === (uidFromSession || effectiveUserId));
      let pricing;
      try {
        pricing = actor?.role === 'admin' ? { items, subtotal, shippingFee, discount, total } : priceStoreOrder(items, productsDB, storeSettings, methodStr);
      } catch (error: any) { return res.status(400).json({ error: error.message }); }
      const newOrder: Order = {
        id: id || `ord-${Date.now()}`,
        orderNumber,
        customer,
        items,
        subtotal: Number(subtotal) || 0,
        shippingFee: Number(shippingFee) || 0,
        discount: Number(discount) || 0,
        total: Number(total) || 0,
        paymentMethod: methodStr,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: effectiveUserId,
        source: actor?.role === 'admin' && source === 'ERP' ? 'ERP' : 'Website',
        trackingNumber,
        courierName,
      };

      Object.assign(newOrder, pricing);
      ordersDB.unshift(newOrder);
      savePersistedData();
      // Return order both directly and nested for client compatibility
      res.status(201).json({ success: true, order: newOrder, ...newOrder });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Order creation failed' });
    }
  });

  // ORDERS: UPDATE STATUS & LOGISTICS (Admin)
  app.put('/api/orders/:id/status', async (req, res) => {
    const { status, trackingNumber, courierName } = req.body;
    const orderId = req.params.id;
    const order = ordersDB.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status && !['Pending', 'Verified', 'Confirmed', 'Assembling', 'Testing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }
    
    // Deduct stock and automatically generate ERP Sales Invoice when order is confirmed/in progress
    const isConfirmedStatus = status === 'Verified' || status === 'Confirmed' || status === 'Assembling' || status === 'Testing' || status === 'Shipped' || status === 'Delivered';
    
    if (isConfirmedStatus && !order.stockDeducted) {
      // Safely deduct stock for physical products without blocking the status update
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (!item.isCustomRig && item.productId) {
            const product = productsDB.find(p => p.id === item.productId);
            if (product) {
              product.stockCount = Math.max(0, (product.stockCount || 0) - item.quantity);
              if (item.variantId && Array.isArray(product.variants)) {
                const variant = product.variants.find(v => v.id === item.variantId);
                if (variant) {
                  variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                }
              }
            }
          }
        });
      }
      order.stockDeducted = true;

      // Automatically generate or sync ERP Sales Invoice
      try {
        const linkedInvoice = salesDocsDB.find(d => d.id === `sdoc-inv-${order.id}` || d.id === order.id || d.docNumber === `INV-${order.orderNumber}` || d.docNumber === order.orderNumber);
        if (linkedInvoice?.status === 'CANCELLED') {
          const previous = { ...linkedInvoice };
          linkedInvoice.status = 'CONFIRMED';
          customersDB = applySalesCustomerChange(customersDB, previous, linkedInvoice);
        }
        syncSalesInvoiceForConfirmedOrder(order, 'Admin / Store Owner');
      } catch (err) {
        console.warn('Sales Invoice auto-generation notice:', err);
      }
    }

    if (status === 'Cancelled' && order.stockDeducted) {
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (!item.isCustomRig && item.productId) {
            const product = productsDB.find(p => p.id === item.productId);
            if (product) {
              product.stockCount = (product.stockCount || 0) + item.quantity;
              if (item.variantId && Array.isArray(product.variants)) {
                const variant = product.variants.find(v => v.id === item.variantId);
                if (variant) {
                  variant.stock = (variant.stock || 0) + item.quantity;
                }
              }
            }
          }
        });
      }
      order.stockDeducted = false;
    }

    if (status === 'Cancelled') {
      const linkedInvoice = salesDocsDB.find(d => d.id === `sdoc-inv-${order.id}` || d.id === order.id || d.docNumber === `INV-${order.orderNumber}` || d.docNumber === order.orderNumber);
      if (linkedInvoice && linkedInvoice.status !== 'CANCELLED') {
        const previous = { ...linkedInvoice };
        linkedInvoice.status = 'CANCELLED';
        customersDB = applySalesCustomerChange(customersDB, previous, linkedInvoice);
      }
    }

    if (status) order.status = status;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber.trim() || undefined;
    if (courierName !== undefined) order.courierName = courierName.trim() || undefined;
    order.updatedAt = new Date().toISOString();

    // If a Leopards tracking number was assigned/updated, register with Track123 in background
    if (
      order.trackingNumber &&
      (order.courierName?.toLowerCase().includes('leopards') || order.trackingNumber.startsWith('LCS-'))
    ) {
      try {
        await importTrack123Tracking(order.trackingNumber, 'leopardscourier', order.orderNumber);
      } catch (e) {
        console.warn('Track123 registration notice:', e);
      }
    }

    savePersistedData();
    res.json({ success: true, order });
  });

  // ORDERS: ATTACH PAYMENT RECEIPT / SCREENSHOT
  const handlePaymentReceiptUpload = (req: express.Request, res: express.Response) => {
    try {
      const orderId = req.params.id;
      const { paymentScreenshot, image } = req.body;
      const receiptData = paymentScreenshot || image;
      if (!receiptData) {
        return res.status(400).json({ error: 'Please provide a payment screenshot or receipt image.' });
      }

      const order = ordersDB.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      order.paymentScreenshot = receiptData;
      order.paymentScreenshotUploadedAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();

      // If linked invoice exists in ERP, record receipt note
      try {
        const linkedInvoice = salesDocsDB.find(
          (d: any) =>
            d.id === `sdoc-inv-${order.id}` ||
            d.id === order.id ||
            d.docNumber === `INV-${order.orderNumber}` ||
            d.docNumber === order.orderNumber
        );
        if (linkedInvoice) {
          if (!linkedInvoice.notes?.includes('Payment Receipt Screenshot Attached')) {
            linkedInvoice.notes = `${linkedInvoice.notes || ''} • [Payment Receipt Screenshot Attached by Customer]`.trim();
          }
          linkedInvoice.updatedAt = new Date().toISOString();
        }
      } catch {}

      savePersistedData();
      res.json({ success: true, message: 'Payment screenshot attached successfully', order });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to upload payment receipt' });
    }
  };

  app.post('/api/orders/:id/payment-receipt', handlePaymentReceiptUpload);
  app.put('/api/orders/:id/payment-receipt', handlePaymentReceiptUpload);

  // ORDERS: UPDATE (Full order update including items and components)
  app.put('/api/orders/:id', (req, res) => {
    const index = ordersDB.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }
    ordersDB[index] = {
      ...ordersDB[index],
      ...req.body,
      id: ordersDB[index].id,
      updatedAt: new Date().toISOString(),
    };

    // Keep linked ERP Sales Invoice in sync if exists
    try {
      const updatedOrder = ordersDB[index];
      const linkedInvoice = salesDocsDB.find(
        (d: any) =>
          d.id === `sdoc-inv-${updatedOrder.id}` ||
          d.id === updatedOrder.id ||
          d.docNumber === `INV-${updatedOrder.orderNumber}` ||
          d.docNumber === updatedOrder.orderNumber
      );
      if (linkedInvoice && Array.isArray(updatedOrder.items)) {
        linkedInvoice.items = updatedOrder.items.map((it: any, idx: number) => ({
          id: `line-${idx}-${Date.now()}`,
          productId: it.productId || `prod-${idx}`,
          productName: it.name || 'Hardware Component',
          sku: it.sku || `SKU-${idx + 100}`,
          category: it.category || 'Hardware',
          quantity: Number(it.quantity) || 1,
          unitCostPkr: productsDB.find((p) => p.id === it.productId)?.costPrice ?? 0,
          unitPricePkr: Number(it.price) || 0,
          discountPkr: 0,
          taxRatePercent: 0,
          taxAmountPkr: 0,
          totalPkr: (Number(it.price) || 0) * (Number(it.quantity) || 1),
          warehouseId: 'lahore_hafeez',
          serialNumber: it.serialNumber,
          serialNumbers: it.serialNumbers || (it.serialNumber ? [it.serialNumber] : undefined),
        }));
        linkedInvoice.subtotalPkr = Number(updatedOrder.subtotal) || 0;
        linkedInvoice.grandTotalPkr = Number(updatedOrder.total) || 0;
        linkedInvoice.balanceDuePkr = Math.max(0, (linkedInvoice.grandTotalPkr || 0) - (linkedInvoice.paidAmountPkr || 0));
        linkedInvoice.updatedAt = new Date().toISOString();
      }
    } catch (syncErr) {
      console.warn('ERP sales doc sync notice:', syncErr);
    }

    savePersistedData();
    res.json({ success: true, order: ordersDB[index] });
  });

  // ORDERS: DELETE (Admin)
  app.delete('/api/orders/:id', (req, res) => {
    try {
      const orderId = req.params.id;
      const orderToDelete = ordersDB.find((o) => o.id === orderId || o.orderNumber === orderId);
      
      if (orderToDelete) {
        // Restore stock if it was previously deducted
        if (orderToDelete.stockDeducted && Array.isArray(orderToDelete.items)) {
          orderToDelete.items.forEach(item => {
            if (!item.isCustomRig && item.productId) {
              const product = productsDB.find(p => p.id === item.productId);
              if (product) {
                product.stockCount = (product.stockCount || 0) + item.quantity;
                if (item.variantId && Array.isArray(product.variants)) {
                  const variant = product.variants.find(v => v.id === item.variantId);
                  if (variant) {
                    variant.stock = (variant.stock || 0) + item.quantity;
                  }
                }
              }
            }
          });
        }
        
        // Clean up linked sales documents & vouchers for this order
        const linkedDocIds = salesDocsDB
          .filter(d => d.id === orderToDelete.id || d.id === `sdoc-inv-${orderToDelete.id}` || d.docNumber === orderToDelete.orderNumber || d.docNumber === `INV-${orderToDelete.orderNumber}`)
          .map(d => d.id);
        
        if (linkedDocIds.length > 0) {
          vouchersDB = vouchersDB.filter(v => !linkedDocIds.includes(v.invoiceId));
          salesDocsDB = salesDocsDB.filter(d => !linkedDocIds.includes(d.id));
        }

        const initialCount = ordersDB.length;
        ordersDB = ordersDB.filter((o) => o.id !== orderToDelete.id && o.orderNumber !== orderToDelete.orderNumber && o.id !== orderId && o.orderNumber !== orderId);
        savePersistedData();

        return res.json({ success: true, message: `Order #${orderToDelete.orderNumber} deleted successfully`, remainingCount: ordersDB.length });
      }

      const initialCount = ordersDB.length;
      ordersDB = ordersDB.filter((o) => o.id !== orderId && o.orderNumber !== orderId);
      savePersistedData();

      if (ordersDB.length < initialCount) {
        res.json({ success: true, message: `Order ${orderId} removed successfully`, remainingCount: ordersDB.length });
      } else {
        res.status(404).json({ success: false, error: 'Order not found' });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to delete order' });
    }
  });

  // --- PRICE DROP ALERTS ENDPOINTS ---

  // ALERTS: CREATE Price Drop Notification Subscription
  app.post('/api/alerts/price-drop', (req, res) => {
    try {
      const { productId, productName, email, currentPrice, targetPrice, category, productImage } = req.body;
      if (!productId || !email) {
        return res.status(400).json({ success: false, error: 'Product ID and email address are required' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
      }

      const existingProd = productsDB.find((p) => p.id === productId);
      const prodName = productName || existingProd?.name || 'Hardware Component';
      const prodPrice = Number(currentPrice) || Number(existingProd?.price) || 0;
      const img = productImage || existingProd?.image;
      const cat = category || existingProd?.category;

      // Check if user already subscribed to this product
      const existingAlert = alertsDB.find(
        (a) => a.productId === productId && a.email.toLowerCase() === cleanEmail && a.status === 'active'
      );

      if (existingAlert) {
        existingAlert.currentPrice = prodPrice;
        if (targetPrice) existingAlert.targetPrice = Number(targetPrice);
        savePersistedData();
        return res.json({
          success: true,
          message: `Your price drop alert subscription for ${prodName} has been updated.`,
          alert: existingAlert,
        });
      }

      const newAlert: PriceDropAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId,
        productName: prodName,
        productImage: img,
        category: cat,
        email: cleanEmail,
        currentPrice: prodPrice,
        targetPrice: targetPrice ? Number(targetPrice) : undefined,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      alertsDB.unshift(newAlert);
      savePersistedData();

      res.status(201).json({
        success: true,
        message: `Price drop notification active! We will email you at ${cleanEmail} when ${prodName} drops in price.`,
        alert: newAlert,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to save price drop alert' });
    }
  });

  // ALERTS: GET User Alerts or Product Alert Status
  app.get('/api/alerts/price-drop', (req, res) => {
    try {
      const { email, productId } = req.query;
      const viewer = usersDB.find(u => u.id === sessionUserId(req))!;
      let list = viewer.role === 'admin' ? [...alertsDB] : alertsDB.filter(a => a.email.toLowerCase() === viewer.email.toLowerCase());

      if (email) {
        const cleanEmail = String(email).trim().toLowerCase();
        list = list.filter((a) => a.email.toLowerCase() === cleanEmail);
      }
      if (productId) {
        list = list.filter((a) => a.productId === productId);
      }

      res.json(list);
    } catch (e: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve price drop alerts' });
    }
  });

  // ALERTS: DELETE / UNSUBSCRIBE
  app.delete('/api/alerts/price-drop/:id', (req, res) => {
    try {
      const alertId = req.params.id;
      const initial = alertsDB.length;
      const viewer = usersDB.find(u => u.id === sessionUserId(req))!;
      alertsDB = alertsDB.filter(a => a.id !== alertId || (viewer.role !== 'admin' && a.email.toLowerCase() !== viewer.email.toLowerCase()));
      savePersistedData();

      if (alertsDB.length < initial) {
        res.json({ success: true, message: 'Price drop alert cancelled' });
      } else {
        res.status(404).json({ success: false, error: 'Alert not found' });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to delete alert' });
    }
  });

  // --- WISHLIST ENDPOINTS ---

  // WISHLIST: GET All or By User / Email
  app.get('/api/wishlist', (req, res) => {
    try {
      const { userId, email } = req.query;
      const viewer = usersDB.find(u => u.id === sessionUserId(req))!;
      let list = viewer.role === 'admin' ? [...wishlistDB] : wishlistDB.filter(w => w.userId === viewer.id);
      if (userId) {
        list = list.filter((w) => w.userId === userId);
      } else if (email) {
        const cleanEmail = String(email).trim().toLowerCase();
        list = list.filter((w) => w.email?.toLowerCase() === cleanEmail);
      }
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve wishlist items' });
    }
  });

  // WISHLIST: TOGGLE / ADD Item
  app.post('/api/wishlist', (req, res) => {
    try {
      const { productId } = req.body;
      const viewer = usersDB.find(u => u.id === sessionUserId(req))!;
      const userId = viewer.id;
      const email = viewer.email;
      if (!productId) {
        return res.status(400).json({ success: false, error: 'Product ID is required' });
      }

      const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;
      const cleanUserId = userId ? String(userId).trim() : undefined;

      // Find existing
      const existingIndex = wishlistDB.findIndex(
        (w) =>
          w.productId === productId &&
          ((cleanUserId && w.userId === cleanUserId) ||
            (cleanEmail && w.email?.toLowerCase() === cleanEmail) ||
            (!cleanUserId && !cleanEmail))
      );

      if (existingIndex >= 0) {
        // Toggle OFF / Remove
        const removed = wishlistDB.splice(existingIndex, 1);
        savePersistedData();
        return res.json({ success: true, action: 'removed', item: removed[0], count: wishlistDB.length });
      }

      // Toggle ON / Add
      const newItem = {
        id: `wish-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId,
        userId: cleanUserId,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
      };

      wishlistDB.unshift(newItem);
      savePersistedData();
      res.status(201).json({ success: true, action: 'added', item: newItem, count: wishlistDB.length });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to update wishlist' });
    }
  });

  // WISHLIST: DELETE Item by ID
  app.delete('/api/wishlist/:id', (req, res) => {
    try {
      const wishId = req.params.id;
      const initial = wishlistDB.length;
      const viewer = usersDB.find(u => u.id === sessionUserId(req))!;
      wishlistDB = wishlistDB.filter(w => (w.id !== wishId && w.productId !== wishId) || (viewer.role !== 'admin' && w.userId !== viewer.id));
      savePersistedData();

      if (wishlistDB.length < initial) {
        res.json({ success: true, message: 'Wishlist item removed' });
      } else {
        res.status(404).json({ success: false, error: 'Wishlist item not found' });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to remove wishlist item' });
    }
  });


  // Helper function to build high-density compact inventory for fast AI processing
  function getCompactInventoryText() {
    return productsDB
      .filter((p) => p.inStock)
      .map((p) => `- [ID:${p.id}] ${p.name} | Cat:${p.category} | Brand:${p.brand} | Price:Rs.${p.price.toLocaleString()} PKR | Socket:${p.specifications?.socket || 'N/A'} | RAM:${p.specifications?.ramType || 'N/A'} | TDP:${p.specifications?.tdpWatts || 'N/A'}W | PSU:${p.specifications?.psuWattage || p.specifications?.recommendedPsuWatts || 'N/A'}W`)
      .join('\n');
  }

  // --- STREAMING CONVERSATIONAL AI CHAT (LOW LATENCY) ---
  app.post('/api/ai/chat/stream', async (req, res) => {
    const { message, history, currentBuild } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const ai = getGeminiClient();
    if (!ai) {
      res.write(`data: {"text":${JSON.stringify(missingKeyMessage)}}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    const compactInventory = getCompactInventoryText();

    const systemPrompt = `You are "Apex AI Rig Master", the elite hardware architect at ApexRig PC Store (Shop #G-14, Hafeez Centre, Lahore, Pakistan).
Respond quickly, concisely, and practically with Markdown. IMPORTANT: MINIMIZE the use of emojis (use at most 1 or 2 per message, or none at all). Do NOT use weird markdown symbols for lists, just use standard - or 1. list markers.

STRICT INVENTORY & PRICING MANDATE (CRITICAL):
1. You must EXCLUSIVELY use and quote hardware components and exact PKR prices listed in the "AVAILABLE STORE INVENTORY" below.
2. NEVER look up, hallucinate, or reference prices from the internet or other stores. Every store in Pakistan has different pricing, stock, warranty, and dollar conversion criteria. You MUST only quote prices listed on THIS website.
3. If a user asks for a part not in our inventory, clearly tell them that we don't carry that specific item and recommend the closest compatible part available in our STORE INVENTORY with its exact website price.

HARDWARE COMPATIBILITY RULES:
- AMD AM5 (Ryzen 7000/9000/X3D) strictly uses DDR5 RAM and AM5 Mobos (B650/X670).
- AMD AM4 (Ryzen 5000) uses DDR4 and B550.
- Intel LGA1700 (13th/14th Gen) uses DDR4 or DDR5 on B760/Z790.
- Total PSU wattage must exceed CPU TDP + GPU TDP + 150W safety headroom.
- Store offers nationwide insured delivery (Free above 50,000 PKR), 10mo-3yr official local warranty, and 4-hour pre-shipment thermal stress testing.

AVAILABLE STORE INVENTORY (EXACT WEBSITE PARTS & PRICES ONLY):
${compactInventory}`;

    if (ai) {
      try {
        const contents: any[] = [];
        if (Array.isArray(history) && history.length > 0) {
          history.slice(-20).forEach((h: { role: string; text: string }) => {
            if (h && h.text && typeof h.text === 'string' && h.text.trim()) {
              contents.push({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }],
              });
            }
          });
        }

        let contextualMessage = message;
        if (currentBuild && Object.keys(currentBuild).length > 0) {
          const partsDescription = Object.entries(currentBuild)
            .filter(([_, prod]: any) => prod)
            .map(([cat, prod]: any) => `${cat}: ${prod.name} (Rs. ${prod.price?.toLocaleString()} PKR)`)
            .join(', ');
          if (partsDescription) {
            contextualMessage += `\n[User's Current PC Configuration: ${partsDescription}]`;
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: contextualMessage }],
        });

        // Fast streaming using Flash Lite / Flash
        let responseStream;
        try {
          responseStream = await ai.models.generateContentStream({
            model: 'gemini-3.6-flash',
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
            },
          });
        } catch (e1) {
          try {
            responseStream = await ai.models.generateContentStream({
              model: 'gemini-3.6-flash',
              contents,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.MINIMAL,
                },
              },
            });
          } catch (e2) {
            responseStream = await ai.models.generateContentStream({
              model: 'gemini-3.6-flash',
              contents,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });
          }
        }

        for await (const chunk of responseStream) {
          const chunkText = chunk.text || '';
          if (chunkText) {
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        return res.end();
      } catch (streamErr: any) {
        const errMsg = typeof streamErr === 'string' ? streamErr : JSON.stringify(streamErr?.message || streamErr);
        if (!errMsg.includes('429') && !errMsg.includes('quota') && !errMsg.includes('RESOURCE_EXHAUSTED')) {
          console.error('Gemini Stream Error:', streamErr?.message || streamErr);
        }
      }
    }

    // Fallback if AI not available
    const fallbackText = `### ⚡ ApexRig Hardware Consultant\nFor gaming in Pakistan, the **AMD Ryzen 5 7600 with DDR5 & RTX 4060** or **Intel Core i5-13400F** offer the greatest FPS per Rupee! All parts carry official 1-3 year warranties with free nationwide courier on orders over Rs. 50,000.`;
    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  // --- CONVERSATIONAL AI CHAT ASSISTANT (FAST SYNC) ---
  app.post('/api/ai/chat', async (req, res) => {
    const { message, history, currentBuild } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ reply: missingKeyMessage });
    }
    const compactInventory = getCompactInventoryText();

    const systemPrompt = `You are "Apex AI Rig Master", the elite hardware architect and trusted PC gaming & workstation consultant for ApexRig PC & Hardware Store (Located at Shop #G-14, Hafeez Centre, Gulberg III, Lahore, Pakistan).
Respond rapidly and directly using Markdown. IMPORTANT: MINIMIZE the use of emojis (use at most 1 or 2 per message, or none at all). Do NOT use weird markdown symbols for lists, just use standard - or 1. list markers.

STRICT INVENTORY & PRICING MANDATE (CRITICAL):
1. You must ONLY use and quote the hardware components and exact PKR prices listed in the "CURRENT STORE INVENTORY" below.
2. NEVER look up, hallucinate, or reference prices from the internet or other external stores. Every Pakistani store has distinct pricing models, currency exchange rates, and warranty backing. All prices and parts must come STRICTLY from this website.
3. If a component requested by the user is not in our inventory, tell them it is not in stock and recommend the closest alternative from our CURRENT STORE INVENTORY with its exact website price.

YOUR GOALS:
1. Provide friendly, authoritative, and practical advice on custom PC builds, components, compatibility, bottlenecks, gaming FPS expectations, and workflow optimizations.
2. Give clear comparisons between INTEL (LGA1700 / QuickSync / Multitasking) and AMD (AM5 / 3D V-Cache / Longevity).
3. Always quote exact prices in PKR from our store inventory.
4. Keep replies structured, concise, and easy to read using Markdown (bolding, bullet points).

CURRENT STORE INVENTORY (EXACT WEBSITE PARTS & PRICES ONLY):
${compactInventory}

CURRENT STORE CONTACT & POLICIES:
- Address: Hafeez Centre, Main Boulevard Gulberg III, Lahore | WhatsApp Helpline: +447597030688
- Shipping: Free insured delivery across Pakistan on orders above Rs. 50,000 with 4hr thermal stress testing.`;

    if (ai) {
      try {
        // Build contents for multi-turn chat
        const contents: any[] = [];

        if (Array.isArray(history) && history.length > 0) {
          history.slice(-20).forEach((h: { role: string; text: string }) => {
            if (h && h.text && typeof h.text === 'string' && h.text.trim()) {
              contents.push({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }],
              });
            }
          });
        }

        let contextualMessage = message;
        if (currentBuild && Object.keys(currentBuild).length > 0) {
          const partsDescription = Object.entries(currentBuild)
            .filter(([_, prod]: any) => prod)
            .map(([cat, prod]: any) => `${cat}: ${prod.name} (Rs. ${prod.price?.toLocaleString()} PKR)`)
            .join(', ');
          if (partsDescription) {
            contextualMessage += `\n[User's Current PC Builder Configuration: ${partsDescription}]`;
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: contextualMessage }],
        });

        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
            },
          });
        } catch (flashErr1) {
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.MINIMAL,
                },
              },
            });
          } catch (flashErr2) {
            response = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });
          }
        }

        const reply = response.text || "I'm here to help you configure the ultimate PC build! What components or budget are you considering?";
        return res.json({ reply, success: true });
      } catch (err: any) {
        const errMsg = typeof err === 'string' ? err : JSON.stringify(err?.message || err);
        if (!errMsg.includes('429') && !errMsg.includes('quota') && !errMsg.includes('RESOURCE_EXHAUSTED')) {
          console.error('Gemini AI Chat Error:', err?.message || err);
        }
      }
    }

    // Heuristic Smart Fallback when AI key is absent or temporarily throttled
    const lower = message.toLowerCase();
    let reply = "";

    if (lower.includes('intel') && lower.includes('amd')) {
      reply = `### 🥊 Intel vs AMD: Which PC Build is Right for You?

Both platforms have great strengths in the Pakistani market right now:

- **🚀 AMD Ryzen (AM5 / AM4):**
  - **Best for:** Pure gaming performance and longevity.
  - **Top Picks:** **Ryzen 7 7800X3D** (the world's fastest gaming CPU with 3D V-Cache) or **Ryzen 5 7600** for high FPS 1080p/1440p.
  - **Advantage:** The AM5 socket will be supported for multiple future generations, saving you upgrade costs.
  - **Memory:** Requires DDR5 RAM (6000MHz CL30 is the sweet spot).

- **⚡ Intel Core (13th & 14th Gen LGA1700):**
  - **Best for:** Video editing (Adobe Premiere Pro QuickSync), 3D modeling, streaming, and heavy multitasking.
  - **Top Picks:** **Core i5-13400F / 14400F** (value powerhouse) and **Core i7-14700K** (20 cores for intense rendering).
  - **Advantage:** Hybrid P-Core + E-Core architecture and support for both DDR4 and DDR5 motherboards.

👉 **Recommendation:** If your primary focus is **competitive esports & AAA gaming**, pick **AMD AM5**. If you do **heavy video editing or content creation alongside gaming**, choose **Intel LGA1700**!`;
    } else if (lower.includes('amd') || lower.includes('ryzen') || lower.includes('am5')) {
      reply = `### 🚀 AMD Ryzen PC Platform Overview

AMD is the premier choice for modern gaming builds in Pakistan:
- **AM5 Platform (B650 / X670):** Paired with high-speed DDR5 RAM, offers elite frame times and power efficiency.
- **Flagship Gaming:** The **Ryzen 7 7800X3D** dominates 1080p/1440p benchmarks in CS2, Valorant, Warzone, and Cyberpunk.
- **Budget King (AM4):** The **Ryzen 5 5600** on B550 with DDR4 is still the #1 value choice for builds under 170k PKR.

Would you like me to generate a complete custom AMD build tailored to your budget?`;
    } else if (lower.includes('intel') || lower.includes('i5') || lower.includes('i7') || lower.includes('i9')) {
      reply = `### ⚡ Intel Core PC Platform Overview

Intel's 13th & 14th Gen processors on the LGA1700 socket offer exceptional versatility:
- **Intel Core i5-13400F / 14400F:** 10 cores (6P + 4E), outstanding for gaming with RTX 4060 / RTX 4070.
- **Intel Core i7-14700K:** 20 cores (28 threads), unmatched productivity for Adobe Creative Suite, Blender, and Unreal Engine.
- **Intel QuickSync:** Hardware accelerated video decoding makes video editing ultra-smooth.

Would you like me to generate a balanced Intel build with compatible B760/Z790 motherboard and cooling?`;
    } else if (lower.includes('delivery') || lower.includes('shipping') || lower.includes('karachi') || lower.includes('islamabad')) {
      reply = `### 🚚 Nationwide Delivery & Shipping Info

- **Free Delivery:** All orders and custom PC builds above **Rs. 50,000 PKR** qualify for **FREE insured shipping** across Pakistan!
- **Courier Partners:** We ship via **TCS Express, Leopard Courier, and Daewoo Express** with foam double-boxing and wooden GPU bracket reinforcement.
- **Delivery Timeline:**
  - Lahore: Same-day / Next-day delivery.
  - Karachi, Islamabad, Rawalpindi, Faisalabad, Multan: 1 to 2 business days.
  - Rest of Pakistan: 2 to 3 business days.
- **Payment:** Cash on Delivery (COD) available, or direct Meezan Bank online transfer.`;
    } else if (lower.includes('warranty') || lower.includes('guarantee')) {
      reply = `### 🛡️ Official Warranty & Hardware Guarantee

All components at ApexRig come with **100% genuine local brand warranties**:
- **Processors (Intel / AMD):** 10-Month to 3-Year Official Warranty.
- **Graphics Cards (ASUS, MSI, Gigabyte, ZOTAC):** 1 to 3 Years Official Distributor Warranty.
- **Power Supplies & Liquid Coolers:** Up to 5 Years Manufacturer Warranty.
- **Custom Rig Testing:** Every custom PC undergoes **4 hours of stress testing** (FurMark + Cinebench + MemTest) before dispatch.`;
    } else {
      reply = `Hello! I am your **Apex AI Rig Master** 🤖.

I can help you with:
- 🥊 Deciding between **Intel vs AMD** custom rigs.
- 🎯 Recommending the best GPU (RTX 4060, 4070 Super, RX 7800 XT) for your budget and monitor.
- ⚡ Checking PSU wattage and thermal compatibility.
- 💰 Building the highest FPS PC for your budget in PKR.

What kind of PC or hardware question can I assist you with today?`;
    }

    res.json({ reply, success: true });
  });

  // --- AI PRODUCT DESCRIPTION GENERATOR ---
  app.post('/api/ai/generate-product-description', async (req, res) => {
    const { name, brand, category, price, specifications, variants } = req.body;

    const productName = name?.trim() || `${brand || 'Apex'} ${category || 'Component'}`;
    const productBrand = brand?.trim() || 'ApexForge';
    const productCategory = category || 'Hardware';

    // Format specs for context
    const specDetails: string[] = [];
    if (specifications?.socket) specDetails.push(`Socket: ${specifications.socket}`);
    if (specifications?.ramType) specDetails.push(`RAM Generation: ${specifications.ramType}`);
    if (specifications?.formFactor) specDetails.push(`Form Factor: ${specifications.formFactor}`);
    if (specifications?.tdpWatts) specDetails.push(`TDP: ${specifications.tdpWatts}W`);
    if (specifications?.vramGb) specDetails.push(`VRAM: ${specifications.vramGb}GB`);
    if (specifications?.psuWattage) specDetails.push(`Power Output: ${specifications.psuWattage}W`);
    if (specifications?.recommendedPsuWatts) specDetails.push(`Recommended PSU: ${specifications.recommendedPsuWatts}W`);
    if (price) specDetails.push(`Price: Rs. ${Number(price).toLocaleString()} PKR`);

    const specsContext = specDetails.length > 0 ? specDetails.join(', ') : 'Standard high-performance specifications';

    const ai = getGeminiClient();

    if (ai) {
      try {
        const systemPrompt = `You are the lead PC hardware architect and technical copywriter for ApexRig PC & Hardware Store (Hafeez Centre, Lahore, Pakistan).
Your goal is to write a crisp, professional, high-converting, and technically precise 2 to 3 sentence product description for our e-commerce hardware catalog.

GUIDELINES:
1. Emphasize key technological features (architectural generation, VRAM, clock speeds, socket alignment, PCIe generation, memory standard, thermal efficiency, or cooling architecture).
2. Explicitly highlight ideal use cases (e.g. 1440p/4K high-FPS gaming, competitive esports titles, 3D rendering and creative workstations, quiet high-airflow operation).
3. Match the high-end retail aesthetic of the ApexRig catalog (similar to official MSI, ASUS, AMD, Intel, Corsair product pages).
4. Output ONLY the 2-3 sentence description text. Do NOT include quotation marks, markdown headings, bullet points, asterisks, or intro/outro commentary.
5. EXTREMELY IMPORTANT: Pay close attention to the EXACT category. If the category is "PC Case Fans" or "Casing Fans", write about individual airflow cooling fans (RPM, CFM, static pressure, RGB, noise level), NOT about the PC chassis/casing itself!`;

        const callWithTimeout = (promise: Promise<any>, timeoutMs: number = 15000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI generation timed out')), timeoutMs)),
          ]);
        };

        let response: any;
        try {
          response = await callWithTimeout(
            ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: `Generate a product description for:
Product Name: ${productName}
Brand: ${productBrand}
Category: ${productCategory}
Technical Details: ${specsContext}`,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
              },
            }),
            15000
          );
        } catch (err1) {
          try {
            response = await callWithTimeout(
              ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: `Generate a product description for:
Product Name: ${productName}
Brand: ${productBrand}
Category: ${productCategory}
Technical Details: ${specsContext}`,
                config: {
                  systemInstruction: systemPrompt,
                  temperature: 0.7,
                },
              }),
              15000
            );
          } catch (err2) {
            response = null;
          }
        }

        console.log('AI Response:', response?.text);
        const generated = response?.text?.trim().replace(/^["']|["']$/g, '');
        if (generated && generated.length > 20) {
          return res.json({ description: generated, success: true, aiGenerated: true });
        }
      } catch (aiErr: any) {
        const errMsg = typeof aiErr === 'string' ? aiErr : JSON.stringify(aiErr?.message || aiErr);
        if (!errMsg.includes('429') && !errMsg.includes('quota') && !errMsg.includes('RESOURCE_EXHAUSTED')) {
          console.error('Gemini Product Description Error:', aiErr?.message || aiErr);
        }
      }
    }

    return res.json({ error: 'AI description generation failed or timed out. Please verify your Gemini API connection and try again.', success: false });
  });

  // --- AI HARDWARE SPECIFICATIONS AUTO-FILL ENGINE ---
  app.post('/api/ai/fetch-hardware-specs', async (req, res) => {
    try {
      const { productName, brand, category, schemaAttributes, schema } = req.body;

      if (!productName || typeof productName !== 'string' || !productName.trim()) {
        return res.status(400).json({ success: false, error: 'Product name is required for hardware specification lookup.' });
      }

      const pName = productName.trim();
      const pBrand = (brand || '').trim();
      const pCategory = (category || 'Processor').trim();

      // Find the category schema from DB or default
      let targetSchema = categoryAttributesDB.find(
        (s) => s.category.toLowerCase() === pCategory.toLowerCase()
      );
      if (!targetSchema) {
        targetSchema = DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS.find(
          (s) => s.category.toLowerCase() === pCategory.toLowerCase()
        );
      }

      const attributesToFill: CategoryAttributeDefinition[] = 
        Array.isArray(schemaAttributes) && schemaAttributes.length > 0
          ? schemaAttributes
          : Array.isArray(schema?.attributes) && schema.attributes.length > 0
          ? schema.attributes
          : targetSchema?.attributes || [];

      const attributeDescriptions = attributesToFill.map(
        (attr) => `- ID: "${attr.id}" | Name: "${attr.name}" | Type: ${attr.type} ${attr.unit ? `(${attr.unit})` : ''} ${attr.options ? `[Allowed Options: ${attr.options.join(', ')}]` : ''}`
      ).join('\n');

      const ai = getGeminiClient();

      if (ai) {
        try {
          const systemPrompt = `You are a world-class PC hardware engineering database expert.
Your mission is to look up and output exact, verified real-world hardware specifications for the specified PC component, peripheral, or gaming gear.
Use your Google Search tool to find the exact official specifications for the product if you are not absolutely certain. Do not guess.

INPUT:
- Product Name: ${pName}
- Brand: ${pBrand || 'Auto-detect'}
- Category: ${pCategory}

ATTRIBUTES TO MAP:
${attributeDescriptions || 'Extract standard hardware technical specifications.'}

INSTRUCTIONS:
1. Use Google Search to identify the exact real-world hardware model and its official specifications (e.g. Ryzen 7 7800X3D, Core i5 13400F, MSI B650M Gaming Plus, RTX 4070 SUPER, Corsair Vengeance 32GB 6000MHz, etc.).
2. Accurately map and format technical values for both standard core fields AND dynamic category schema attributes.
3. For customAttributes, populate keys using the exact attribute IDs provided in ATTRIBUTES TO MAP.
4. For select types with options, choose the closest matching option string.
5. Return valid, well-structured JSON ONLY. Do NOT wrap the JSON in Markdown formatting, just output the raw JSON string.`;

          const prompt = `Provide the verified hardware specifications for "${pName}" (Category: ${pCategory}, Brand: ${pBrand || 'Auto'}).
Format your response as a JSON object with this exact structure:
{
  "productName": "${pName}",
  "brand": "${pBrand || 'Auto-detected Brand'}",
  "category": "${pCategory}",
  "specifications": {
    "socket": "AM5 / LGA1700 / etc. (or empty if not a CPU/Mobo)",
    "ramType": "DDR5 / DDR4 / etc. (or empty if not RAM/CPU/Mobo)",
    "formFactor": "ATX / Micro-ATX / etc. (or empty if not Mobo/Case/PSU)",
    "tdpWatts": 120,
    "vramGb": 16,
    "recommendedPsuWatts": 750,
    "psuWattage": 850,
    "storageType": "NVMe PCIe 4.0 / SATA SSD (or empty if not storage)",
    "storageCapacity": "1TB / 2TB (or empty if not storage)",
    "readSpeedMb": 7000,
    "coolerType": "360mm AIO / Air Cooler (or empty if not cooler)",
    "rgbType": "ARGB / Auto-RGB / Non-RGB",
    "customAttributes": {
      "<attribute_id>": "Exact formatted specification value"
    }
  },
  "summaryHighlights": [
    "Key spec bullet 1",
    "Key spec bullet 2",
    "Key spec bullet 3"
  ],
  "shortDescription": "2-sentence technical summary"
}`;

          const callWithTimeout = (promise: Promise<any>, timeoutMs: number = 7000) => {
            return Promise.race([
              promise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('AI spec lookup timed out')), timeoutMs)),
            ]);
          };

          let aiResponse: any;
          try {
            aiResponse = await callWithTimeout(
              ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
                config: {
                  systemInstruction: systemPrompt,
                  temperature: 0.2,
                  tools: [{ googleSearch: {} }],
                },
              }),
              12000
            );
          } catch (e1) {
            try {
              aiResponse = await callWithTimeout(
                ai.models.generateContent({
                  model: 'gemini-3.6-flash',
                  contents: prompt,
                  config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.2,
                    tools: [{ googleSearch: {} }],
                  },
                }),
                10000
              );
            } catch (e2) {
              aiResponse = await callWithTimeout(
                ai.models.generateContent({
                  model: 'gemini-3.6-flash',
                  contents: prompt,
                  config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                  },
                }),
                10000
              );
            }
          }

          const rawText = aiResponse?.text?.trim() || '';
          if (rawText) {
            let parsedData: any = null;
            try {
              parsedData = JSON.parse(rawText);
            } catch (pErr) {
              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
              }
            }

            if (parsedData && parsedData.specifications) {
              // Ensure customAttributes dictionary exists
              const customAttrs = parsedData.specifications.customAttributes || {};
              
              // If Gemini put some attributes at the root of specifications instead of customAttributes, merge them
              attributesToFill.forEach((attr) => {
                if (customAttrs[attr.id] === undefined) {
                  if (parsedData.specifications[attr.id] !== undefined) {
                    customAttrs[attr.id] = parsedData.specifications[attr.id];
                  } else if (parsedData[attr.id] !== undefined) {
                    customAttrs[attr.id] = parsedData[attr.id];
                  }
                }
              });

              parsedData.specifications.customAttributes = customAttrs;

              return res.json({
                success: true,
                source: 'gemini-ai',
                aiGenerated: true,
                productName: pName,
                brand: parsedData.brand || pBrand,
                category: pCategory,
                specifications: parsedData.specifications,
                specs: parsedData.specifications,
                summaryHighlights: parsedData.summaryHighlights || [],
                description: parsedData.shortDescription || parsedData.description || '',
                summary: parsedData.shortDescription || parsedData.description || '',
              });
            }
          }
        } catch (geminiErr: any) {
          const errMsg = typeof geminiErr === 'string' ? geminiErr : JSON.stringify(geminiErr?.message || geminiErr);
          if (!errMsg.includes('429') && !errMsg.includes('quota') && !errMsg.includes('RESOURCE_EXHAUSTED')) {
            console.warn('[AI Specs Engine] Gemini lookup warning:', geminiErr?.message || geminiErr);
          }
        }
      }

      // Offline Hardware Heuristic Parser Fallback (Multi-Category Support)
      const lower = pName.toLowerCase();
      const customAttributes: Record<string, any> = {};
      const specifications: any = {
        customAttributes,
      };

      const detectedBrand = pBrand || (
        lower.includes('hyperx') ? 'HyperX' :
        lower.includes('razer') ? 'Razer' :
        lower.includes('logitech') ? 'Logitech' :
        lower.includes('corsair') ? 'Corsair' :
        lower.includes('steelseries') ? 'SteelSeries' :
        lower.includes('asus') || lower.includes('rog') || lower.includes('tuf') ? 'ASUS' :
        lower.includes('msi') ? 'MSI' :
        lower.includes('gigabyte') || lower.includes('aorus') ? 'Gigabyte' :
        lower.includes('redragon') ? 'Redragon' :
        lower.includes('keychron') ? 'Keychron' :
        lower.includes('samsung') ? 'Samsung' :
        lower.includes('zowie') || lower.includes('benq') ? 'BenQ ZOWIE' :
        lower.includes('cooler master') ? 'Cooler Master' :
        lower.includes('deepcool') ? 'DeepCool' :
        lower.includes('lian li') ? 'Lian Li' :
        lower.includes('g.skill') || lower.includes('trident') ? 'G.Skill' :
        lower.includes('kingston') ? 'Kingston' :
        lower.includes('crucial') ? 'Crucial' :
        lower.includes('western digital') || lower.includes('wd black') || lower.includes('wd blue') ? 'Western Digital' :
        lower.includes('amd') || lower.includes('ryzen') ? 'AMD' :
        lower.includes('intel') ? 'Intel' :
        lower.includes('nvidia') ? 'NVIDIA' : 'ApexForge'
      );

      // 1. Processors (CPUs)
      if (pCategory.toLowerCase().includes('processor') || (pCategory.toLowerCase().includes('cpu') && !pCategory.toLowerCase().includes('cooler'))) {
        if (lower.includes('am5') || lower.includes('7800x3d') || lower.includes('7600') || lower.includes('7700') || lower.includes('7900') || lower.includes('7950') || lower.includes('9700') || lower.includes('9800') || lower.includes('9900') || lower.includes('9950') || lower.includes('9600')) {
          specifications.socket = 'AM5';
          specifications.ramType = 'DDR5';
          specifications.tdpWatts = lower.includes('x3d') || lower.includes('7900') || lower.includes('7950') ? 120 : 65;
          customAttributes['socket'] = 'AM5';
          customAttributes['memory_support'] = 'DDR5 Only';
          customAttributes['pcie_support'] = 'PCIe 5.0';
          if (lower.includes('7800x3d')) {
            specifications.cores = 8;
            specifications.threads = 16;
            specifications.baseClockGhz = 4.2;
            specifications.boostClockGhz = 5.0;
            customAttributes['cores_threads'] = '8 Cores / 16 Threads';
            customAttributes['base_clock'] = '4.2';
            customAttributes['boost_clock'] = '5.0';
            customAttributes['cache_memory'] = '104MB (32MB L2 + 64MB 3D V-Cache)';
            customAttributes['tdp_power_draw'] = 120;
          } else if (lower.includes('7600')) {
            specifications.cores = 6;
            specifications.threads = 12;
            specifications.baseClockGhz = 3.8;
            specifications.boostClockGhz = 5.1;
            customAttributes['cores_threads'] = '6 Cores / 12 Threads';
            customAttributes['base_clock'] = '3.8';
            customAttributes['boost_clock'] = '5.1';
            customAttributes['cache_memory'] = '38MB';
            customAttributes['tdp_power_draw'] = 65;
          }
        } else if (lower.includes('am4') || lower.includes('5600') || lower.includes('5700') || lower.includes('5800') || lower.includes('5900') || lower.includes('5950')) {
          specifications.socket = 'AM4';
          specifications.ramType = 'DDR4';
          specifications.tdpWatts = 65;
          customAttributes['socket'] = 'AM4';
          customAttributes['memory_support'] = 'DDR4 Only';
          customAttributes['pcie_support'] = 'PCIe 4.0';
          if (lower.includes('5600')) {
            specifications.cores = 6;
            specifications.threads = 12;
            specifications.baseClockGhz = 3.5;
            specifications.boostClockGhz = 4.4;
            customAttributes['cores_threads'] = '6 Cores / 12 Threads';
            customAttributes['base_clock'] = '3.5';
            customAttributes['boost_clock'] = '4.4';
            customAttributes['cache_memory'] = '35MB';
          }
        } else if (lower.includes('intel') || lower.includes('i5') || lower.includes('i7') || lower.includes('i9') || lower.includes('13400') || lower.includes('13600') || lower.includes('13700') || lower.includes('14700') || lower.includes('14900')) {
          specifications.socket = 'LGA1700';
          specifications.ramType = 'DDR5 / DDR4';
          specifications.tdpWatts = lower.includes('k') ? 125 : 65;
          customAttributes['socket'] = 'LGA1700';
          customAttributes['memory_support'] = 'DDR4 / DDR5';
          customAttributes['pcie_support'] = 'PCIe 5.0';
          if (lower.includes('13400') || lower.includes('14400')) {
            specifications.cores = 10;
            specifications.threads = 16;
            specifications.baseClockGhz = 2.5;
            specifications.boostClockGhz = 4.6;
            customAttributes['cores_threads'] = '10 Cores (6P + 4E) / 16 Threads';
            customAttributes['base_clock'] = '2.5';
            customAttributes['boost_clock'] = '4.6';
            customAttributes['cache_memory'] = '20MB Intel Smart Cache';
          }
        }
      } 
      // 2. Graphic Cards (GPUs)
      else if (pCategory.toLowerCase().includes('graphic') || pCategory.toLowerCase().includes('gpu')) {
        if (lower.includes('5090')) {
          specifications.vramGb = 32;
          specifications.recommendedPsuWatts = 1000;
          specifications.tdpWatts = 600;
          customAttributes['vram_capacity'] = '32GB';
          customAttributes['vram_type'] = 'GDDR7';
          customAttributes['recommended_psu'] = 1000;
        } else if (lower.includes('5080')) {
          specifications.vramGb = 16;
          specifications.recommendedPsuWatts = 850;
          specifications.tdpWatts = 400;
          customAttributes['vram_capacity'] = '16GB';
          customAttributes['vram_type'] = 'GDDR7';
          customAttributes['recommended_psu'] = 850;
        } else if (lower.includes('5070')) {
          specifications.vramGb = 12;
          specifications.recommendedPsuWatts = 750;
          specifications.tdpWatts = 250;
          customAttributes['vram_capacity'] = '12GB';
          customAttributes['vram_type'] = 'GDDR7';
          customAttributes['recommended_psu'] = 750;
        } else if (lower.includes('4070')) {
          specifications.vramGb = lower.includes('ti super') ? 16 : 12;
          specifications.recommendedPsuWatts = 750;
          specifications.tdpWatts = 220;
          customAttributes['vram_capacity'] = lower.includes('ti super') ? '16GB' : '12GB';
          customAttributes['vram_type'] = 'GDDR6X';
          customAttributes['recommended_psu'] = 750;
        } else if (lower.includes('4060')) {
          specifications.vramGb = 8;
          specifications.recommendedPsuWatts = 550;
          specifications.tdpWatts = 115;
          customAttributes['vram_capacity'] = '8GB';
          customAttributes['vram_type'] = 'GDDR6';
          customAttributes['recommended_psu'] = 550;
        }
      } 
      // 3. Motherboards
      else if (pCategory.toLowerCase().includes('motherboard') || pCategory.toLowerCase().includes('mobo')) {
        if (lower.includes('b650') || lower.includes('x670') || lower.includes('x870') || lower.includes('b850') || lower.includes('a620')) {
          specifications.socket = 'AM5';
          specifications.ramType = 'DDR5';
          specifications.formFactor = lower.includes('m-') || lower.includes('m ') || lower.includes('micro') ? 'Micro-ATX' : 'ATX';
          customAttributes['socket'] = 'AM5';
          customAttributes['chipset'] = lower.includes('b650') ? 'AMD B650' : lower.includes('x670') ? 'AMD X670' : 'AMD AM5';
          customAttributes['ram_type'] = 'DDR5';
          customAttributes['form_factor'] = specifications.formFactor;
        } else if (lower.includes('b760') || lower.includes('z790') || lower.includes('h610') || lower.includes('b660')) {
          specifications.socket = 'LGA1700';
          specifications.ramType = lower.includes('d4') || lower.includes('ddr4') ? 'DDR4' : 'DDR5';
          specifications.formFactor = lower.includes('m-') || lower.includes('m ') || lower.includes('micro') ? 'Micro-ATX' : 'ATX';
          customAttributes['socket'] = 'LGA1700';
          customAttributes['chipset'] = lower.includes('b760') ? 'Intel B760' : lower.includes('z790') ? 'Intel Z790' : 'Intel LGA1700';
          customAttributes['ram_type'] = specifications.ramType;
          customAttributes['form_factor'] = specifications.formFactor;
        }
      }
      // 4. Gaming Headset
      else if (pCategory.toLowerCase().includes('headset') || pCategory.toLowerCase().includes('audio')) {
        const isWireless = lower.includes('wireless') || lower.includes('bt') || lower.includes('bluetooth');
        customAttributes['connectivity'] = isWireless ? '2.4GHz Wireless + 3.5mm' : 'Wired USB / 3.5mm';
        customAttributes['driver_size'] = lower.includes('53mm') ? '53mm' : lower.includes('40mm') ? '40mm' : '50mm Neodymium';
        customAttributes['frequency_response'] = '15Hz - 25,000Hz';
        customAttributes['microphone_type'] = 'Detachable Noise-Cancelling';
        customAttributes['surround_sound'] = lower.includes('7.1') || lower.includes('dts') ? 'DTS Headphone:X Spatial / 7.1' : 'Virtual 7.1 Surround Sound';
        customAttributes['rgb_lighting'] = lower.includes('rgb') ? 'RGB Lighting' : 'Non-RGB';
        customAttributes['battery_life'] = isWireless ? (lower.includes('cloud iii') ? 'Up to 120 Hours' : 'Up to 30 Hours') : 'N/A (Wired)';
        customAttributes['earcup_material'] = 'Memory Foam with Breathable Leatherette';
        customAttributes['weight_grams'] = 300;
      }
      // 5. Gaming Keyboard
      else if (pCategory.toLowerCase().includes('keyboard')) {
        const isWireless = lower.includes('wireless') || lower.includes('bluetooth') || lower.includes('tri-mode');
        customAttributes['switch_type'] = lower.includes('red') ? 'Linear Red Mechanical Switches' :
          lower.includes('blue') ? 'Clicky Blue Mechanical Switches' :
          lower.includes('brown') ? 'Tactile Brown Mechanical Switches' :
          lower.includes('optical') ? 'Opto-Mechanical Switches' :
          lower.includes('hall') || lower.includes('magnetic') ? 'Hall Effect Magnetic Switches' : 'Mechanical Switches';
        customAttributes['form_factor'] = lower.includes('60%') ? '60% Compact' :
          lower.includes('65%') ? '65% Compact' :
          lower.includes('75%') ? '75% Compact' :
          lower.includes('tkl') || lower.includes('tenkeyless') ? 'Tenkeyless (TKL / 80%)' : 'Full Size (100%)';
        customAttributes['connectivity'] = isWireless ? 'Tri-Mode (2.4G + BT + Type-C)' : 'Detachable USB Type-C';
        customAttributes['rgb_backlight'] = lower.includes('rgb') ? 'Per-Key Dynamic RGB' : 'RGB Backlit';
        customAttributes['hot_swappable'] = lower.includes('hot-swap') || lower.includes('hotswap') || !lower.includes('membrane');
        customAttributes['keycaps'] = 'Double-Shot PBT Keycaps';
      }
      // 6. Gaming Mouse
      else if (pCategory.toLowerCase().includes('mouse') && !pCategory.toLowerCase().includes('pad')) {
        const isWireless = lower.includes('wireless') || lower.includes('superlight') || lower.includes('hyperspeed');
        customAttributes['sensor_dpi'] = lower.includes('superlight') ? '32,000 DPI (HERO 2)' :
          lower.includes('deathadder') || lower.includes('viper') ? '30,000 DPI (Focus Pro)' : '26,000 DPI Optical';
        customAttributes['polling_rate'] = lower.includes('4k') || lower.includes('4000') ? '4000 Hz' :
          lower.includes('8k') || lower.includes('8000') ? '8000 Hz' : '1000 Hz';
        customAttributes['mouse_weight'] = lower.includes('superlight') ? '60g Ultra-Lightweight' :
          lower.includes('mini') ? '58g' : '63g Lightweight';
        customAttributes['connectivity'] = isWireless ? '2.4GHz Ultra-Fast Wireless' : 'Speedflex Wired USB';
        customAttributes['switch_type'] = 'Optical Mouse Switches (90M Clicks)';
        customAttributes['programmable_buttons'] = lower.includes('g502') || lower.includes('basilisk') ? 11 : 5;
      }
      // 7. Gaming Monitor / Monitor
      else if (pCategory.toLowerCase().includes('monitor') && !pCategory.toLowerCase().includes('arm')) {
        customAttributes['screen_size'] = lower.includes('32') ? '32 Inch' :
          lower.includes('34') ? '34 Inch Ultrawide' :
          lower.includes('24') ? '24.5 Inch' : '27 Inch';
        customAttributes['resolution'] = lower.includes('4k') || lower.includes('2160') ? '3840 x 2160 (4K UHD)' :
          lower.includes('2k') || lower.includes('1440') || lower.includes('qhd') ? '2560 x 1440 (2K QHD)' : '1920 x 1080 (Full HD)';
        customAttributes['refresh_rate'] = lower.includes('360') ? '360 Hz' :
          lower.includes('240') ? '240 Hz' :
          lower.includes('180') ? '180 Hz' :
          lower.includes('165') ? '165 Hz' :
          lower.includes('144') ? '144 Hz' : '165 Hz - 180 Hz';
        customAttributes['panel_type'] = lower.includes('oled') ? 'QD-OLED' :
          lower.includes('ips') ? 'Fast IPS' :
          lower.includes('va') ? 'Fast VA' : 'Fast IPS';
        customAttributes['response_time'] = lower.includes('oled') ? '0.03ms (GtG)' : '1ms (GtG / MPRT)';
        customAttributes['hdr_support'] = 'HDR10 / DisplayHDR 400';
        customAttributes['curved_flat'] = lower.includes('curved') ? '1500R Curved' : 'Flat Panel';
      }
      // 8. Power Supply (PSU)
      else if (pCategory.toLowerCase().includes('power supply') || pCategory.toLowerCase().includes('psu')) {
        const psuWatts = lower.includes('1200') ? 1200 :
          lower.includes('1000') ? 1000 :
          lower.includes('850') ? 850 :
          lower.includes('750') ? 750 :
          lower.includes('650') ? 650 :
          lower.includes('550') ? 550 : 750;
        specifications.psuWattage = psuWatts;
        specifications.formFactor = lower.includes('sfx') ? 'SFX (Compact)' : 'ATX';
        customAttributes['wattage'] = `${psuWatts}W`;
        customAttributes['efficiency_rating'] = lower.includes('platinum') ? '80 Plus Platinum' :
          lower.includes('bronze') ? '80 Plus Bronze' : '80 Plus Gold';
        customAttributes['modularity'] = lower.includes('semi') ? 'Semi-Modular' :
          lower.includes('non-mod') ? 'Non-Modular' : 'Fully Modular';
        customAttributes['atx_standard'] = lower.includes('3.0') || lower.includes('pcie 5') || lower.includes('12vhpwr') ? 'ATX 3.0 / PCIe 5.0 Ready (12VHPWR)' : 'ATX 2.4 / 2.52';
        customAttributes['warranty_years'] = '10 Years Manufacturer Warranty';
      }
      // 9. RAM
      else if (pCategory.toLowerCase().includes('ram') || pCategory.toLowerCase().includes('memory')) {
        const isDdr5 = lower.includes('ddr5') || lower.includes('6000') || lower.includes('5600') || lower.includes('6400') || lower.includes('7200');
        specifications.ramType = isDdr5 ? 'DDR5' : 'DDR4';
        customAttributes['generation'] = isDdr5 ? 'DDR5' : 'DDR4';
        customAttributes['capacity'] = lower.includes('64gb') ? '64GB (2x32GB)' :
          lower.includes('16gb') ? (lower.includes('2x8') ? '16GB (2x8GB)' : '16GB (1x16GB)') : '32GB (2x16GB)';
        customAttributes['frequency_speed'] = isDdr5 ? (lower.includes('6400') ? '6400 MHz' : '6000 MHz') : '3600 MHz';
        customAttributes['cas_latency'] = isDdr5 ? 'CL30 / CL32' : 'CL16 / CL18';
        customAttributes['rgb_lighting'] = lower.includes('rgb') ? 'Dynamic RGB Lighting' : 'Non-RGB Low Profile';
      }
      // 10. Storage (SSD/HDD)
      else if (pCategory.toLowerCase().includes('storage') || pCategory.toLowerCase().includes('ssd')) {
        const isGen5 = lower.includes('gen5') || lower.includes('pcie 5');
        const isGen4 = isGen5 || lower.includes('gen4') || lower.includes('pcie 4') || lower.includes('990') || lower.includes('980') || lower.includes('sn850');
        const storageCap = lower.includes('4tb') ? '4TB' :
          lower.includes('2tb') ? '2TB' :
          lower.includes('500gb') ? '500GB' : '1TB';
        const storageT = isGen5 ? 'NVMe PCIe 5.0' : isGen4 ? 'NVMe PCIe 4.0' : 'NVMe PCIe 3.0';
        const readSpeed = isGen5 ? 12400 : isGen4 ? 7450 : 3500;
        specifications.storageType = storageT;
        specifications.storageCapacity = storageCap;
        specifications.readSpeedMb = readSpeed;
        customAttributes['capacity'] = lower.includes('4tb') ? '4TB' :
          lower.includes('2tb') ? '2TB' :
          lower.includes('500gb') ? '500GB' : '1TB (1000GB)';
        customAttributes['form_factor'] = lower.includes('2.5') || lower.includes('sata') ? '2.5 Inch SATA' : 'M.2 2280 NVMe';
        customAttributes['interface_type'] = isGen5 ? 'PCIe Gen5 x4 NVMe 2.0' : isGen4 ? 'PCIe Gen4 x4 NVMe 1.4' : 'PCIe Gen3 x4 NVMe';
        customAttributes['read_speed'] = isGen5 ? '12,400 MB/s' : isGen4 ? '7,450 MB/s' : '3,500 MB/s';
        customAttributes['write_speed'] = isGen5 ? '11,800 MB/s' : isGen4 ? '6,900 MB/s' : '3,000 MB/s';
      }
      // 11. CPU Cooler
      else if (pCategory.toLowerCase().includes('cooler')) {
        const isAio = lower.includes('liquid') || lower.includes('aio') || lower.includes('360') || lower.includes('240') || lower.includes('280') || lower.includes('420');
        const coolerT = isAio ? (lower.includes('360') ? '360mm AIO' : lower.includes('280') ? '280mm AIO' : lower.includes('420') ? '420mm AIO' : '240mm AIO') : 'Air Cooler';
        const rgbT = lower.includes('rgb') || lower.includes('argb') ? 'ARGB' : 'Non-RGB';
        specifications.socket = 'AM5';
        specifications.coolerType = coolerT;
        specifications.rgbType = rgbT;
        
        customAttributes['cooler_type'] = isAio ? (lower.includes('360') ? '360mm ARGB Liquid AIO Cooler' : lower.includes('280') ? '280mm ARGB Liquid AIO Cooler' : lower.includes('420') ? '420mm Liquid AIO Cooler' : '240mm ARGB Liquid AIO Cooler') : 'Dual-Tower Dual-Fan Air Cooler';
        customAttributes['socket_compatibility'] = 'AMD AM5 / AM4, Intel LGA1700 / LGA1851 / LGA1200';
        customAttributes['max_tdp_dissipation'] = isAio ? 300 : 220;
        customAttributes['fan_rpm_airflow'] = '500 - 2,000 RPM ± 10%, Max 75.3 CFM Airflow';
        customAttributes['noise_level'] = '≤ 28.5 dBA Ultra-Quiet';
        customAttributes['pump_display'] = lower.includes('lcd') ? '2.4" IPS LCD Real-Time Display' : 'Infinite Mirror ARGB';
        customAttributes['radiator_dimensions'] = isAio ? (lower.includes('360') ? '397 x 120 x 27 mm' : '277 x 120 x 27 mm') : 'N/A';
      }
      // 11.5 Casing / PC Case
      else if (pCategory.toLowerCase().includes('casing') || pCategory.toLowerCase().includes('case')) {
        customAttributes['case_form_factor'] = lower.includes('mini') ? 'Mini-ITX Small Form Factor (SFF)' : (lower.includes('dual') || lower.includes('o11') || lower.includes('vision') || lower.includes('h9') || lower.includes('nv7')) ? 'Panoramic Dual-Chamber Glass Showcase' : lower.includes('xl') || lower.includes('full tower') ? 'Full-Tower E-ATX Showcase' : 'Mid-Tower ATX (High Airflow Mesh)';
        customAttributes['motherboard_support'] = lower.includes('mini') ? 'Mini-ITX' : 'ATX, Micro-ATX, Mini-ITX (Back-Connect PZ Supported)';
        customAttributes['max_gpu_length'] = lower.includes('mini') ? 330 : 400;
        customAttributes['max_cpu_cooler_height'] = lower.includes('mini') ? 160 : 175;
        customAttributes['included_fans'] = lower.includes('rgb') ? '4x 120mm ARGB PWM High-Static Pressure Fans' : 'Fans Sold Separately';
        customAttributes['radiator_support'] = lower.includes('mini') ? 'Top: 280mm / Side: 240mm / Rear: 120mm' : 'Top: 360mm / Side: 360mm / Rear: 120mm';
        customAttributes['front_io_ports'] = '1x USB 3.2 Gen 2 Type-C, 2x USB 3.0, HD Audio Jack';
        
        specifications.formFactor = lower.includes('mini') ? 'Mini-ITX' : lower.includes('xl') ? 'Full Tower ATX' : 'Mid Tower ATX';
      }
      // 12. PC Case Fans / Casing Fans
      else if (pCategory.toLowerCase().includes('fan')) {
        const is140 = lower.includes('140') || lower.includes('140mm');
        const isTriple = lower.includes('3-pack') || lower.includes('triple') || lower.includes('3 in 1') || lower.includes('3 pack') || lower.includes('3-in-1') || lower.includes('pack of 3');
        const is5Pack = lower.includes('5-pack') || lower.includes('5 in 1') || lower.includes('5 pack');
        const isReverse = lower.includes('reverse') || lower.includes('intake aesthetic');
        const isRgb = lower.includes('rgb') || lower.includes('argb') || lower.includes('infinity') || lower.includes('light');

        customAttributes['fan_size'] = is140 ? '140mm (140 x 140 x 25 mm)' : '120mm (120 x 120 x 25 mm)';
        customAttributes['pack_quantity'] = is5Pack
          ? '5-in-1 Value Pack'
          : isTriple
          ? 'Triple Pack (3-in-1 with Controller/Hub)'
          : 'Single Fan Pack (1-Pack)';
        customAttributes['blade_direction'] = isReverse
          ? 'Reverse Blade (Panoramic Intake Aesthetic)'
          : 'Standard Blade (Exhaust / Front Intake)';
        customAttributes['fan_speed_rpm'] = lower.includes('infinity') || lower.includes('sl120')
          ? '200 - 2,100 RPM ± 10% PWM'
          : lower.includes('noctua')
          ? '450 - 2,000 RPM PWM'
          : '600 - 1,800 RPM PWM';
        customAttributes['max_airflow'] = is140 ? '84.5 CFM' : lower.includes('infinity') ? '61.3 CFM' : '66.17 CFM';
        customAttributes['static_pressure'] = is140 ? '2.80 mmH2O' : lower.includes('noctua') ? '2.34 mmH2O' : '2.07 mmH2O';
        customAttributes['noise_level'] = lower.includes('noctua') ? '22.6 dBA Ultra-Quiet' : '28.5 dBA';
        customAttributes['bearing_type'] = lower.includes('noctua')
          ? 'SSO2-Bearing'
          : lower.includes('corsair')
          ? 'Magnetic Levitation / Dome Bearing'
          : 'Fluid Dynamic Bearing (FDB)';
        customAttributes['lighting_type'] = lower.includes('infinity')
          ? 'Infinity Mirror ARGB'
          : isRgb
          ? 'Addressable RGB (5V 3-Pin ARGB)'
          : 'Non-LED (High-Performance Stealth)';
        customAttributes['lighting_connector'] = lower.includes('lian li') || lower.includes('uni')
          ? 'Proprietary Magnetic Interlock (Single Cable System)'
          : '4-Pin PWM + 3-Pin 5V ARGB Daisy-Chain';
        customAttributes['operating_voltage'] = '12V DC (Fan) / 5V DC (LED)';
        customAttributes['power_consumption'] = '2.16W (0.18A)';
        customAttributes['pwm_control'] = 'Yes (PWM 4-Pin Supported)';
        customAttributes['anti_vibration'] = 'Included on All 4 Corners';
      }

      res.json({
        success: true,
        source: 'heuristic-engine',
        aiGenerated: false,
        productName: pName,
        brand: detectedBrand,
        category: pCategory,
        specifications,
        specs: specifications,
        summaryHighlights: [
          `Hardware specifications mapped for ${pName}`,
          `Category attributes matched to ${pCategory} schema`,
        ],
        description: "",
        summary: "",
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to auto-fetch hardware specifications' });
    }
  });

  // --- GENERATIVE AI BUILD ASSISTANT ---
  app.post('/api/ai/build-assistant', async (req, res) => {
    const { prompt, targetBudgetPkr, preferredBrand, useCase } = req.body;

    // Available inventory summary for AI grounding
    const inventorySummary = productsDB
      .filter((p) => p.inStock)
      .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        socket: p.specifications?.socket,
        ramType: p.specifications?.ramType,
        tdp: p.specifications?.tdpWatts,
        recommendedPsu: p.specifications?.recommendedPsuWatts,
        psuWattage: p.specifications?.psuWattage,
        variants: p.variants?.map((v) => ({ id: v.id, name: v.name, color: v.color, price: v.price })),
      }));

    const ai = getGeminiClient();
    const compactInventory = getCompactInventoryText();

    const MANDATORY_CATEGORIES: ProductCategory[] = [
      'Processor',
      'Motherboard',
      'CPU Cooler',
      'RAM',
      'Storage',
      'Graphic Card',
      'Power Supply',
      'Casing',
    ];

    const budgetNum = Number(targetBudgetPkr) || 200000;
    const isAMD = preferredBrand?.toLowerCase().includes('amd') || !preferredBrand?.toLowerCase().includes('intel');

    // Helper: Select 100% compatible 8-part build from inventory based on target budget
    const buildBalancedRigHeuristic = (targetBudget: number, wantAMD: boolean, rigUseCase?: string): AISuggestionResponse => {
      let pickedCpu: Product | undefined;
      if (targetBudget < 230000) {
        // Budget AM4 or Intel 12th gen
        pickedCpu = productsDB.find((p) => p.category === 'Processor' && (wantAMD ? p.specifications?.socket === 'AM4' : p.specifications?.socket === 'LGA1700') && p.price <= 45000);
      } else if (targetBudget < 400000) {
        // Mid-tier AM5 or Intel 13/14th gen i5
        pickedCpu = productsDB.find((p) => p.category === 'Processor' && (wantAMD ? p.specifications?.socket === 'AM5' : p.specifications?.socket === 'LGA1700') && p.price <= 80000);
      } else if (targetBudget < 700000) {
        // High-end AM5 7800X3D/9800X3D or i7
        pickedCpu = productsDB.find((p) => p.category === 'Processor' && (wantAMD ? ['7800X3D', '9800X3D', '7700X'].some((s) => p.name.includes(s)) : p.name.includes('14700K')));
      } else {
        // Enthusiast
        pickedCpu = productsDB.find((p) => p.category === 'Processor' && (wantAMD ? ['9950X3D', '9800X3D', '7950X3D'].some((s) => p.name.includes(s)) : p.name.includes('285K') || p.name.includes('14900K')));
      }

      if (!pickedCpu) {
        pickedCpu = productsDB.find((p) => p.category === 'Processor' && (wantAMD ? p.specifications?.socket === 'AM5' : p.specifications?.socket === 'LGA1700')) || productsDB.find((p) => p.category === 'Processor');
      }

      const cpuSocket = pickedCpu?.specifications?.socket || 'AM5';

      // Pick Motherboard strictly matching socket
      let pickedMobo = productsDB.find((p) => p.category === 'Motherboard' && p.specifications?.socket === cpuSocket && (targetBudget < 230000 ? p.price <= 35000 : true));
      if (!pickedMobo) pickedMobo = productsDB.find((p) => p.category === 'Motherboard' && p.specifications?.socket === cpuSocket) || productsDB.find((p) => p.category === 'Motherboard');

      const moboRamType = pickedMobo?.specifications?.ramType || (cpuSocket === 'AM5' ? 'DDR5' : (cpuSocket === 'AM4' ? 'DDR4' : 'DDR5'));

      // Pick RAM matching RAM type
      let pickedRam = productsDB.find((p) => p.category === 'RAM' && p.specifications?.ramType === moboRamType && (targetBudget < 230000 ? p.name.includes('16GB') : true));
      if (!pickedRam) pickedRam = productsDB.find((p) => p.category === 'RAM' && p.specifications?.ramType === moboRamType) || productsDB.find((p) => p.category === 'RAM');

      // Pick GPU
      let pickedGpu: Product | undefined;
      if (targetBudget < 230000) {
        pickedGpu = productsDB.find((p) => p.category === 'Graphic Card' && (p.name.includes('6600') || p.name.includes('3050') || p.name.includes('3060') || p.price <= 95000));
      } else if (targetBudget < 400000) {
        pickedGpu = productsDB.find((p) => p.category === 'Graphic Card' && (p.name.includes('4060') || p.name.includes('7600 XT') || p.price <= 140000));
      } else if (targetBudget < 700000) {
        pickedGpu = productsDB.find((p) => p.category === 'Graphic Card' && (p.name.includes('4070') || p.name.includes('5070') || p.name.includes('7800 XT')));
      } else {
        pickedGpu = productsDB.find((p) => p.category === 'Graphic Card' && (p.name.includes('5080') || p.name.includes('5090') || p.name.includes('4090')));
      }
      if (!pickedGpu) pickedGpu = productsDB.find((p) => p.category === 'Graphic Card');

      // Pick Storage
      let pickedStorage = productsDB.find((p) => p.category === 'Storage' && (targetBudget < 230000 ? (p.name.includes('500GB') || p.name.includes('512GB') || p.name.includes('1TB')) : p.name.includes('1TB') || p.name.includes('2TB')));
      if (!pickedStorage) pickedStorage = productsDB.find((p) => p.category === 'Storage');

      // Pick CPU Cooler
      let pickedCooler: Product | undefined;
      const tdp = pickedCpu?.specifications?.tdpWatts || (pickedCpu?.name.includes('i9') || pickedCpu?.name.includes('i7') || pickedCpu?.name.includes('9') || pickedCpu?.name.includes('7') ? 180 : 65);
      
      if (tdp > 120 || targetBudget > 400000) {
        // High end: Prefer AIO or Dual Tower
        pickedCooler = productsDB.find((p) => p.category === 'CPU Cooler' && p.inStock && (p.name.includes('360') || p.name.includes('Liquid') || p.name.includes('Peerless') || p.name.includes('Phantom')));
      } else {
        // Standard: Prefer Air or single tower
        pickedCooler = productsDB.find((p) => p.category === 'CPU Cooler' && p.inStock && (p.name.includes('AG400') || p.name.includes('Assassin King') || p.price <= 12000));
      }
      
      // Strict Fallback: Find ANY in-stock cooler
      if (!pickedCooler) {
        pickedCooler = productsDB.find((p) => p.category === 'CPU Cooler' && p.inStock);
      }
      // Ultimate Fallback: Find ANY cooler even if out of stock
      if (!pickedCooler) {
        pickedCooler = productsDB.find((p) => p.category === 'CPU Cooler');
      }

      // Pick PSU
      const recWatts = pickedGpu?.specifications?.recommendedPsuWatts || 650;
      let pickedPsu = productsDB.find((p) => p.category === 'Power Supply' && p.inStock && (p.specifications?.psuWattage || 0) >= recWatts);
      if (!pickedPsu) pickedPsu = productsDB.find((p) => p.category === 'Power Supply' && p.inStock) || productsDB.find((p) => p.category === 'Power Supply');

      // Pick Casing
      let pickedCase = productsDB.find((p) => p.category === 'Casing' && p.inStock && (targetBudget < 230000 ? p.price <= 18000 : true));
      if (!pickedCase) pickedCase = productsDB.find((p) => p.category === 'Casing' && p.inStock) || productsDB.find((p) => p.category === 'Casing');

      const partsList: any[] = [];
      let calcTotal = 0;

      const addPart = (prod: Product | undefined, reason: string) => {
        if (!prod) return;
        const variant = prod.variants?.[0];
        const price = variant?.price || prod.price;
        calcTotal += price;
        partsList.push({
          category: prod.category,
          productId: prod.id,
          variantId: variant?.id,
          productName: variant ? `${prod.name} (${variant.name})` : prod.name,
          price,
          reason,
        });
      };

      addPart(pickedCpu, `High-IPC ${cpuSocket} gaming processor selected for optimal frame pacing.`);
      addPart(pickedMobo, `Compatible ${cpuSocket} motherboard with robust VRMs and ${moboRamType} memory support.`);
      addPart(pickedCooler, 'Efficient thermal management keeping CPU temperatures cool under heavy sustained gaming loads.');
      addPart(pickedRam, `High-speed ${moboRamType} memory kit for low memory latency and zero micro-stutters.`);
      addPart(pickedStorage, 'Ultra-fast NVMe SSD for instant Windows boots and instantaneous game loading.');
      addPart(pickedGpu, `High-performance graphics engine delivering smooth high-refresh FPS.`);
      addPart(pickedPsu, 'Tier-rated continuous wattage power supply ensuring 100% clean and stable power.');
      addPart(pickedCase, 'High airflow chassis with tempered glass showcase aesthetics and optimized intake.');

      return {
        summary: `Apex Custom Rig (${Math.round(calcTotal / 1000)}k PKR Optimized Build)`,
        reasoning: `We carefully engineered this configuration for ${rigUseCase || 'Peak Gaming & Productivity'} at an exact catalog total of Rs. ${calcTotal.toLocaleString()} PKR. All 8 core components (CPU, Motherboard, Cooler, RAM, Storage, GPU, PSU, and Casing) have been strictly validated for 100% thermal headroom, RAM standard compatibility, and socket alignment.`,
        estimatedTotalPkr: calcTotal,
        recommendedCategoryParts: partsList,
        performanceHighlights: {
          gaming1080p: '165+ FPS Ultra (Competitive Esports & AAA Games)',
          gaming1440p: '85-120 FPS High/Ultra (Modern Ray-Tracing & DLSS)',
          workstation: 'Solid 4K Video Editing & Multi-Threaded Content Creation',
        },
        upgradeSuggestions: [
          'Add secondary 2TB NVMe SSD when game library expands',
          'Upgrade RAM capacity for ultra heavy 3D rendering workflows',
        ],
      };
    };

    // Try Gemini AI with rigorous post-processing and 8-category synchronization
    if (ai) {
      try {
        const systemPrompt = `You are the Master PC Hardware Architect at ApexRig Pakistan.
Recommend the BEST 100% COMPATIBLE custom PC configuration using EXCLUSIVELY our real store inventory.

CRITICAL INVENTORY & PRICING RULES:
- You MUST recommend EXACTLY 8 components covering ALL 8 categories:
  1. "Processor"
  2. "Motherboard"
  3. "CPU Cooler"
  4. "RAM"
  5. "Storage"
  6. "Graphic Card"
  7. "Power Supply"
  8. "Casing"
- NEVER omit CPU Cooler or RAM or any of the 8 categories.
- ONLY choose products and prices present in the provided Store Inventory.
- NEVER invent parts, never hallucinate unlisted items, and NEVER use prices from external websites/stores.
- AMD AM5 CPUs (Ryzen 7000/9000/X3D) only with AM5 Mobos & DDR5 RAM.
- AMD AM4 CPUs (Ryzen 5000) only with AM4 Mobos & DDR4 RAM.
- Intel LGA1700 CPUs with LGA1700 Mobos.
- Exact PKR prices from store inventory.

Respond ONLY with a JSON object adhering to this schema:
{
  "summary": "Short title of the rig, e.g. Apex 1440p Esports King",
  "reasoning": "A concise friendly 2 paragraph explanation.",
  "estimatedTotalPkr": number,
  "recommendedCategoryParts": [
    {
      "category": "Processor" | "Motherboard" | "CPU Cooler" | "RAM" | "Storage" | "Graphic Card" | "Power Supply" | "Casing",
      "productId": "string (must match real inventory id)",
      "variantId": "optional variant id",
      "productName": "string",
      "price": number,
      "reason": "1 sentence why this part was chosen"
    }
  ],
  "performanceHighlights": {
    "gaming1080p": "e.g. 180+ FPS in Valorant/CS2",
    "gaming1440p": "e.g. 90-120 FPS in Cyberpunk",
    "workstation": "e.g. Fast 4K exports"
  },
  "upgradeSuggestions": ["Array of 2-3 future upgrade paths"]
}`;

        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `User Prompt: "${prompt || 'I need a balanced gaming PC'}"
Target Budget: ${targetBudgetPkr ? `${targetBudgetPkr} PKR` : 'Flexible'}
Preferred Brand: ${preferredBrand || 'Any (Best Value)'}
Use Case: ${useCase || 'Gaming and General Productivity'}

Store Inventory:
${compactInventory}`,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.2,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
            },
          });
        } catch (flashErr1) {
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: `User Prompt: "${prompt || 'I need a balanced gaming PC'}"
Target Budget: ${targetBudgetPkr ? `${targetBudgetPkr} PKR` : 'Flexible'}
Preferred Brand: ${preferredBrand || 'Any (Best Value)'}
Use Case: ${useCase || 'Gaming and General Productivity'}

Store Inventory:
${compactInventory}`,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                temperature: 0.2,
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.MINIMAL,
                },
              },
            });
          } catch (flashErr2) {
            response = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: `User Prompt: "${prompt || 'I need a balanced gaming PC'}"
Target Budget: ${targetBudgetPkr ? `${targetBudgetPkr} PKR` : 'Flexible'}
Preferred Brand: ${preferredBrand || 'Any (Best Value)'}
Use Case: ${useCase || 'Gaming and General Productivity'}

Store Inventory:
${compactInventory}`,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                temperature: 0.2,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });
          }
        }

        const rawText = response.text || '{}';
        const parsed = JSON.parse(rawText) as AISuggestionResponse;

        if (parsed && Array.isArray(parsed.recommendedCategoryParts)) {
          // Post-process and sanitize every category
          const validatedParts: any[] = [];
          const matchedBuild: Partial<Record<ProductCategory, Product>> = {};

          // First pass: Match products by ID or Name from inventory
          for (const item of parsed.recommendedCategoryParts) {
            let realProd = productsDB.find((p) => p.id === item.productId);
            if (!realProd && item.productName) {
              const pLower = item.productName.toLowerCase();
              realProd = productsDB.find((p) => p.category === item.category && (p.name.toLowerCase().includes(pLower) || pLower.includes(p.name.toLowerCase())));
            }
            if (realProd) {
              matchedBuild[realProd.category] = realProd;
            }
          }

          // Second pass: Ensure all 8 categories exist
          const defaultFallback = buildBalancedRigHeuristic(budgetNum, isAMD, useCase);
          const fallbackMap: Record<string, any> = {};
          defaultFallback.recommendedCategoryParts.forEach((p) => {
            fallbackMap[p.category] = p;
          });

          // Verify CPU socket
          const cpuProd = matchedBuild['Processor'] || productsDB.find((p) => p.id === fallbackMap['Processor']?.productId);
          const cpuSocket = cpuProd?.specifications?.socket || 'AM5';

          // Verify Motherboard socket
          let moboProd = matchedBuild['Motherboard'];
          if (!moboProd || moboProd.specifications?.socket !== cpuSocket) {
            moboProd = productsDB.find((p) => p.category === 'Motherboard' && p.specifications?.socket === cpuSocket) || productsDB.find((p) => p.category === 'Motherboard');
          }
          const moboRamType = moboProd?.specifications?.ramType || (cpuSocket === 'AM5' ? 'DDR5' : (cpuSocket === 'AM4' ? 'DDR4' : 'DDR5'));

          // Verify RAM type
          let ramProd = matchedBuild['RAM'];
          if (!ramProd || ramProd.specifications?.ramType !== moboRamType) {
            ramProd = productsDB.find((p) => p.category === 'RAM' && p.specifications?.ramType === moboRamType) || productsDB.find((p) => p.category === 'RAM');
          }

          // Verify Cooler
          let coolerProd = matchedBuild['CPU Cooler'];
          if (!coolerProd) {
            coolerProd = productsDB.find((p) => p.category === 'CPU Cooler' && (p.name.includes('Assassin') || p.name.includes('Aqua Elite') || p.name.includes('AG400'))) || productsDB.find((p) => p.category === 'CPU Cooler');
          }

          // Verify GPU, Storage, PSU, Casing
          const gpuProd = matchedBuild['Graphic Card'] || productsDB.find((p) => p.id === fallbackMap['Graphic Card']?.productId) || productsDB.find((p) => p.category === 'Graphic Card');
          const storageProd = matchedBuild['Storage'] || productsDB.find((p) => p.id === fallbackMap['Storage']?.productId) || productsDB.find((p) => p.category === 'Storage');
          const reqPsuWatts = gpuProd?.specifications?.recommendedPsuWatts || 650;
          let psuProd = matchedBuild['Power Supply'];
          if (!psuProd || (psuProd.specifications?.psuWattage || 0) < reqPsuWatts) {
            psuProd = productsDB.find((p) => p.category === 'Power Supply' && (p.specifications?.psuWattage || 0) >= reqPsuWatts) || productsDB.find((p) => p.category === 'Power Supply');
          }
          const caseProd = matchedBuild['Casing'] || productsDB.find((p) => p.id === fallbackMap['Casing']?.productId) || productsDB.find((p) => p.category === 'Casing');

          const finalSelected: Record<ProductCategory, Product | undefined> = {
            'Processor': cpuProd,
            'Motherboard': moboProd,
            'CPU Cooler': coolerProd,
            'RAM': ramProd,
            'Storage': storageProd,
            'Graphic Card': gpuProd,
            'Power Supply': psuProd,
            'Casing': caseProd,
            'Casing Fans': undefined,
            'Monitor': undefined,
            'Gaming Mouse': undefined,
            'Gaming Keyboard': undefined,
            'Gaming Headset': undefined,
            'Gaming Chair': undefined,
            'Microphone': undefined,
            'Earbuds': undefined,
            'Steering Wheel': undefined,
            'Pre-Built PC': undefined,
          };

          let realSum = 0;
          for (const cat of MANDATORY_CATEGORIES) {
            const prod = finalSelected[cat];
            if (!prod) continue;
            const originalReason = parsed.recommendedCategoryParts.find((p) => p.category === cat)?.reason;
            const price = prod.price;
            realSum += price;
            validatedParts.push({
              category: cat,
              productId: prod.id,
              productName: prod.name,
              price,
              reason: originalReason || fallbackMap[cat]?.reason || `Selected compatible ${cat} from store catalog.`,
            });
          }

          if (validatedParts.length === 8) {
            // Check if Gemini's sum is within reasonable margin (<=12%) of the target budget
            const budgetRatio = Math.abs(realSum - budgetNum) / budgetNum;
            if (budgetRatio <= 0.12 || !targetBudgetPkr) {
              parsed.recommendedCategoryParts = validatedParts;
              parsed.estimatedTotalPkr = realSum;
              parsed.summary = `Apex Custom Rig (Rs. ${realSum.toLocaleString()} PKR • Target ${Math.round(budgetNum / 1000)}k)`;
              return res.json(parsed);
            }
          }
        }
      } catch (err: any) {
        const errMsg = typeof err === 'string' ? err : JSON.stringify(err?.message || err);
        if (!errMsg.includes('429') && !errMsg.includes('quota') && !errMsg.includes('RESOURCE_EXHAUSTED')) {
          console.error('Gemini AI build generation error, using optimizer fallback:', err?.message || err);
        }
      }
    }

    // Mathematical Budget Optimizer Engine for exact budget adherence and 100% compatibility
    const fallbackResponse = optimizeBuildForBudget(productsDB, {
      targetBudget: budgetNum,
      brandPreference: preferredBrand === 'Any' ? undefined : (preferredBrand as any),
      userPrompt: prompt,
      useCase,
    });
    res.json(fallbackResponse);
  });

  // Global error handler for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server Error]', err?.message || err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: 'Internal server error', message: err?.message || 'An unexpected server error occurred' });
  });

  // Explicit JSON 404 handler for API routes to prevent falling through to Vite HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found', path: req.path });
  });

  // --- VITE SPA FALLBACK & STATIC SERVING ---
  const isProduction = /[\\/]dist-server[\\/]/.test(process.argv[1] || '') || process.env.NODE_ENV === 'production' || (process.argv[1] && process.argv[1].endsWith('.cjs'));
  if (!isProduction) {
    const vite = await createViteServer({
      configLoader: 'runner',
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== "true" },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Catch Vite middleware errors to prevent falling through to Express default white screen
    app.use((err, req, res, next) => {
      console.error('[Vite Middleware Error]', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Vite Error</title></head>
        <body style="background:#0b1120;color:#ef4444;font-family:monospace;padding:2rem;">
          <h2>Build Error</h2>
          <pre>${err.message}</pre>
          <script>
            // Auto-reload after a few seconds so the preview recovers when the agent fixes it
            setTimeout(() => window.location.reload(), 3000);
          </script>
        </body>
        </html>
      `);
    });

  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = createServer(app);
  
  const wss = new WebSocketServer({ noServer: true });

  wss.on('error', (err: any) => {
    const msg = err?.message || 'WebSocketServer notice';
    console.warn('[WebSocketServer] Notice:', msg);
  });

  server.on('upgrade', (request, socket, head) => {
    socket.on('error', () => {
      // Quietly handle benign socket disconnects during navigation or client reloads
    });

    const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '';
    if (pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    }
  });
  
  wss.on("connection", async (clientWs, req) => {
    console.log("Client connected to Live API WebSocket");

    clientWs.on("error", (err: any) => {
      const msg = err?.message || 'Client WebSocket disconnect';
      console.warn("[Client WS] Notice:", msg);
    });

    const safeSend = (payload: any) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify(payload), (err) => {
            if (err) {
              console.warn("[Client WS] Send error handled:", err.message);
            }
          });
        } catch (e: any) {
          console.warn("[Client WS] Exception during send:", e?.message || e);
        }
      }
    };

    let session: any = null;
    let sessionActive = false;
    let currentTurnAudioBuffers: Buffer[] = [];
    let accumulatedOutputTurnText = "";
    let accumulatedInputTurnText = "";

    const cleanupSession = () => {
      sessionActive = false;
      currentTurnAudioBuffers = [];
      accumulatedOutputTurnText = "";
      accumulatedInputTurnText = "";
      if (session) {
        try {
          if (typeof session.close === 'function') {
            session.close();
          }
        } catch (e) {
          // ignore session close error
        }
        session = null;
      }
    };

    clientWs.on("close", () => {
      cleanupSession();
      console.log("Client disconnected, closed Live session cleanly");
    });

    try {
      const ai = getGeminiClient();
      if (!ai) {
        safeSend({ error: "API Key Missing: Please add GEMINI_API_KEY to your .env file to use Voice AI locally." });
        try { clientWs.close(); } catch (e) {}
        return;
      }
      
      const messageQueue: any[] = [];
      
      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (!sessionActive) {
            messageQueue.push(msg);
            return;
          }
          if (msg.context) {
            try {
              session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.context }] }], turnComplete: false });
            } catch (err: any) {
              console.warn("Client context send error:", err?.message || err);
            }
          } else if (msg.audio) {
            try {
              session.sendRealtimeInput({
                audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
              });
            } catch (err: any) {
              console.warn("Realtime audio input send error:", err?.message || err);
            }
          } else if (msg.image || msg.video) {
            try {
              session.sendRealtimeInput({
                video: { data: msg.image || msg.video, mimeType: "image/jpeg" },
              });
            } catch (err: any) {
              console.warn("Realtime video/screen input send error:", err?.message || err);
            }
          } else if (msg.text) {
            try {
              session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.text }] }], turnComplete: msg.turnComplete !== undefined ? msg.turnComplete : true });
            } catch (err: any) {
              console.warn("Client content send error:", err?.message || err);
            }
          } else if (msg.textClientContent) {
            try {
              session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.textClientContent }] }], turnComplete: true });
            } catch (err: any) {
              console.warn("Client textClientContent send error:", err?.message || err);
            }
          }
        } catch (err) {
          console.error("Error sending realtime input", err);
        }
      });
      
      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are APEX AI RIGMASTER, the ultimate PC building and hardware consultant for a Pakistan-based store. \nBe concise, helpful, and speak clearly.\nHelp customers choose parts, build PCs, and stay within their budget. Use PKR for currency.\nWhen the customer shares their screen or camera, analyze their hardware components, specs, error messages, or custom build in real time with high accuracy.\nKeep responses short and natural for voice conversation. \nDo not read out long lists unless asked. Focus on the best recommendation.\n\nHere is the current live store stock inventory (only recommend items listed here, they are in stock):\n${getCompactInventoryText()}`,
        },
        callbacks: {
          onclose: (e) => {
             const code = (e as any)?.code || '1000';
             const reason = (e as any)?.reason || 'Session closed';
             console.log(`Gemini session closed (${code}): ${reason}`);
             sessionActive = false;
          },
          onerror: (e) => {
             const errorMsg = (e as any)?.message || (e as any)?.error?.message || 'Voice session disconnected';
             console.warn("Gemini session notice:", errorMsg);
             sessionActive = false;
             safeSend({ error: "Voice AI session error occurred. You can speak again to restart." });
          },
          onmessage: (message) => {
            try {
              const parts = message.serverContent?.modelTurn?.parts;
              let audio = null;
              let directText = "";
              if (parts) {
                for (const p of parts) {
                  if (p.inlineData?.mimeType?.startsWith('audio/')) {
                    audio = p.inlineData.data;
                    currentTurnAudioBuffers.push(Buffer.from(p.inlineData.data, 'base64'));
                  } else if (p.text && !p.thought) {
                    directText += p.text;
                  }
                }
              }
              
              const outputTranscriptionText = message.serverContent?.outputTranscription?.text || "";
              const inputTranscriptionText = message.serverContent?.inputTranscription?.text || "";

              if (inputTranscriptionText) {
                accumulatedInputTurnText += inputTranscriptionText;
              }

              if (outputTranscriptionText) {
                accumulatedOutputTurnText += outputTranscriptionText;
              }

              if (message.serverContent?.interrupted) {
                currentTurnAudioBuffers = [];
                accumulatedOutputTurnText = "";
                accumulatedInputTurnText = "";
                safeSend({ interrupted: true });
              }

              // When model completes turn, deliver complete transcript in a single event
              if (message.serverContent?.turnComplete) {
                const turnTranscript = accumulatedOutputTurnText.trim();
                const userTurnTranscript = accumulatedInputTurnText.trim();
                accumulatedOutputTurnText = "";
                accumulatedInputTurnText = "";

                if (turnTranscript) {
                  safeSend({ 
                    transcript: turnTranscript,
                    userInputFinal: userTurnTranscript || undefined,
                    turnComplete: true,
                    serverMessage: message
                  });
                } else {
                  currentTurnAudioBuffers = [];
                  safeSend({ 
                    turnComplete: true, 
                    userInputFinal: userTurnTranscript || undefined,
                    serverMessage: message 
                  });
                }
                return;
              }

              safeSend({ 
                audio: audio || undefined,
                text: outputTranscriptionText || directText || undefined,
                userInputText: accumulatedInputTurnText.trim() || inputTranscriptionText || undefined,
                serverMessage: message 
              });
            } catch (err) {
              console.error("Error in onmessage callback", err);
            }
          },
        },
      });

      sessionActive = true;
      while (messageQueue.length > 0) {
         const msg = messageQueue.shift();
         if (msg.context) {
            try {
              session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.context }] }], turnComplete: false });
            } catch (e: any) {
              console.warn("Initial queue context send error:", e?.message || e);
            }
         } else if (msg.audio) {
            try {
              session.sendRealtimeInput({ audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" } });
            } catch (e: any) {
              console.warn("Initial queue audio send error:", e?.message || e);
            }
         } else if (msg.image || msg.video) {
            try {
              session.sendRealtimeInput({ video: { data: msg.image || msg.video, mimeType: "image/jpeg" } });
            } catch (e: any) {
              console.warn("Initial queue video send error:", e?.message || e);
            }
         } else if (msg.text) {
            try {
              session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.text }] }], turnComplete: msg.turnComplete !== undefined ? msg.turnComplete : true });
            } catch (e: any) {
              console.warn("Initial queue text send error:", e?.message || e);
            }
         } else if (msg.textClientContent) {
            try {
              session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: msg.textClientContent }] }], turnComplete: true });
            } catch (e: any) {
              console.warn("Initial queue textClientContent send error:", e?.message || e);
            }
         }
      }

    } catch (err: any) {
      console.warn("Live API connection notice:", err?.message || 'Failed to connect to Live API');
      safeSend({ error: err?.message || "Failed to connect to Live API" });
      try {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      } catch (e) {}
    }
  });

  const BIND_HOST = '0.0.0.0';
  server.listen(PORT, BIND_HOST, () => {
    console.log(`\n🚀 ApexRig PC Store & Backend is live!`);
    console.log(`   > Local:   http://localhost:${PORT}`);
    
    // Print all local network IPv4 addresses for LAN and router port forwarding
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`   > Network: http://${net.address}:${PORT}`);
          }
        }
      }
    } catch (e) {
      // Ignore network interface reading errors
    }
    console.log(`   > Bound to: ${BIND_HOST}:${PORT} (Ready for Local Network & Public Router Port Forwarding)`);
    console.log(`   > 💡 Voice AI Tip: On Network IP, enable mic in Chrome at chrome://flags/#unsafely-treat-insecure-origin-as-secure or use localhost\n`);
  });
}

// Process safety listeners to prevent unexpected crashes in live production containers
process.on('uncaughtException', (err: any) => {
  const msg = typeof err === 'string' ? err : err?.message || '';
  if (
    msg.includes('ECONNRESET') ||
    msg.includes('EPIPE') ||
    msg.includes('WebSocket') ||
    msg.includes('senderOnError')
  ) {
    console.warn('[Server Process] Benign socket disconnection handled:', msg || 'Reset');
    return;
  }
  console.error('[Server Process] Uncaught exception:', msg || 'Unknown error');
});

process.on('unhandledRejection', (reason: any) => {
  const msg = typeof reason === 'string' ? reason : reason?.message || '';
  if (
    msg.includes('ECONNRESET') ||
    msg.includes('EPIPE') ||
    msg.includes('WebSocket') ||
    msg.includes('senderOnError')
  ) {
    console.warn('[Server Process] Benign socket rejection handled:', msg || 'Reset');
    return;
  }
  console.error('[Server Process] Unhandled rejection:', msg || 'Unknown rejection');
});

startServer().catch(() => { console.error('Server startup failed. Check configuration and store data.'); process.exitCode = 1; });
