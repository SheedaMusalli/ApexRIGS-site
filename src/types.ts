export type NavigationTab = 'home' | 'shop' | 'builder' | 'prebuilts' | 'deals';

export type CpuPlatform = 'all' | 'amd' | 'intel';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  suggestedAction?: {
    type: 'apply_build' | 'view_product' | 'switch_platform';
    payload?: any;
    label: string;
  };
}

export type ProductCategory =
  | 'Processor'
  | 'Motherboard'
  | 'Graphic Card'
  | 'RAM'
  | 'Storage'
  | 'Power Supply'
  | 'Casing'
  | 'CPU Cooler'
  | 'PC Case Fans'
  | 'Casing Fans'
  | 'Monitor'
  | 'Gaming Mouse'
  | 'Gaming Keyboard'
  | 'Gaming Headset'
  | 'Gaming Controller'
  | 'Gaming Chair'
  | 'Gaming Table'
  | 'Monitor Arm'
  | 'Steering Wheel'
  | 'Streaming & Mic'
  | 'Mouse Pad'
  | 'Thermal Solution'
  | 'Networking & Router'
  | 'Cables & Accessories'
  | 'Peripherals'
  | 'Pre-Built PC'
  | string;

export interface CustomCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  bannerImage?: string;
  description?: string;
  brands?: string[];
  productCount?: number;
  isCustom?: boolean;
  createdAt?: string;
}

export type AttributeFieldType = 'text' | 'number' | 'select' | 'boolean';

export interface CategoryAttributeDefinition {
  id: string; // unique key within schema, e.g. "socket", "cores_threads", "base_clock"
  name: string; // display name e.g. "CPU Socket", "Cores / Threads"
  type: AttributeFieldType;
  unit?: string; // e.g. "GHz", "Watts", "GB", "MHz", "mm", "Hz", "ms"
  options?: string[]; // options if type is 'select'
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  helpText?: string;
  displayInOverview?: boolean;
}

export interface CategoryAttributeSchema {
  id: string;
  category: ProductCategory | string;
  description?: string;
  attributes: CategoryAttributeDefinition[];
  updatedAt?: string;
}

export type CpuSocket = 'AM4' | 'AM5' | 'LGA1700' | 'LGA1851' | 'LGA1200' | 'LGA1151' | 'Other' | string;
export type RamType = 'DDR4' | 'DDR5' | 'DDR3' | 'DDR4 & DDR5' | string;
export type FormFactor = 'ATX' | 'Micro-ATX' | 'Mini-ITX' | 'E-ATX' | string;

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  ean?: string;
  serialNumber?: string;
  serialNumbers?: string[];
  color?: string;
  colorHex?: string;
  optionLabel?: string;
  optionValue?: string;
  price: number;
  costPrice?: number;
  originalPrice?: number;
  stock: number;
  image?: string;
}

export interface ProductSpecifications {
  socket?: CpuSocket;
  chipset?: string;
  formFactor?: FormFactor;
  ramType?: RamType;
  ramSlots?: number;
  maxRamGb?: number;
  cores?: number;
  threads?: number;
  baseClockGhz?: number;
  boostClockGhz?: number;
  integratedGpu?: boolean;
  tdpWatts?: number;
  vramGb?: number;
  gpuChipset?: string;
  gpuLengthMm?: number;
  recommendedPsuWatts?: number;
  psuWattage?: number;
  psuRating?: string;
  psuModularity?: 'Non-Modular' | 'Semi-Modular' | 'Fully Modular' | string;
  storageType?: 'NVMe M.2 Gen4' | 'NVMe M.2 Gen3' | 'SATA 2.5 SSD' | '3.5 HDD' | string;
  storageCapacity?: string;
  readSpeedMb?: number;
  coolerType?: 'Air Cooler' | '240mm AIO' | '360mm AIO' | '120mm AIO' | string;
  supportedSockets?: CpuSocket[] | string[];
  coolerTdpRating?: number;
  caseMotherboardSupport?: FormFactor[];
  maxGpuLengthCaseMm?: number;
  maxCoolerHeightMm?: number;
  includedFans?: number;
  rgbType?: 'ARGB' | 'Auto-RGB' | 'Non-RGB';
  fpsEstimates?: {
    game: string;
    fps1080p: number;
    fps1440p?: number;
    fps4k?: number;
  }[];
  warrantyMonths?: number;
  customAttributes?: Record<string, any>;
  [key: string]: any;
}

export interface Product {
  id: string;
  sku?: string;
  ean?: string;
  barcode?: string;
  serialNumber?: string;
  serialNumbers?: string[];
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  costPrice?: number;
  originalPrice?: number;
  description: string;
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isVariable?: boolean;
  variants?: ProductVariant[];
  selectedVariantId?: string;
  image: string;
  additionalImages?: string[];
  specifications?: ProductSpecifications;
  rating?: number;
  reviewCount?: number;
  condition?: string;
  warranty?: string;
  specs?: any;
  tags?: string[];
  createdAt?: string;
  [key: string]: any;
}

export type SerialNumberStatus = 'In Stock' | 'Sold' | 'Reserved' | 'RMA / Defective' | 'Returned';

export interface SerialNumberItem {
  id: string;
  serialNumber: string;
  productId: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  variantId?: string;
  variantName?: string;
  costPrice: number;
  sellingPrice: number;
  status: SerialNumberStatus;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  warrantyPeriodMonths: number;
  warrantyExpiryDate?: string; // ISO date YYYY-MM-DD
  purchasedDate: string;
  soldDate?: string;
  supplier?: string;
  invoiceId?: string;
  invoiceDocNumber?: string;
  billId?: string;
  billDocNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type InventoryMovementType =
  | 'PURCHASE_INWARD'
  | 'SALE_OUTWARD'
  | 'RETURN_INWARD'
  | 'MANUAL_ADJUSTMENT'
  | 'DAMAGE_WRITEOFF'
  | 'RMA_OUTWARD';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: InventoryMovementType;
  quantity: number; // positive or negative
  unitCost: number;
  totalValue: number;
  previousStock: number;
  newStock: number;
  reference: string; // e.g. "PO-2026-001", "Order #APX-91402", "Physical Audit"
  notes?: string;
  performedBy: string;
  date: string;
}

export interface InventorySummaryStats {
  totalSkus: number;
  totalUnits: number;
  totalCostValuation: number;
  totalRetailValuation: number;
  unrealizedGrossProfit: number;
  averageMarginPercentage: number;
  lowStockCount: number;
  outOfStockCount: number;
  trackedSerialNumbersCount: number;
  activeSerialNumbersInStock: number;
  expiringWarrantiesCount?: number;
  expiredWarrantiesCount?: number;
}

export interface PCBuildParts {
  Processor?: Product | null;
  Motherboard?: Product | null;
  'CPU Cooler'?: Product | null;
  RAM?: Product | null;
  Storage?: Product | null;
  'Graphic Card'?: Product | null;
  'Power Supply'?: Product | null;
  Casing?: Product | null;
  'Casing Fans'?: Product | null;
  Monitor?: Product | null;
  'Gaming Keyboard'?: Product | null;
  'Gaming Mouse'?: Product | null;
  'Gaming Headset'?: Product | null;
  'Mouse Pad'?: Product | null;
  'Streaming & Mic'?: Product | null;
  'Gaming Controller'?: Product | null;
  'Gaming Chair'?: Product | null;
  'Cables & Accessories'?: Product | null;
  Peripherals?: Product | null;
  [key: string]: Product | null | undefined;
}

export interface SelectedVariantMap {
  [productId: string]: string; // variantId
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  category: ProductCategory;
  price: number;
  quantity: number;
  image: string;
  variantId?: string;
  variantName?: string;
  variantColor?: string;
  isCustomRig?: boolean;
  customRigDetails?: {
    components: string;
  };
  customRigBreakdown?: {
    productId?: string;
    variantId?: string;
    category: string;
    productName: string;
    variantName?: string;
    variantColor?: string;
    price: number;
    serialNumber?: string;
  }[];
  serialNumber?: string;
  serialNumbers?: string[];
}

export type CustomerInfo = OrderCustomer;

export interface OrderCustomer {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  status: 'Pending' | 'Verified' | 'Assembling' | 'Testing' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  courierName?: string;
  userId?: string;
  source?: "Website" | "ERP";
  stockDeducted?: boolean;
  paymentScreenshot?: string;
  paymentScreenshotUploadedAt?: string;
}

export interface LiveCourierCheckpoint {
  time?: string;
  location?: string;
  status?: string;
  description?: string;
  context?: string;
}

export interface LiveTrackingResult {
  trackNo: string;
  orderNumber?: string;
  courierCode: string;
  courierName: string;
  courierHomePage?: string;
  courierTrackingLink?: string;
  transitStatus: string;
  transitStatusDisplay: string;
  trackingStatus?: string;
  lastCheckedTime?: string;
  nextUpdateTime?: string;
  checkpoints: LiveCourierCheckpoint[];
  origin?: string;
  destination?: string;
  estimatedDelivery?: string;
  isLiveApiSuccess?: boolean;
  raw?: any;
}

export interface UserAccount {
  permissions?: import('./utils/permissions').Permissions;
  id: string;
  fullName: string;
  email: string;
  username?: string;
  phone: string;
  city: string;
  address: string;
  role: 'customer' | 'admin';
  isOwner?: boolean;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  tagline?: string;
  ownerName?: string;
  ownerTitle?: string;
  adminUsername?: string;
  phone: string;
  whatsappNumber: string;
  email?: string;
  address: string;
  city?: string;
  freeShippingThreshold?: number;
  defaultShippingFee?: number;
  bankDetails?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban?: string;
  };
}

export interface PriceDropAlert {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  category?: string;
  email: string;
  currentPrice: number;
  targetPrice?: number;
  createdAt: string;
  status: 'active' | 'triggered';
}

export interface AISuggestionResponse {

  summary: string;
  reasoning: string;
  estimatedTotalPkr: number;
  recommendedCategoryParts: {
    category: ProductCategory;
    productId: string;
    variantId?: string;
    productName: string;
    price: number;
    reason: string;
  }[];
  performanceHighlights: {
    gaming1080p: string;
    gaming1440p: string;
    workstation: string;
  };
  upgradeSuggestions?: string[];
}
