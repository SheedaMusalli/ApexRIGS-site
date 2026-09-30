import { can } from '../utils/permissions';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Save,
  Layers,
  Sparkles,
  Lock,
  Tag,
  FolderPlus,
  Search,
  Filter,
  CheckCircle2,
  X,
  ExternalLink,
  ArrowRight,
  Boxes,
  User,
  UserCheck,
  Building2,
  CreditCard,
  Phone,
  Store,
  Eye,
  FileText,
  Printer,
  Copy,
  Check,
  MessageSquare,
  Clock,
  MapPin,
  Mail,
  Truck,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertCircle,
  Hash,
  DollarSign,
  Layers3,
  Cpu,
  Wrench,
  Monitor,
  HardDrive,
  Zap,
  Fan,
  CheckCheck,
  Upload,
  Image as ImageIcon,
  Edit,
  CheckCircle,
  Edit3,
  Camera,
  RefreshCw,
  Sliders,
  Barcode,
  ScanLine,
  Download,
  Crop,
} from 'lucide-react';
import { ImageCropModal, AspectRatioType } from './ImageCropModal';
import { generateOrderInvoicePdf } from '../utils/generateInvoicePdf';
import {
  Product,
  ProductCategory,
  ProductVariant,
  Order,
  StoreSettings,
  CpuSocket,
  RamType,
  FormFactor,
  CustomCategory,
  UserAccount,
  CategoryAttributeSchema,
  CategoryAttributeDefinition,
} from '../types';
import { DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS } from '../data/defaultCategoryAttributes';
import { AttributeEditor } from './AttributeEditor';
import { formatPkr } from '../utils/formatters';
import { getProductFallbackImage, handleProductImageError } from '../utils/productImages';
import { generateProductSKU, generateSerialNumber } from '../utils/skuGenerator';
import { fetchWithBackoff, clearCachedApiResponse, authFetch } from '../utils/apiClient';
import { BarcodeLabel } from './BarcodeLabel';
import { ERPSuite } from './erp/ERPSuite';
import { OperationsHub } from './operations/OperationsHub';
import { GlobalBackendSearch } from './GlobalBackendSearch';
import { AdminGamesManager } from './AdminGamesManager';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRefreshProducts: (forceRefresh?: boolean) => void | Promise<void>;
  isAdminLoggedIn: boolean;
  setIsAdminLoggedIn: (val: boolean) => void;
  storeSettings: StoreSettings;
  onUpdateSettings: (settings: StoreSettings) => void;
}

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: 'cat-cpu', name: 'Processor', slug: 'processor', icon: '⚡', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80', description: 'Intel Core & AMD Ryzen CPUs', brands: ['AMD', 'Intel'], productCount: 0 },
  { id: 'cat-mobo', name: 'Motherboard', slug: 'motherboard', icon: '🎛️', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80', description: 'AM5, AM4, LGA1700 Motherboards', brands: ['ASUS', 'MSI', 'Gigabyte', 'ASRock'], productCount: 0 },
  { id: 'cat-gpu', name: 'Graphic Card', slug: 'graphic-card', icon: '🎮', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80', description: 'NVIDIA RTX & AMD Radeon GPUs', brands: ['ZOTAC', 'ASUS', 'MSI', 'Gigabyte', 'Palit', 'Sapphire', 'XFX', 'PowerColor'], productCount: 0 },
  { id: 'cat-ram', name: 'RAM', slug: 'ram', icon: '🧠', image: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&auto=format&fit=crop&q=80', description: 'DDR4 & DDR5 Gaming Memory Kits', brands: ['Corsair', 'G.Skill', 'Kingston', 'TeamGroup', 'Lexar'], productCount: 0 },
  { id: 'cat-storage', name: 'Storage', slug: 'storage', icon: '💾', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80', description: 'PCIe Gen4 NVMe & SATA SSDs', brands: ['Samsung', 'Kingston', 'Crucial', 'WD', 'Lexar'], productCount: 0 },
  { id: 'cat-psu', name: 'Power Supply', slug: 'power-supply', icon: '🔌', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80', description: '80+ Bronze/Gold Modular PSUs', brands: ['Corsair', 'DeepCool', 'MSI', 'Super Flower', 'SilverStone', 'Thermaltake'], productCount: 0 },
  { id: 'cat-casing', name: 'Casing', slug: 'casing', icon: '📦', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80', description: 'High-Airflow Tempered Glass Cases', brands: ['Lian Li', 'NZXT', 'Montech', 'DeepCool', 'DarkFlash', 'Corsair'], productCount: 0 },
  { id: 'cat-cooler', name: 'CPU Cooler', slug: 'cpu-cooler', icon: '❄️', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80', description: 'ARGB Liquid AIOs & Air Coolers', brands: ['DeepCool', 'Thermalright', 'NZXT', 'Lian Li', 'Corsair'], productCount: 0 },
  { id: 'cat-pc-case-fans', name: 'PC Case Fans', slug: 'pc-case-fans', icon: '🌀', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80', description: 'Chassis Cooling Fans, ARGB, Reverse Blades & High Static Pressure', brands: ['Lian Li', 'Corsair', 'Thermalright', 'Darkflash', 'DeepCool', 'Noctua', 'NZXT'], productCount: 0 },
  { id: 'cat-fans', name: 'Casing Fans', slug: 'casing-fans', icon: '🌀', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80', description: '120mm & 140mm ARGB Chassis Fans', brands: ['Lian Li', 'Corsair', 'DeepCool', 'DarkFlash'], productCount: 0 },
  { id: 'cat-monitor', name: 'Monitor', slug: 'monitor', icon: '🖥️', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80', description: '144Hz - 240Hz IPS Gaming Displays', brands: ['ASUS', 'AOC', 'MSI', 'Samsung', 'BenQ', 'LG'], productCount: 0 },
  { id: 'cat-peripherals', name: 'Peripherals', slug: 'peripherals', icon: '⌨️', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80', description: 'Mechanical Keyboards, Mice & Headsets', brands: ['Logitech', 'Razer', 'HyperX', 'SteelSeries', 'Redragon'], productCount: 0 },
  { id: 'cat-prebuilt', name: 'Pre-Built PC', slug: 'pre-built-pc', icon: '🚀', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80', description: 'Assembled & Stress-Tested Custom Gaming Rigs', brands: ['ApexRig PC'], productCount: 0 },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  products,
  onRefreshProducts,
  isAdminLoggedIn,
  setIsAdminLoggedIn,
  storeSettings,
  onUpdateSettings,
}) => {
  // Login form state
  const [usernameInput, setUsernameInput] = useState('sheedatalli');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Authenticated Admin User & Owner Authorization State
  const [currentAdminUser, setCurrentAdminUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('apex_admin_user') || localStorage.getItem('apex_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const refresh = () => {
      const token = localStorage.getItem('apex_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-apex-token'] = token;
      }
      return fetch('/api/auth/me', { credentials: 'include', headers })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((d) => {
          if (!active) return;
          if (d.user && d.user.role === 'admin') {
            setCurrentAdminUser(d.user);
            setIsAdminLoggedIn(true);
            try {
              localStorage.setItem('apex_admin_user', JSON.stringify(d.user));
              if (d.user.token) localStorage.setItem('apex_token', d.user.token);
            } catch {}
          } else if (d.user === null && !localStorage.getItem('apex_admin_user')) {
            setCurrentAdminUser(null);
            setIsAdminLoggedIn(false);
          }
        })
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isOpen]);
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerPasswordInput, setOwnerPasswordInput] = useState('');
  const [ownerUnlockError, setOwnerUnlockError] = useState<string | null>(null);

  // Computed check if the active user is the store owner
  const isOwner = currentAdminUser?.isOwner === true;

  // Admin tabs: operations | erp | products | categories | attributes | games | orders | users | settings
  const [adminTab, setAdminTab] = useState<'operations' | 'erp' | 'products' | 'categories' | 'attributes' | 'games' | 'orders' | 'users' | 'settings'>('erp');
  const [operationsSubTab, setOperationsSubTab] = useState<string>('sale');
  const [labelModalProduct, setLabelModalProduct] = useState<Product | null>(null);

  // Admin Tabs Slider & Horizontal Scrolling State
  const adminTabsScrollRef = useRef<HTMLDivElement>(null);
  const adminTabsTrackRef = useRef<HTMLDivElement>(null);
  const [adminTabsScrollProgress, setAdminTabsScrollProgress] = useState(0);
  const [adminTabsThumbWidth, setAdminTabsThumbWidth] = useState(25);
  const [canScrollAdminTabsLeft, setCanScrollAdminTabsLeft] = useState(false);
  const [canScrollAdminTabsRight, setCanScrollAdminTabsRight] = useState(false);
  const isDraggingAdminTabsSlider = useRef(false);
  const isDraggingAdminTabs = useRef(false);
  const startAdminTabsDragX = useRef(0);
  const startAdminTabsScrollLeft = useRef(0);

  const updateAdminTabsScrollMetrics = () => {
    const el = adminTabsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(1, scrollWidth - clientWidth);
    const progress = Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100));
    setAdminTabsScrollProgress(progress);
    
    const ratio = clientWidth / Math.max(clientWidth, scrollWidth);
    const thumbPct = Math.min(85, Math.max(15, ratio * 100));
    setAdminTabsThumbWidth(thumbPct);

    setCanScrollAdminTabsLeft(scrollLeft > 2);
    setCanScrollAdminTabsRight(scrollLeft < maxScroll - 2);
  };

  useEffect(() => {
    updateAdminTabsScrollMetrics();
    const handleResize = () => updateAdminTabsScrollMetrics();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollAdminTabsByDelta = (delta: number) => {
    if (adminTabsScrollRef.current) {
      adminTabsScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
      setTimeout(updateAdminTabsScrollMetrics, 150);
    }
  };

  const handleAdminTabsTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!adminTabsTrackRef.current || !adminTabsScrollRef.current) return;
    const rect = adminTabsTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.min(1, Math.max(0, clickX / rect.width));
    const el = adminTabsScrollRef.current;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: percentage * maxScroll, behavior: 'smooth' });
    setTimeout(updateAdminTabsScrollMetrics, 150);
  };

  const handleAdminTabsThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingAdminTabsSlider.current = true;
    const startX = e.clientX;
    const el = adminTabsScrollRef.current;
    if (!el || !adminTabsTrackRef.current) return;
    const initialScrollLeft = el.scrollLeft;
    const trackWidth = adminTabsTrackRef.current.clientWidth;
    const maxScroll = el.scrollWidth - el.clientWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingAdminTabsSlider.current || !el) return;
      const deltaX = moveEvent.clientX - startX;
      const scrollRatio = deltaX / trackWidth;
      el.scrollLeft = initialScrollLeft + scrollRatio * maxScroll;
      updateAdminTabsScrollMetrics();
    };

    const onMouseUp = () => {
      isDraggingAdminTabsSlider.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleAdminTabsWheel = (e: React.WheelEvent) => {
    if (adminTabsScrollRef.current && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      adminTabsScrollRef.current.scrollLeft += e.deltaY;
      updateAdminTabsScrollMetrics();
    }
  };

  const handleAdminTabsMouseDown = (e: React.MouseEvent) => {
    if (!adminTabsScrollRef.current) return;
    isDraggingAdminTabs.current = true;
    startAdminTabsDragX.current = e.pageX - adminTabsScrollRef.current.offsetLeft;
    startAdminTabsScrollLeft.current = adminTabsScrollRef.current.scrollLeft;
  };

  const handleAdminTabsMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingAdminTabs.current || !adminTabsScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - adminTabsScrollRef.current.offsetLeft;
    const walk = (x - startAdminTabsDragX.current) * 1.5;
    adminTabsScrollRef.current.scrollLeft = startAdminTabsScrollLeft.current - walk;
    updateAdminTabsScrollMetrics();
  };

  const handleAdminTabsMouseUp = () => {
    isDraggingAdminTabs.current = false;
  };

  // Hardware Specification & Attribute Schemas State
  const [categorySchemas, setCategorySchemas] = useState<CategoryAttributeSchema[]>(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS);
  const [isClearCatalogModalOpen, setIsClearCatalogModalOpen] = useState(false);
  const [isClearingCatalog, setIsClearingCatalog] = useState(false);
  const [isZeroStockModalOpen, setIsZeroStockModalOpen] = useState(false);
  const [isZeroingStock, setIsZeroingStock] = useState(false);

  // Image Cropping & Framing Modal State
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
    aspectRatio: AspectRatioType;
    onCropComplete: (url: string) => void;
  }>({
    isOpen: false,
    imageUrl: '',
    title: 'Adjust & Frame Image',
    aspectRatio: '1:1',
    onCropComplete: () => {},
  });

  const openImageCropper = (
    imageUrl: string,
    title: string,
    aspectRatio: AspectRatioType,
    onComplete: (url: string) => void
  ) => {
    const safeUrl = imageUrl?.trim() || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&auto=format&fit=crop&q=80';
    setCropModal({
      isOpen: true,
      imageUrl: safeUrl,
      title,
      aspectRatio,
      onCropComplete: async (croppedUrl) => {
        onComplete(croppedUrl);
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: croppedUrl, name: `crop-${Date.now()}.webp` }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              onComplete(data.url);
            }
          }
        } catch {
          // keep croppedUrl
        }
      },
    });
  };

  // Backend User & Admin Management State
  const [backendUsers, setBackendUsers] = useState<UserAccount[]>(() => {
    try {
      const cached = localStorage.getItem('apex_users_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'user-owner-1',
        fullName: 'Hammad Ur Rehman (Owner)',
        username: 'sheedatalli',
        email: 'bhaiisheeda@gmail.com',
        phone: '+447597030688',
        city: 'Lahore',
        address: 'Shop #G-14, Ground Floor, Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan',
        role: 'admin',
        isOwner: true,
      },
    ];
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'customer'>('all');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userFormFullName, setUserFormFullName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormPhone, setUserFormPhone] = useState('');
  const [userFormCity, setUserFormCity] = useState('Lahore');
  const [userFormAddress, setUserFormAddress] = useState('');
  const [userFormRole, setUserFormRole] = useState<'admin' | 'customer'>('admin');
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Categories list
  const [categories, setCategories] = useState<CustomCategory[]>(DEFAULT_CATEGORIES);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catIconInput, setCatIconInput] = useState('📦');
  const [catImageInput, setCatImageInput] = useState('');
  const [catBannerImageInput, setCatBannerImageInput] = useState('');
  const [catDescInput, setCatDescInput] = useState('');
  const [catBrandsInput, setCatBrandsInput] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  // Sync & Upload States
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);
  const [isUploadingCatImage, setIsUploadingCatImage] = useState(false);
  const [isUploadingCatBanner, setIsUploadingCatBanner] = useState(false);
  const catFileInputRef = useRef<HTMLInputElement>(null);
  const prodFileInputRef = useRef<HTMLInputElement>(null);

  // Product table filtering
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');

  // Quick inline price editing
  const [quickEditingPriceId, setQuickEditingPriceId] = useState<string | null>(null);
  const [quickPriceVal, setQuickPriceVal] = useState<string>('');
  const [isSavingQuickPrice, setIsSavingQuickPrice] = useState(false);

  // Product Editor Modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<CustomCategory | null>(null);

  // Form fields for new/edited product
  const [formSku, setFormSku] = useState('');
  const [formEan, setFormEan] = useState('');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('Processor');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formOriginalPrice, setFormOriginalPrice] = useState<number | undefined>(undefined);
  const [formCostPrice, setFormCostPrice] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [descriptionGenNotice, setDescriptionGenNotice] = useState<string | null>(null);
  const [formStockCount, setFormStockCount] = useState<number>(0);
  const [formInStock, setFormInStock] = useState<boolean>(true);
  const [formImage, setFormImage] = useState('');
  const [formIsVariable, setFormIsVariable] = useState<boolean>(false);
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([]);

  // Specs form fields
  const [formSocket, setFormSocket] = useState<CpuSocket | ''>('');
  const [formRamType, setFormRamType] = useState<RamType | ''>('');
  const [formFormFactor, setFormFormFactor] = useState<FormFactor | ''>('');
  const [formTdpWatts, setFormTdpWatts] = useState<number | ''>('');
  const [formVramGb, setFormVramGb] = useState<number | ''>('');
  const [formPsuWattage, setFormPsuWattage] = useState<number | ''>('');
  const [formRecPsu, setFormRecPsu] = useState<number | ''>('');
  const [formCustomAttributes, setFormCustomAttributes] = useState<Record<string, any>>({});
  const [isAutoFillingSpecs, setIsAutoFillingSpecs] = useState<boolean>(false);
  const [autoFillNotice, setAutoFillNotice] = useState<string | null>(null);

  // Orders State & Inspection
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState<boolean>(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderSourceTab, setOrderSourceTab] = useState<'WEBSITE' | 'ERP'>('WEBSITE');
  const [orderCopiedAlert, setOrderCopiedAlert] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [courierInput, setCourierInput] = useState('Daewoo Express Cargo');
  const [isDispatchingLeopards, setIsDispatchingLeopards] = useState(false);
  const [leopardsNotice, setLeopardsNotice] = useState<string | null>(null);

  // Order Components / Items Editing States
  const [isEditingOrderItems, setIsEditingOrderItems] = useState(false);
  const [editableOrderItems, setEditableOrderItems] = useState<any[]>([]);
  const [isSavingOrderItems, setIsSavingOrderItems] = useState(false);
  const [orderEditNotice, setOrderEditNotice] = useState<string | null>(null);
  const [swappingItemIndex, setSwappingItemIndex] = useState<number | null>(null);
  const [swapProductSearch, setSwapProductSearch] = useState('');
  const [isAddingNewOrderItem, setIsAddingNewOrderItem] = useState(false);

  const CARRIER_SERVICE_OPTIONS = [
    {
      group: 'Cargo Freight (For Full PC Builds & Heavy Rigs)',
      options: [
        'Daewoo Express Cargo',
        'Faisal Movers Cargo',
        'M&P Express Cargo',
        'Bilal Travels Cargo',
        'Skyways Cargo',
        'Kainat Travels Cargo',
        'Custom Cargo / Bilty Freight',
      ],
    },
    {
      group: 'Express Courier (For Loose Components & Parts)',
      options: [
        'Leopards Courier',
        'TCS Express',
        'Trax Logistics',
        'PostEx Courier',
        'Call Courier',
        'M&P Courier',
      ],
    },
    {
      group: 'Store & Local Pickup',
      options: [
        'Store Pickup (No Courier Tracking)',
        'Local Delivery Rider (Lahore)',
      ],
    },
  ];

  const hasPcBuildInOrder = (order?: Order | null): boolean => {
    if (!order || !order.items) return false;
    return order.items.some((i: any) => {
      if (i.isCustomRig) return true;
      if (i.rigConfig && Object.keys(i.rigConfig).length > 0) return true;
      const cat = (i.category || '').toLowerCase();
      if (cat.includes('pre-built') || cat.includes('custom pc') || cat.includes('pc build') || cat.includes('gaming pc')) return true;
      const name = (i.name || '').toLowerCase();
      if (name.includes('custom pc rig') || name.includes('pre-built gaming') || name.includes('workstation rig') || name.includes('full build')) return true;
      return false;
    });
  };

  // Settings form
  const [settingsForm, setSettingsForm] = useState<StoreSettings>(storeSettings);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettingsForm(storeSettings);
  }, [storeSettings]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);


  useEffect(() => {
    fetchCategories();
    fetchCategorySchemas();
    fetchBackendUsers();
    if (isAdminLoggedIn) {
      fetchOrders();
    }
  }, [isAdminLoggedIn]);

  const fetchCategorySchemas = async () => {
    try {
      const data = await fetchWithBackoff<any>('/api/category-attributes', {
        maxRetries: 3,
        initialDelayMs: 300,
        useCache: true,
        cacheTtlMs: 120000,
      });
      const schemasList = Array.isArray(data) ? data : (data?.schemas || []);
      if (schemasList.length > 0) {
        setCategorySchemas(schemasList);
      }
    } catch (e) {
      console.warn('Using default category schemas:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await fetchWithBackoff<CustomCategory[]>('/api/categories', {
        maxRetries: 3,
        initialDelayMs: 300,
        useCache: true,
        cacheTtlMs: 120000,
      });
      if (Array.isArray(data) && data.length > 0) {
        setCategories(data);
      }
    } catch (e) {
      console.warn('Using default categories', e);
    }
  };

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const data = await fetchWithBackoff<Order[]>('/api/orders', {
        maxRetries: 3,
        initialDelayMs: 350,
      });
      if (Array.isArray(data)) {
        setOrders(data);
        try {
          localStorage.setItem('apex_orders_cache', JSON.stringify(data));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Fallback to local orders cache:', e);
      try {
        const cached = localStorage.getItem('apex_orders_cache');
        if (cached) setOrders(JSON.parse(cached));
      } catch (err) {}
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchBackendUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchWithBackoff<UserAccount[]>('/api/admin/users', {
        maxRetries: 3,
        initialDelayMs: 350,
      });
      if (Array.isArray(data) && data.length > 0) {
        setBackendUsers(data);
        try {
          localStorage.setItem('apex_users_cache', JSON.stringify(data));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Failed to fetch backend users; checking local cache:', e);
      try {
        const cached = localStorage.getItem('apex_users_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBackendUsers(parsed);
          }
        }
      } catch (err) {}
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminLoggedIn(true);
        if (data.user) {
          setCurrentAdminUser(data.user);
          try {
            localStorage.setItem('apex_admin_user', JSON.stringify(data.user));
            if (data.user.token) {
              localStorage.setItem('apex_token', data.user.token);
            }
          } catch (e) {}
        }
        fetchOrders();
        fetchCategories();
        fetchBackendUsers();
      } else {
        setLoginError(data.error || 'Invalid credentials. Only owner (sheedatalli) or authorized backend admins can sign in.');
      }
    } catch (e: any) {
      setLoginError('Could not reach backend authentication server');
    }
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormFullName('');
    setUserFormEmail('');
    setUserFormUsername('');
    setUserFormPassword('');
    setUserFormPhone('');
    setUserFormCity('Lahore');
    setUserFormAddress('');
    setUserFormRole('admin');
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (usr: UserAccount) => {
    setEditingUser(usr);
    setUserFormFullName(usr.fullName);
    setUserFormEmail(usr.email);
    setUserFormUsername(usr.username || '');
    setUserFormPassword('');
    setUserFormPhone(usr.phone || '');
    setUserFormCity(usr.city || 'Lahore');
    setUserFormAddress(usr.address || '');
    setUserFormRole(usr.role);
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUserModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    if (!userFormFullName.trim() || !userFormEmail.trim()) {
      setUserModalError('Full name and email are required');
      return;
    }

    if (!editingUser && (!userFormPassword || userFormPassword.length < 6)) {
      setUserModalError('Password must be at least 6 characters');
      return;
    }

    try {
      const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';
      const payload: any = {
        fullName: userFormFullName.trim(),
        email: userFormEmail.trim().toLowerCase(),
        username: userFormUsername.trim().toLowerCase() || undefined,
        phone: userFormPhone.trim(),
        city: userFormCity.trim(),
        address: userFormAddress.trim(),
        role: userFormRole,
      };

      if (userFormPassword.trim()) {
        payload.password = userFormPassword.trim();
      }

      const res = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchBackendUsers();
        setIsUserModalOpen(false);
        setUserActionSuccess(
          editingUser
            ? `User "${userFormFullName}" updated successfully`
            : `New ${userFormRole === 'admin' ? 'Store Admin' : 'Customer'} account created successfully!`
        );
        setTimeout(() => setUserActionSuccess(null), 4000);
      } else {
        setUserModalError(data.error || 'Failed to save user account');
      }
    } catch (err: any) {
      setUserModalError('Network error while saving user');
    }
  };

  const handleToggleUserRole = async (usr: UserAccount) => {
    if (usr.isOwner || usr.username === 'sheedatalli') {
      alert('Cannot change the role of the primary Store Owner.');
      return;
    }
    const newRole = usr.role === 'admin' ? 'customer' : 'admin';
    try {
      const res = await authFetch(`/api/admin/users/${usr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        await fetchBackendUsers();
        setUserActionSuccess(`Role for ${usr.fullName} changed to ${newRole.toUpperCase()}`);
        setTimeout(() => setUserActionSuccess(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUserAccount = (usr: UserAccount) => {
    if (usr.isOwner || usr.username === 'sheedatalli' || usr.email.toLowerCase() === 'bhaiisheeda@gmail.com') {
      setUserActionSuccess('Primary Store Owner account is protected and cannot be deleted.');
      setTimeout(() => setUserActionSuccess(null), 4000);
      return;
    }
    setUserToDelete(usr);
  };

  const handleExecuteDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(userToDelete.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        await fetchBackendUsers();
        setUserActionSuccess(`User account "${userToDelete.fullName}" has been deleted.`);
        setTimeout(() => setUserActionSuccess(null), 3500);
        setUserToDelete(null);
      } else {
        setUserActionSuccess(data.error || 'Failed to delete user account.');
        setTimeout(() => setUserActionSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setUserActionSuccess(err?.message || 'Error deleting account');
      setTimeout(() => setUserActionSuccess(null), 4000);
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Open add product modal
  const handleOpenAddProduct = (presetCategory?: ProductCategory, presetBrand?: string) => {
    setIsAddingNew(true);
    setEditingProduct(null);
    const cat = presetCategory || (categories[0]?.name as ProductCategory) || 'Processor';
    const brand = presetBrand || 'ApexForge';
    const generatedSku = generateProductSKU({ category: cat, brand, name: 'Item' }, products);
    setFormSku(generatedSku);
    setFormEan('');
    setFormSerialNumber('');
    setFormName('');
    setFormBrand(presetBrand || '');
    setFormCategory(cat);
    setFormPrice(50000);
    setFormOriginalPrice(undefined);
    setFormCostPrice('');
    setFormDescription('');
    setFormStockCount(0);
    setFormInStock(true);
    setFormImage('https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80');
    setFormIsVariable(false);
    setFormVariants([]);
    const isCpuCategory = cat.toLowerCase().includes('processor') || cat.toLowerCase().includes('cpu');
    setFormSocket(isCpuCategory ? 'AM5' : '');
    setFormRamType('');
    setFormFormFactor('');
    setFormTdpWatts(isCpuCategory ? 65 : '');
    setFormVramGb('');
    setFormPsuWattage('');
    setFormRecPsu('');
    setFormCustomAttributes({});
    setAutoFillNotice(null);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setIsAddingNew(false);
    setEditingProduct(prod);
    const prodSku = prod.sku || generateProductSKU(prod, products);
    setFormSku(prodSku);
    setFormEan(prod.ean || prod.barcode || '');
    setFormSerialNumber(prod.serialNumber || generateSerialNumber({ ...prod, sku: prodSku }));
    setFormName(prod.name);
    setFormBrand(prod.brand);
    setFormCategory(prod.category);
    setFormCostPrice(prod.costPrice !== undefined ? prod.costPrice : '');
    if (prod.originalPrice && prod.originalPrice > 0) {
      // Price picker is default price (the higher regular price), Sale picker is discounted price (the lower price shown on site)
      const regularPrice = Math.max(prod.price, prod.originalPrice);
      const salePrice = Math.min(prod.price, prod.originalPrice);
      setFormPrice(regularPrice);
      setFormOriginalPrice(salePrice < regularPrice ? salePrice : undefined);
    } else {
      setFormPrice(prod.price);
      setFormOriginalPrice(undefined);
    }
    setFormDescription(prod.description);
    setFormStockCount(Math.max(0, Number(prod.stockCount) || 0));
    setFormInStock(prod.inStock !== false);
    setFormImage(prod.image);
    setFormIsVariable(prod.isVariable);
    setFormVariants(prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : []);
    setFormSocket(prod.specifications?.socket || '');
    setFormRamType(prod.specifications?.ramType || '');
    setFormFormFactor(prod.specifications?.formFactor || '');
    setFormTdpWatts(prod.specifications?.tdpWatts || '');
    setFormVramGb(prod.specifications?.vramGb || '');
    setFormPsuWattage(prod.specifications?.psuWattage || '');
    setFormRecPsu(prod.specifications?.recommendedPsuWatts || '');
    setFormCustomAttributes(
      prod.specifications?.customAttributes
        ? JSON.parse(JSON.stringify(prod.specifications.customAttributes))
        : {}
    );
    setAutoFillNotice(null);
  };

  const handleAutoFillSpecs = async () => {
    if (!formName.trim()) {
      setAutoFillNotice('Please enter a Product Title before auto-filling specifications.');
      setTimeout(() => setAutoFillNotice(null), 3500);
      return;
    }

    setIsAutoFillingSpecs(true);
    setAutoFillNotice(null);
    try {
      const activeSchema = categorySchemas.find(
        (s) => s.category.toLowerCase() === formCategory.toLowerCase()
      );

      const res = await fetch('/api/ai/fetch-hardware-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: formName,
          category: formCategory,
          brand: formBrand,
          schema: activeSchema,
          schemaAttributes: activeSchema?.attributes || [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.specifications) {
          const specs = data.specifications;
          const catLower = (formCategory || '').toLowerCase();
          const isCpu = catLower.includes('processor') || catLower.includes('cpu');
          const isGpu = catLower.includes('graphic') || catLower.includes('gpu') || catLower.includes('video card');
          const isMobo = catLower.includes('motherboard') || catLower.includes('mobo');
          const isRam = catLower.includes('ram') || catLower.includes('memory');
          const isPsu = catLower.includes('power supply') || catLower.includes('psu');
          const isCooler = catLower.includes('cooler');
          const isCasing = catLower.includes('casing') || catLower.includes('case');
          const isPrebuilt = catLower.includes('pre-built') || catLower.includes('prebuilt') || catLower.includes('pc build');

          // Strictly map hardware fields only for compatible builder categories
          if (isCpu || isMobo || isCooler || isPrebuilt) {
            if (specs.socket) setFormSocket(specs.socket);
          } else {
            setFormSocket('');
          }

          if (isRam || isMobo || isCpu || isPrebuilt) {
            if (specs.ramType) setFormRamType(specs.ramType);
          } else {
            setFormRamType('');
          }

          if (isMobo || isCasing || isPsu || isPrebuilt) {
            if (specs.formFactor) setFormFormFactor(specs.formFactor);
          } else {
            setFormFormFactor('');
          }

          if (isCpu || isPrebuilt) {
            if (specs.tdpWatts !== undefined && specs.tdpWatts !== null && specs.tdpWatts !== '') {
              setFormTdpWatts(Number(specs.tdpWatts));
            }
          } else {
            setFormTdpWatts('');
          }

          if (isGpu || isPrebuilt) {
            if (specs.vramGb !== undefined && specs.vramGb !== null && specs.vramGb !== '') {
              setFormVramGb(Number(specs.vramGb));
            }
            if (specs.recommendedPsuWatts !== undefined && specs.recommendedPsuWatts !== null && specs.recommendedPsuWatts !== '') {
              setFormRecPsu(Number(specs.recommendedPsuWatts));
            }
          } else {
            setFormVramGb('');
            setFormRecPsu('');
          }

          if (isPsu || isPrebuilt) {
            if (specs.psuWattage !== undefined && specs.psuWattage !== null && specs.psuWattage !== '') {
              setFormPsuWattage(Number(specs.psuWattage));
            }
          } else {
            setFormPsuWattage('');
          }

          // Map custom attributes dictionary and any top-level matching schema keys
          const incomingCustom = specs.customAttributes || {};
          const mappedAttributes: Record<string, any> = { ...incomingCustom };

          if (activeSchema && activeSchema.attributes) {
            activeSchema.attributes.forEach((attr) => {
              if (mappedAttributes[attr.id] === undefined) {
                if (specs[attr.id] !== undefined) {
                  mappedAttributes[attr.id] = specs[attr.id];
                } else if (data[attr.id] !== undefined) {
                  mappedAttributes[attr.id] = data[attr.id];
                }
              }
            });
          }

          setFormCustomAttributes((prev) => ({
            ...prev,
            ...mappedAttributes,
          }));

          if (data.brand && (!formBrand || formBrand.trim() === '')) {
            setFormBrand(data.brand);
          }

          const newDesc = data.description || data.summary || data.shortDescription;
          if (newDesc && (!formDescription || formDescription.length < 30)) {
            setFormDescription(newDesc);
          }

          setAutoFillNotice(
            data.aiGenerated
              ? '✨ Hardware specifications verified & auto-filled by AI from web database!'
              : '✨ Hardware specifications retrieved and auto-filled!'
          );
          setTimeout(() => setAutoFillNotice(null), 5000);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setAutoFillNotice(errData.error || 'Could not auto-fill specs. Please enter manually.');
        setTimeout(() => setAutoFillNotice(null), 4000);
      }
    } catch (err) {
      console.error('Failed to auto-fill hardware specs:', err);
      setAutoFillNotice('Network error fetching specs from online database.');
      setTimeout(() => setAutoFillNotice(null), 3500);
    } finally {
      setIsAutoFillingSpecs(false);
    }
  };

  const handleAddVariant = () => {
    const parentSku = formSku.trim() || 'APX-VAR';
    const parentSerial = formSerialNumber.trim() || 'SN-APX-2601-0001';
    const newVariant: ProductVariant = {
      id: `var-${Date.now()}`,
      sku: `${parentSku}-BLK`,
      serialNumber: `${parentSerial}-V${formVariants.length + 1}`,
      name: 'Black Edition',
      color: 'Black',
      colorHex: '#18181b',
      price: formPrice,
      stock: 5,
      image: formImage,
    };
    setFormVariants([...formVariants, newVariant]);
  };

  const handleGenerateDescription = async () => {
    setIsGeneratingDescription(true);
    setDescriptionGenNotice(null);
    try {
      const res = await fetch('/api/ai/generate-product-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          brand: formBrand,
          category: formCategory,
          price: formPrice,
          specifications: {
            socket: formSocket || undefined,
            ramType: formRamType || undefined,
            formFactor: formFormFactor || undefined,
            tdpWatts: formTdpWatts ? Number(formTdpWatts) : undefined,
            vramGb: formVramGb ? Number(formVramGb) : undefined,
            psuWattage: formPsuWattage ? Number(formPsuWattage) : undefined,
            recommendedPsuWatts: formRecPsu ? Number(formRecPsu) : undefined,
          },
          variants: formVariants,
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Server returned invalid format (possibly timed out)');
      }
      if (res.ok && data && data.description) {
        setFormDescription(data.description);
        setDescriptionGenNotice(data.aiGenerated ? '✨ AI Description Generated!' : '✨ Description Generated!');
        setTimeout(() => setDescriptionGenNotice(null), 3500);
      } else {
        setDescriptionGenNotice('❌ ' + (data?.error || 'Failed to generate AI description.'));
        setTimeout(() => setDescriptionGenNotice(null), 5000);
      }
    } catch (err) {
      console.error('Failed to generate product description:', err);
      setDescriptionGenNotice('❌ Failed to connect to AI service. Please try again.');
      setTimeout(() => setDescriptionGenNotice(null), 5000);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalSku = formSku.trim() || generateProductSKU({ name: formName, brand: formBrand, category: formCategory }, products);
    const finalSerialNumber = formSerialNumber.trim() || generateSerialNumber({ name: formName, brand: formBrand, category: formCategory, sku: finalSku });

    const catLower = (formCategory || '').toLowerCase();
    const isCpu = catLower.includes('processor') || catLower.includes('cpu');
    const isGpu = catLower.includes('graphic') || catLower.includes('gpu') || catLower.includes('video card');
    const isMobo = catLower.includes('motherboard') || catLower.includes('mobo');
    const isRam = catLower.includes('ram') || catLower.includes('memory');
    const isPsu = catLower.includes('power supply') || catLower.includes('psu');
    const isCooler = catLower.includes('cooler');
    const isCasing = catLower.includes('casing') || catLower.includes('case');
    const isPrebuilt = catLower.includes('pre-built') || catLower.includes('prebuilt') || catLower.includes('pc build');

    const cleanSpecs: any = {
      ...(editingProduct?.specifications || {}),
      customAttributes: Object.keys(formCustomAttributes).length > 0 ? formCustomAttributes : undefined,
    };

    if (isCpu || isMobo || isCooler || isPrebuilt) {
      if (formSocket) cleanSpecs.socket = formSocket;
      else delete cleanSpecs.socket;
    } else {
      delete cleanSpecs.socket;
    }

    if (isRam || isMobo || isCpu || isPrebuilt) {
      if (formRamType) cleanSpecs.ramType = formRamType;
      else delete cleanSpecs.ramType;
    } else {
      delete cleanSpecs.ramType;
    }

    if (isMobo || isPsu || isCasing || isPrebuilt) {
      if (formFormFactor) cleanSpecs.formFactor = formFormFactor;
      else delete cleanSpecs.formFactor;
    } else {
      delete cleanSpecs.formFactor;
    }

    if (isCpu || isGpu || isCooler || isPrebuilt) {
      if (formTdpWatts) cleanSpecs.tdpWatts = Number(formTdpWatts);
      else delete cleanSpecs.tdpWatts;
    } else {
      delete cleanSpecs.tdpWatts;
    }

    if (isGpu || isPrebuilt) {
      if (formVramGb) cleanSpecs.vramGb = Number(formVramGb);
      else delete cleanSpecs.vramGb;
      if (formRecPsu) cleanSpecs.recommendedPsuWatts = Number(formRecPsu);
      else delete cleanSpecs.recommendedPsuWatts;
    } else {
      delete cleanSpecs.vramGb;
      delete cleanSpecs.recommendedPsuWatts;
    }

    if (isPsu || isPrebuilt) {
      if (formPsuWattage) cleanSpecs.psuWattage = Number(formPsuWattage);
      else delete cleanSpecs.psuWattage;
    } else {
      delete cleanSpecs.psuWattage;
    }

    // Pricing calculation: Price picker is default price, Sale picker is discounted price shown on website
    const defaultPrice = Math.max(0, Number(formPrice) || 0);
    const rawSalePrice =
      formOriginalPrice !== undefined &&
      formOriginalPrice !== null &&
      !isNaN(Number(formOriginalPrice)) &&
      Number(formOriginalPrice) > 0
        ? Number(formOriginalPrice)
        : undefined;

    let finalSellingPrice = defaultPrice;
    let finalOriginalPrice: number | undefined = undefined;

    if (rawSalePrice !== undefined) {
      if (rawSalePrice < defaultPrice) {
        // Price picker is default regular price (struck out), Sale picker is discounted price shown on website
        finalSellingPrice = rawSalePrice;
        finalOriginalPrice = defaultPrice;
      } else if (rawSalePrice > defaultPrice) {
        // Inverted input safety: lower price is the active sale price shown on site, higher is default price
        finalSellingPrice = defaultPrice;
        finalOriginalPrice = rawSalePrice;
      } else {
        // Equal: default price without discount
        finalSellingPrice = defaultPrice;
        finalOriginalPrice = undefined;
      }
    } else {
      finalSellingPrice = defaultPrice;
      finalOriginalPrice = undefined;
    }

    const stockCountNum = Math.max(0, Number(formStockCount) || 0);

    const productPayload: any = {
      sku: finalSku,
      ean: formEan.trim() || undefined,
      barcode: formEan.trim() || undefined,
      serialNumber: isAddingNew ? undefined : (editingProduct?.serialNumber || formSerialNumber.trim() || undefined),
      costPrice: isAddingNew ? undefined : (editingProduct?.costPrice !== undefined ? editingProduct.costPrice : (formCostPrice !== '' ? Math.max(0, Number(formCostPrice) || 0) : undefined)),
      name: formName,
      brand: formBrand || 'ApexForge',
      category: formCategory,
      price: finalSellingPrice,
      originalPrice: finalOriginalPrice ?? null,
      description: formDescription,
      stockCount: stockCountNum,
      inStock: formInStock,
      image: formImage || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80',
      isVariable: formIsVariable,
      variants: formIsVariable ? formVariants : [],
      specifications: cleanSpecs,
    };

    try {
      if (isAddingNew) {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productPayload),
        });
        if (res.ok) {
          const newProduct: Product = await res.json();
          clearCachedApiResponse('/api/products');
          clearCachedApiResponse();

          try {
            const current = localStorage.getItem('apex_persisted_products');
            if (current) {
              const arr = JSON.parse(current);
              if (Array.isArray(arr)) {
                localStorage.setItem('apex_persisted_products', JSON.stringify([newProduct, ...arr]));
              }
            }
          } catch {}

          window.dispatchEvent(
            new CustomEvent('apex:products_updated', { detail: { product: newProduct } })
          );

          await onRefreshProducts(true);
          fetchCategories();
          setIsAddingNew(false);
          setEditingProduct(null);
          setSyncNotice(`Added "${newProduct.name}" to catalog.`);
          setTimeout(() => setSyncNotice(null), 3500);
        }
      } else if (editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productPayload),
        });
        if (res.ok) {
          const updatedProduct: Product = await res.json();
          clearCachedApiResponse('/api/products');
          clearCachedApiResponse();

          try {
            const current = localStorage.getItem('apex_persisted_products');
            if (current) {
              const arr = JSON.parse(current);
              if (Array.isArray(arr)) {
                const idx = arr.findIndex((p: any) => p.id === updatedProduct.id);
                if (idx !== -1) arr[idx] = updatedProduct;
                else arr.unshift(updatedProduct);
                localStorage.setItem('apex_persisted_products', JSON.stringify(arr));
              }
            }
          } catch {}

          window.dispatchEvent(
            new CustomEvent('apex:products_updated', { detail: { product: updatedProduct } })
          );

          await onRefreshProducts(true);
          fetchCategories();
          setEditingProduct(null);
          setSyncNotice(`Updated price & specifications for "${updatedProduct.name}" instantly.`);
          setTimeout(() => setSyncNotice(null), 3500);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error saving product');
    }
  };

  const handleDeleteProduct = async (productOrId: Product | string) => {
    const id = typeof productOrId === 'string' ? productOrId : productOrId.id;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        clearCachedApiResponse('/api/products');
        clearCachedApiResponse();
        try {
          const current = localStorage.getItem('apex_persisted_products');
          if (current) {
            const arr = JSON.parse(current);
            if (Array.isArray(arr)) {
              localStorage.setItem('apex_persisted_products', JSON.stringify(arr.filter((p: any) => p.id !== id)));
            }
          }
        } catch {}
        window.dispatchEvent(new CustomEvent('apex:products_updated'));
        await onRefreshProducts(true);
        fetchCategories();
        setSyncNotice('Product deleted permanently.');
        setTimeout(() => setSyncNotice(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setProductToDelete(null);
  };

  // Quick Price Edit Handlers for Products Table
  const handleStartQuickPriceEdit = (prod: Product) => {
    setQuickEditingPriceId(prod.id);
    setQuickPriceVal(String(prod.price));
  };

  const handleSaveQuickPrice = async (prod: Product) => {
    const newPrice = Number(quickPriceVal);
    if (isNaN(newPrice) || newPrice < 0) {
      setQuickEditingPriceId(null);
      return;
    }

    setIsSavingQuickPrice(true);
    const updated: Product = { ...prod, price: newPrice };

    // 1. Immediately invalidate API cache
    clearCachedApiResponse('/api/products');
    clearCachedApiResponse();

    // 2. Optimistically update local storage
    try {
      const current = localStorage.getItem('apex_persisted_products');
      if (current) {
        const arr = JSON.parse(current);
        if (Array.isArray(arr)) {
          const idx = arr.findIndex((p: any) => p.id === prod.id);
          if (idx !== -1) arr[idx] = updated;
          else arr.unshift(updated);
          localStorage.setItem('apex_persisted_products', JSON.stringify(arr));
        }
      }
    } catch {}

    // 3. Dispatch realtime event so App and all modules update INSTANTLY without reload
    window.dispatchEvent(
      new CustomEvent('apex:products_updated', { detail: { product: updated } })
    );

    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newPrice }),
      });
      if (res.ok) {
        const saved: Product = await res.json();
        window.dispatchEvent(
          new CustomEvent('apex:products_updated', { detail: { product: saved } })
        );
        await onRefreshProducts(true);
        setSyncNotice(`Updated price for "${prod.name}" to ${formatPkr(newPrice)} instantly.`);
        setTimeout(() => setSyncNotice(null), 3000);
      }
    } catch (e) {
      console.error('Failed to update product price:', e);
    } finally {
      setIsSavingQuickPrice(false);
      setQuickEditingPriceId(null);
    }
  };

  // Category Modal Handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatNameInput('');
    setCatIconInput('📦');
    setCatImageInput('');
    setCatBannerImageInput('');
    setCatDescInput('');
    setCatBrandsInput('');
    setCatError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CustomCategory) => {
    setEditingCategory(cat);
    setCatNameInput(cat.name);
    setCatIconInput(cat.icon || '📦');
    setCatImageInput(cat.image || '');
    setCatBannerImageInput(cat.bannerImage || '');
    setCatDescInput(cat.description || '');
    setCatBrandsInput(cat.brands ? cat.brands.join(', ') : '');
    setCatError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    if (!catNameInput.trim()) {
      setCatError('Category name is required');
      return;
    }

    try {
      const parsedBrands = catBrandsInput
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);

      const endpoint = editingCategory
        ? `/api/categories/${editingCategory.id || editingCategory.name}`
        : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: catNameInput.trim(),
          icon: catIconInput.trim() || '📦',
          image: catImageInput.trim() || undefined,
          bannerImage: catBannerImageInput.trim() || undefined,
          description: catDescInput.trim(),
          brands: parsedBrands,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchCategories();
        onRefreshProducts();
        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        setCatNameInput('');
        setCatIconInput('📦');
        setCatImageInput('');
        setCatBannerImageInput('');
        setCatDescInput('');
        setCatBrandsInput('');
      } else {
        setCatError(data.error || 'Failed to save category');
      }
    } catch (e: any) {
      setCatError('Failed to save category');
    }
  };

  const handleDeleteCategory = async (cat: CustomCategory) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
    setCategoryToDelete(null);
  };

  // Helper for uploading local image files with optional interactive framing/cropping
  const handleUploadFile = (
    file: File,
    onSuccess: (url: string) => void,
    setLoading?: (loading: boolean) => void,
    cropOptions?: { title: string; aspectRatio: AspectRatioType }
  ) => {
    if (!file) return;
    if (setLoading) setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (!base64) {
        if (setLoading) setLoading(false);
        return;
      }

      // Immediately display the loaded file in the form
      onSuccess(base64);

      // If interactive cropping requested, open modal to frame & crop
      if (cropOptions) {
        if (setLoading) setLoading(false);
        setCropModal({
          isOpen: true,
          imageUrl: base64,
          title: cropOptions.title,
          aspectRatio: cropOptions.aspectRatio,
          onCropComplete: async (croppedUrl) => {
            if (setLoading) setLoading(true);
            onSuccess(croppedUrl);
            try {
              const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: croppedUrl, name: file.name }),
              });
              if (res.ok) {
                const json = await res.json();
                if (json.url) {
                  onSuccess(json.url);
                }
              }
            } catch (err) {
              console.warn('Using client data URL', err);
            } finally {
              if (setLoading) setLoading(false);
            }
          },
        });
        return;
      }

      // Direct upload without crop modal
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, name: file.name }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.url) {
            onSuccess(json.url);
          }
        }
      } catch (err) {
        console.warn('Using client data URL', err);
      } finally {
        if (setLoading) setLoading(false);
      }
    };
    reader.onerror = () => {
      if (setLoading) setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearCatalog = async () => {
    setIsClearingCatalog(true);
    try {
      const res = await fetch('/api/products/manage/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      if (res.ok) {
        clearCachedApiResponse();
        try {
          localStorage.setItem('apex_persisted_products', JSON.stringify([]));
        } catch {}
        await onRefreshProducts(true);
        await fetchCategories();
        setIsClearCatalogModalOpen(false);
        setSyncNotice('All products cleared from catalog. Ready for fresh inventory entry.');
        setTimeout(() => setSyncNotice(null), 5000);
      }
    } catch (err) {
      console.error(err);
      setSyncNotice('Error clearing catalogue.');
      setTimeout(() => setSyncNotice(null), 4000);
    } finally {
      setIsClearingCatalog(false);
    }
  };

  const handleZeroAllStock = async () => {
    setIsZeroingStock(true);
    try {
      const res = await authFetch('/api/products/manage/zero-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        clearCachedApiResponse();
        try {
          const cached = localStorage.getItem('apex_persisted_products');
          if (cached) {
            const list = JSON.parse(cached);
            list.forEach((p: any) => {
              p.stock = 0;
              p.stockCount = 0;
              p.inStock = false;
              if (Array.isArray(p.variants)) p.variants.forEach((v: any) => { v.stock = 0; });
            });
            localStorage.setItem('apex_persisted_products', JSON.stringify(list));
          }
        } catch {}
        await onRefreshProducts(true);
        setIsZeroStockModalOpen(false);
        setSyncNotice('All products stock counts have been set to 0.');
        setTimeout(() => setSyncNotice(null), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSyncNotice(data.error || 'Failed to update products stock.');
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setSyncNotice('Error setting product stock to 0.');
      setTimeout(() => setSyncNotice(null), 4000);
    } finally {
      setIsZeroingStock(false);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: Order['status'],
    trackingNumber?: string,
    courierName?: string
  ) => {
    const updatedTimestamp = new Date().toISOString();
    // Optimistic UI update
    setOrders((prev) => {
      const updatedList = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? {
              ...o,
              status,
              ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber.trim() } : {}),
              ...(courierName !== undefined ? { courierName: courierName.trim() } : {}),
              updatedAt: updatedTimestamp,
            }
          : o
      );
      try {
        localStorage.setItem('apex_orders_cache', JSON.stringify(updatedList));
      } catch (e) {}
      return updatedList;
    });

    setSelectedOrderForDetail((prev) =>
      prev && (prev.id === orderId || prev.orderNumber === orderId)
        ? {
            ...prev,
            status,
            ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber.trim() } : {}),
            ...(courierName !== undefined ? { courierName: courierName.trim() } : {}),
            updatedAt: updatedTimestamp,
          }
        : prev
    );

    try {
      const payload: { status?: Order['status']; trackingNumber?: string; courierName?: string } = { status };
      if (trackingNumber !== undefined) {
        payload.trackingNumber = trackingNumber.trim();
      }
      if (courierName !== undefined) {
        payload.courierName = courierName.trim();
      }
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          setOrders((prev) => {
            const updated = prev.map((o) => (o.id === orderId || o.orderNumber === orderId ? data.order : o));
            try {
              localStorage.setItem('apex_orders_cache', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
          if (selectedOrderForDetail && (selectedOrderForDetail.id === orderId || selectedOrderForDetail.orderNumber === orderId)) {
            setSelectedOrderForDetail(data.order);
          }
        }
        setSyncNotice(`Order status updated to "${status}" successfully.`);
        setTimeout(() => setSyncNotice(null), 4000);
        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
      } else {
        const errData = await res.json().catch(() => ({}));
        setSyncNotice(errData.error || 'Failed to update order status.');
        setTimeout(() => setSyncNotice(null), 5000);
        await fetchOrders();
      }
    } catch (err: any) {
      console.error('Error updating order status:', err);
      setSyncNotice('Network error updating order status.');
      setTimeout(() => setSyncNotice(null), 5000);
      await fetchOrders();
    }
  };

  const handleDispatchLeopards = async (orderId: string) => {
    setIsDispatchingLeopards(true);
    try {
      const res = await authFetch(`/api/orders/${orderId}/dispatch-leopards`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setOrders((prev) => {
          const updated = prev.map((o) => (o.id === orderId || o.orderNumber === orderId ? data.order : o));
          try {
            localStorage.setItem('apex_orders_cache', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
        if (selectedOrderForDetail && (selectedOrderForDetail.id === orderId || selectedOrderForDetail.orderNumber === orderId)) {
          setSelectedOrderForDetail(data.order);
        }
        setTrackingInput(data.order.trackingNumber || '');
        setLeopardsNotice(`Dispatched with Leopards Courier! CN: ${data.order.trackingNumber}`);
        setTimeout(() => setLeopardsNotice(null), 6000);
        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
      }
    } catch (e) {
      console.error('Dispatch leopards error:', e);
    } finally {
      setIsDispatchingLeopards(false);
    }
  };

  const handleDeleteOrder = (order: Order, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setOrderToDelete(order);
  };

  const executeDeleteOrder = async (order: Order) => {
    setIsDeletingOrder(true);
    const targetId = order.id;
    const orderNum = order.orderNumber;

    // Optimistic delete
    setOrders((prev) => {
      const remaining = prev.filter((o) => o.id !== targetId && o.orderNumber !== orderNum);
      try {
        localStorage.setItem('apex_orders_cache', JSON.stringify(remaining));
      } catch (e) {}
      return remaining;
    });

    if (selectedOrderForDetail?.id === targetId || selectedOrderForDetail?.orderNumber === orderNum) {
      setSelectedOrderForDetail(null);
    }
    setOrderToDelete(null);

    try {
      const res = await authFetch(`/api/orders/${targetId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSyncNotice(`Order #${orderNum} deleted permanently.`);
        setTimeout(() => setSyncNotice(null), 4000);
        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
        window.dispatchEvent(new CustomEvent('apex:inventory_updated'));
      } else {
        const errData = await res.json().catch(() => ({}));
        setSyncNotice(errData.error || 'Failed to delete order from server.');
        setTimeout(() => setSyncNotice(null), 5000);
        await fetchOrders();
      }
    } catch (err: any) {
      console.error('Error deleting order:', err);
      setSyncNotice('Network error deleting order.');
      setTimeout(() => setSyncNotice(null), 5000);
      await fetchOrders();
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const handleStartEditOrderItems = (order: Order) => {
    setEditableOrderItems(JSON.parse(JSON.stringify(order.items || [])));
    setIsEditingOrderItems(true);
    setSwappingItemIndex(null);
    setIsAddingNewOrderItem(false);
    setOrderEditNotice(null);
  };

  const handleCancelEditOrderItems = () => {
    setIsEditingOrderItems(false);
    setSwappingItemIndex(null);
    setIsAddingNewOrderItem(false);
    setOrderEditNotice(null);
  };

  const handleUpdateEditableItem = (index: number, field: string, value: any) => {
    setEditableOrderItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveEditableItem = (index: number) => {
    setEditableOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSwapItemWithProduct = (index: number, newProd: Product, variantId?: string) => {
    const variant = variantId ? newProd.variants?.find((v) => v.id === variantId) : (newProd.variants && newProd.variants[0]);
    const price = variant?.price || newProd.price;
    setEditableOrderItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: newProd.id,
        name: newProd.name,
        price,
        image: newProd.image || updated[index].image,
        category: newProd.category,
        variantId: variant?.id,
        variantColor: variant?.color || variant?.name || 'Standard',
        variantName: variant?.name,
        warranty: newProd.warranty || '1 Year Official Warranty',
      };
      return updated;
    });
    setSwappingItemIndex(null);
    setSwapProductSearch('');
  };

  const handleAddNewItemToOrder = (newProd: Product, variantId?: string) => {
    const variant = variantId ? newProd.variants?.find((v) => v.id === variantId) : (newProd.variants && newProd.variants[0]);
    const price = variant?.price || newProd.price;
    const newItem = {
      productId: newProd.id,
      name: newProd.name,
      price,
      quantity: 1,
      image: newProd.image,
      category: newProd.category,
      variantId: variant?.id,
      variantColor: variant?.color || variant?.name || 'Standard',
      variantName: variant?.name,
      warranty: newProd.warranty || '1 Year Official Warranty',
    };
    setEditableOrderItems((prev) => [...prev, newItem]);
    setIsAddingNewOrderItem(false);
    setSwapProductSearch('');
  };

  const handleSaveOrderItems = async () => {
    if (!selectedOrderForDetail) return;
    if (editableOrderItems.length === 0) {
      setOrderEditNotice('An order must contain at least 1 component / item.');
      return;
    }

    setIsSavingOrderItems(true);
    setOrderEditNotice(null);

    const newSubtotal = editableOrderItems.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
    const shippingFee = selectedOrderForDetail.shippingFee || 0;
    const discount = selectedOrderForDetail.discount || 0;
    const newTotal = Math.max(0, newSubtotal + shippingFee - discount);

    const updatedOrder: Order = {
      ...selectedOrderForDetail,
      items: editableOrderItems,
      subtotal: newSubtotal,
      total: newTotal,
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await authFetch(`/api/orders/${selectedOrderForDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder),
      });

      if (res.ok) {
        const data = await res.json();
        const finalOrder = data.order || updatedOrder;
        setSelectedOrderForDetail(finalOrder);
        setOrders((prev) => prev.map((o) => (o.id === finalOrder.id ? finalOrder : o)));
        try {
          const cached = localStorage.getItem('apex_orders_cache');
          if (cached) {
            const list = JSON.parse(cached);
            const updatedList = list.map((o: any) => (o.id === finalOrder.id ? finalOrder : o));
            localStorage.setItem('apex_orders_cache', JSON.stringify(updatedList));
          }
        } catch (e) {}
        setIsEditingOrderItems(false);
        setOrderEditNotice(`Order #${finalOrder.orderNumber} items and pricing updated successfully!`);
        setTimeout(() => setOrderEditNotice(null), 4000);
        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
      } else {
        const err = await res.json().catch(() => ({}));
        setOrderEditNotice(err.error || 'Failed to update order components on server.');
      }
    } catch (e: any) {
      setOrderEditNotice(e.message || 'Network error updating order components.');
    } finally {
      setIsSavingOrderItems(false);
    }
  };

  const handleCopyOrderSummary = (order: Order) => {
    const itemsText = order.items
      .map((item, idx) => {
        let line = `${idx + 1}. ${item.name}\n   • Quantity: ${item.quantity}\n   • Color / Spec: ${item.variantColor || item.variantName || 'Standard'}\n   • Unit Price: ${formatPkr(item.price)}\n   • Item Total: ${formatPkr(item.price * item.quantity)}`;
        if (item.customRigBreakdown && item.customRigBreakdown.length > 0) {
          line += `\n   --- PC Hardware Components ---`;
          item.customRigBreakdown.forEach((part) => {
            line += `\n     - ${part.category}: ${part.productName} [Color/Opt: ${part.variantColor || 'Standard'}] @ ${formatPkr(part.price)}`;
          });
        }
        return line;
      })
      .join('\n\n');

    const receipt = `ApexRig Gaming PC Store - Order Invoice
===============================================
Order Number: #${order.orderNumber}
Date: ${new Date(order.createdAt).toLocaleString()}
Status: ${order.status}
Tracking Number: ${order.trackingNumber || 'Pending Courier Dispatch'}

CUSTOMER INFORMATION:
Name: ${order.customer.fullName}
Phone: ${order.customer.phone}
Email: ${order.customer.email || 'N/A'}
City: ${order.customer.city}
Shipping Address: ${order.customer.address}
Customer Note: ${order.customer.notes || 'None'}
Payment Method: ${order.paymentMethod}

ORDERED ITEMS & SPECIFICATIONS:
-----------------------------------------------
${itemsText}

-----------------------------------------------
FINANCIAL BREAKDOWN:
Items Subtotal: ${formatPkr(order.subtotal)}
Delivery / Shipping: ${order.shippingFee === 0 ? 'FREE' : formatPkr(order.shippingFee)}
Discount Applied: ${order.discount ? `- ${formatPkr(order.discount)}` : 'PKR 0'}
===============================================
GRAND TOTAL: ${formatPkr(order.total)}
===============================================`;

    navigator.clipboard.writeText(receipt);
    setOrderCopiedAlert(true);
    setTimeout(() => setOrderCopiedAlert(false), 2500);
  };

  const handleWhatsAppOrder = (order: Order) => {
    const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
    const itemsSummary = order.items
      .map(
        (it, i) =>
          `${i + 1}. ${it.quantity}x ${it.name} (${it.variantColor || 'Standard'}) - ${formatPkr(it.price * it.quantity)}`
      )
      .join('\n');
    const msg = encodeURIComponent(
      `Hello ${order.customer.fullName}!\n\nThank you for placing order #${order.orderNumber} with ApexRig PC Store.\n\nYour Order Items:\n${itemsSummary}\n\nSubtotal: ${formatPkr(order.subtotal)}\nGrand Total: ${formatPkr(order.total)}\nStatus: ${order.status}\n\nWe are currently processing your order.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  // Filtered orders in Admin
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const isERP = order.source === 'ERP';
      if (orderSourceTab === 'WEBSITE' && isERP) return false;
      if (orderSourceTab === 'ERP' && !isERP) return false;

      if (orderStatusFilter !== 'All' && order.status !== orderStatusFilter) {
        return false;
      }
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const matchNumber = order.orderNumber.toLowerCase().includes(q);
        const matchCustomer = order.customer.fullName.toLowerCase().includes(q);
        const matchPhone = order.customer.phone.toLowerCase().includes(q);
        const matchCity = order.customer.city.toLowerCase().includes(q);
        const matchItem = order.items.some(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.variantColor && it.variantColor.toLowerCase().includes(q)) ||
            (it.customRigBreakdown &&
              it.customRigBreakdown.some((p) => p.productName.toLowerCase().includes(q)))
        );
        return matchNumber || matchCustomer || matchPhone || matchCity || matchItem;
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderSearchQuery, orderSourceTab]);

  const orderStats = useMemo(() => {
    const sourceOrders = orders.filter(o => (orderSourceTab === 'ERP' ? o.source === 'ERP' : o.source !== 'ERP'));
    const totalRevenue = sourceOrders.reduce((sum, o) => sum + (o.status !== 'Cancelled' ? o.total : 0), 0);
    const pendingCount = sourceOrders.filter((o) => o.status === 'Pending').length;
    const activeCount = sourceOrders.filter((o) => ['Verified', 'Assembling', 'Testing', 'Shipped'].includes(o.status)).length;
    const deliveredCount = sourceOrders.filter((o) => o.status === 'Delivered').length;
    return { totalRevenue, pendingCount, activeCount, deliveredCount, count: sourceOrders.length };
  }, [orders, orderSourceTab]);

  // Filtered products in Admin table
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (
        productCategoryFilter !== 'All' &&
        p.category?.trim().toLowerCase() !== productCategoryFilter.trim().toLowerCase()
      ) {
        return false;
      }
      if (productSearch) {
        const q = productSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.ean?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.serialNumber?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, productCategoryFilter, productSearch]);

  // Selected category brand options helper
  const selectedCatObj = useMemo(() => {
    return categories.find((c) => c.name === formCategory);
  }, [categories, formCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-[99vw] h-[98vh] max-h-[98vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 dark:bg-[#0f172a]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-blue-600/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 font-bold">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold uppercase tracking-tight text-white">
                  APEX <span className="text-amber-400">ERP SUITE</span>
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                  <UserCheck className="w-3 h-3 text-blue-400" />
                  {isAdminLoggedIn
                    ? `${isOwner ? 'Owner' : 'Administrator'}: ${currentAdminUser?.fullName || 'Verifying access'}`
                    : 'Authentication Required'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sales, accounting, inventory and store administration in one workspace.
              </p>
            </div>
          </div>

          {/* Global Backend Omni Search Engine */}
          {isAdminLoggedIn && isOwner && (
            <div className="flex-1 max-w-xl mx-4 hidden md:block">
              <GlobalBackendSearch
                onNavigateToTab={(tab, subTab) => {
                  if (tab === 'operations') {
                    setAdminTab('operations');
                    if (subTab) setOperationsSubTab(subTab);
                  } else if (tab === 'erp') {
                    setAdminTab('erp');
                  } else if (tab === 'products') {
                    setAdminTab('products');
                  }
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {isAdminLoggedIn && (
              <button
                onClick={async () => {
                  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
                  localStorage.removeItem('apex_user');
                  localStorage.removeItem('apex_admin_user');
                  localStorage.removeItem('apex_token');
                  window.dispatchEvent(new Event('apex:logout'));
                  setIsOwnerUnlocked(false);
                  setIsAdminLoggedIn(false);
                  setCurrentAdminUser(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/50 bg-white/5 text-xs font-semibold text-slate-300 hover:text-red-400 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Not Logged In: Login Form */}
        {!isAdminLoggedIn ? (
          <div className="p-8 sm:p-12 flex items-center justify-center flex-1">
            <form onSubmit={handleAdminLogin} className="max-w-md w-full space-y-5 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 mx-auto flex items-center justify-center border border-blue-500/30">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Owner & Admin Authentication</h3>
                <p className="text-xs text-slate-400">
                  Sign in with your configured administrator account.<br />
                  Owner credentials are configured on the server.
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                  {loginError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Username / Email</label>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Password</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all active:scale-98"
              >
                Login to Backend
              </button>
            </form>
          </div>
        ) : (
          /* Admin Logged In Body */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <ERPSuite products={products} orders={orders} user={currentAdminUser} onRefreshProducts={onRefreshProducts}
                managementModule={['erp','operations'].includes(adminTab) ? undefined : adminTab}
                onManagementNavigate={(module) => { setAdminTab((module || 'erp') as typeof adminTab); if(module === 'users') fetchBackendUsers(); if(module === 'attributes') fetchCategorySchemas(); }}>
                {adminTab === 'products' && can(currentAdminUser, 'inventory', 'write') && <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => handleOpenAddProduct()} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold">+ Add product</button>
                  <button onClick={() => setIsCategoryModalOpen(true)} className="px-4 py-2 bg-slate-800 rounded-xl">+ New category</button>
                  <button onClick={() => setIsZeroStockModalOpen(true)} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-semibold transition-colors">Set all stock to 0</button>
                  {can(currentAdminUser, 'inventory', 'delete') && <button onClick={() => setIsClearCatalogModalOpen(true)} className="px-4 py-2 bg-red-500/10 text-red-300 rounded-xl">Clear catalog</button>}
                </div>}
                {adminTab === 'categories' && can(currentAdminUser, 'inventory', 'write') && <button onClick={() => setIsCategoryModalOpen(true)} className="mb-4 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold">+ Create category</button>}
            {/* TAB CONTENT: PRODUCTS */}
            {can(currentAdminUser, 'inventory') && adminTab === 'products' && (
              <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                {/* Search & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search hardware by name, brand, category..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Filter Category:</span>
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="bg-slate-900 border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs outline-none"
                    >
                      <option value="All">All Categories ({products.length})</option>
                      {categories.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.icon ? `${c.icon} ` : ''}{c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-16 text-center border-2 border-dashed border-white/10 rounded-3xl space-y-4">
                    <Package className="w-12 h-12 text-slate-600 mx-auto" />
                    <div>
                      <h4 className="text-base font-bold text-white">No Products Found</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Create custom categories and products to organize your store inventory.
                      </p>
                    </div>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => handleOpenAddProduct()}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
                      >
                        + Add Product
                      </button>
                      <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs"
                      >
                        + Create Category
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/10 text-xs bg-white/5">
                    <div className="p-3 bg-white/5 font-bold text-slate-400 grid grid-cols-12 gap-2 uppercase tracking-wider">
                      <div className="col-span-4">Product Name & Category</div>
                      <div className="col-span-2">Brand & Socket</div>
                      <div className="col-span-2">Price (PKR)</div>
                      <div className="col-span-2">Variants / Stock</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {filteredProducts.map((prod) => (
                      <div key={prod.id} className="p-3.5 grid grid-cols-12 gap-2 items-center hover:bg-white/[0.04] transition-colors">
                        <div className="col-span-4 flex items-center gap-3">
                          <img
                            src={prod.image || getProductFallbackImage(prod.category, prod.name, prod.brand)}
                            alt={prod.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0 border border-white/10"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => handleProductImageError(e, prod.category, prod.name, prod.brand)}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">{prod.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-blue-400 font-semibold">{prod.category}</span>
                              {prod.sku && (
                                <span className="inline-flex items-center font-mono text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold tracking-wide" title="Product SKU Identifier">
                                  SKU: {prod.sku}
                                </span>
                              )}
                              {(prod.ean || prod.barcode) && (
                                <span className="inline-flex items-center font-mono text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-semibold tracking-wide" title="Retail EAN / Barcode">
                                  EAN: {prod.ean || prod.barcode}
                                </span>
                              )}
                              {prod.serialNumber && (
                                <span className="inline-flex items-center font-mono text-[9px] bg-blue-500/10 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-semibold tracking-wide" title="Serial Number">
                                  S/N: {prod.serialNumber}
                                </span>
                              )}
                              {prod.costPrice !== undefined && prod.costPrice > 0 && (
                                <span className="inline-flex items-center font-mono text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold tracking-wide" title="Landed Cost">
                                  Cost: {formatPkr(prod.costPrice)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <span className="text-slate-300 block">{prod.brand}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {prod.specifications?.socket || prod.specifications?.ramType || '-'}
                          </span>
                        </div>

                        <div className="col-span-2">
                          {quickEditingPriceId === prod.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={quickPriceVal}
                                onChange={(e) => setQuickPriceVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveQuickPrice(prod);
                                  if (e.key === 'Escape') setQuickEditingPriceId(null);
                                }}
                                autoFocus
                                className="w-24 bg-slate-950 border border-amber-500/60 rounded px-1.5 py-0.5 text-xs text-amber-300 font-mono font-bold outline-none focus:ring-1 focus:ring-amber-400"
                                placeholder="Price"
                              />
                              <button
                                onClick={() => handleSaveQuickPrice(prod)}
                                disabled={isSavingQuickPrice}
                                className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold cursor-pointer"
                                title="Save Price Instantly (Enter)"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setQuickEditingPriceId(null)}
                                className="p-1 rounded bg-white/5 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                title="Cancel (Esc)"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group/price">
                              <div>
                                <span className="font-mono font-bold text-blue-400">
                                  {formatPkr(prod.price)}
                                </span>
                                {prod.originalPrice && prod.originalPrice > prod.price && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500 line-through font-mono">
                                      {formatPkr(prod.originalPrice)}
                                    </span>
                                    <span className="text-[9px] bg-red-600/80 text-white font-bold px-1 rounded">
                                      -{Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleStartQuickPriceEdit(prod)}
                                className="opacity-0 group-hover/price:opacity-100 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-opacity cursor-pointer"
                                title="Click to instantly change price"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="col-span-2">
                          {prod.isVariable ? (
                            <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                              {prod.variants?.length || 0} Variants ({prod.stockCount} total)
                            </span>
                          ) : (
                            <span className="text-slate-300">{prod.stockCount} units</span>
                          )}
                        </div>

                        <div className="col-span-2 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setLabelModalProduct(prod)}
                            className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:text-white"
                            title="Generate & Print SKU Barcode Label"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/20"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: CATEGORIES & BRAND SUBCATEGORIES */}
            {can(currentAdminUser, 'inventory') && adminTab === 'categories' && (
              <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                {syncNotice && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {syncNotice}
                    </span>
                    <button onClick={() => setSyncNotice(null)} className="text-emerald-400 hover:text-emerald-200">
                      ✕
                    </button>
                  </div>
                )}

                {/* Intro Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 via-slate-900 to-indigo-900/30 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-400" />
                      <h3 className="text-base font-bold text-white">Store Categories & Brand Subcategories</h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Upload category cover images, edit existing categories, and manage brand subcategories. Any category or edit appears across the entire store!
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleOpenAddCategory}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Create New Category</span>
                    </button>
                  </div>
                </div>

                {/* Categories Grid / Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => {
                    const count = products.filter((p) => p.category === cat.name).length;
                    return (
                      <div
                        key={cat.id || cat.name}
                        className="rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all flex flex-col justify-between group overflow-hidden"
                      >
                        {/* Top Category Image & Header */}
                        <div className="relative h-28 w-full bg-slate-900 overflow-hidden border-b border-white/5">
                          {cat.image || cat.bannerImage ? (
                            <img
                              src={cat.image || cat.bannerImage}
                              alt={cat.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                              <span className="text-4xl opacity-50">{cat.icon || '📦'}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent" />

                          {/* Top Badges & Actions */}
                          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-blue-300 border border-blue-500/30 flex items-center gap-1">
                              <span>{cat.icon || '📦'}</span>
                              <span>{count} Products</span>
                            </span>

                            <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-lg border border-white/10">
                              <button
                                onClick={() => handleOpenEditCategory(cat)}
                                className="p-1 text-slate-300 hover:text-blue-400 transition-colors"
                                title="Edit Category & Image"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {cat.isCustom && (
                                <button
                                  onClick={() => handleDeleteCategory(cat)}
                                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                                  title="Delete Category"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Category Title */}
                          <div className="absolute bottom-2.5 left-3 right-3">
                            <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                              <span>{cat.name}</span>
                              {cat.isCustom && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 border border-blue-500/40">
                                  Custom
                                </span>
                              )}
                            </h4>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            {cat.description ? (
                              <p className="text-xs text-slate-300 line-clamp-2">{cat.description}</p>
                            ) : (
                              <p className="text-xs text-slate-500 italic">No description provided</p>
                            )}

                            {/* Brand Subcategories */}
                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-blue-400" />
                                <span>Brand Subcategories:</span>
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {cat.brands && cat.brands.length > 0 ? (
                                  cat.brands.map((b) => (
                                    <span
                                      key={b}
                                      className="px-2 py-0.5 rounded-lg bg-slate-900 border border-white/10 text-slate-300 text-[10px] font-semibold"
                                    >
                                      {b}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">No specific brands</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action: Add Product to This Category */}
                          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                            <button
                              onClick={() => {
                                setProductCategoryFilter(cat.name);
                                setAdminTab('products');
                              }}
                              className="text-[11px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                            >
                              <span>View {count} products</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditCategory(cat)}
                                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleOpenAddProduct(cat.name as ProductCategory, cat.brands?.[0])}
                                className="px-3 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1 border border-blue-500/30"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Product</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: ATTRIBUTE EDITOR & HARDWARE SPECIFICATIONS SCHEMA */}
            {can(currentAdminUser, 'inventory') && adminTab === 'attributes' && (
              <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <AttributeEditor
                  categories={categories}
                  onSchemaUpdated={() => {
                    fetchCategorySchemas();
                  }}
                />
              </div>
            )}

            {/* TAB CONTENT: BOTTLENECK CALCULATOR GAMES DATABASE */}
            {can(currentAdminUser, 'inventory') && adminTab === 'games' && (
              <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <AdminGamesManager />
              </div>
            )}

            {/* TAB CONTENT: ORDERS */}
            {can(currentAdminUser, 'orders') && adminTab === 'orders' && (
              <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                {/* Orders Source Tabs */}
                <div className="flex bg-slate-900/50 p-1.5 rounded-xl border border-white/5 w-fit">
                  <button
                    onClick={() => setOrderSourceTab('WEBSITE')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${orderSourceTab === 'WEBSITE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Website Orders
                  </button>
                  <button
                    onClick={() => setOrderSourceTab('ERP')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${orderSourceTab === 'ERP' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    ERP Custom Orders
                  </button>
                </div>

                {/* Orders Overview & Stats Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
                    <p className="text-2xl font-black text-white font-mono">{orderStats.count}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending Verification</span>
                    <p className="text-2xl font-black text-amber-300 font-mono">{orderStats.pendingCount}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">In Assembly / Transit</span>
                    <p className="text-2xl font-black text-blue-300 font-mono">{orderStats.activeCount}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Total Sales Volume</span>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{formatPkr(orderStats.totalRevenue)}</p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search order #, customer, phone, item..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full pl-9.5 pr-4 py-2 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-400 font-bold">Status:</span>
                    </div>
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="bg-slate-900 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none flex-1 sm:flex-none"
                    >
                      <option value="All">All Statuses ({orders.length})</option>
                      <option value="Pending">Pending Verification</option>
                      <option value="Verified">Verified</option>
                      <option value="Assembling">Assembling</option>
                      <option value="Testing">Testing / Benchmark</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>

                    <button
                      onClick={fetchOrders}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Refresh Orders"
                    >
                      <span>🔄</span>
                    </button>
                  </div>
                </div>

                {/* Copied Alert Toast */}
                {orderCopiedAlert && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Order invoice details copied to clipboard! Ready to paste into WhatsApp / Email.</span>
                  </div>
                )}

                {/* Orders List with Clickable Action */}
                {filteredOrders.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs bg-white/5 rounded-2xl border border-white/10">
                    <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-400">No matching orders found</p>
                    <p className="text-slate-500 mt-1">
                      {orderSearchQuery || orderStatusFilter !== 'All'
                        ? 'Try adjusting your search query or filter.'
                        : 'New customer orders and custom PC builder checkouts will arrive here.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => {
                      const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                        Pending: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
                        Verified: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
                        Assembling: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
                        Testing: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
                        Shipped: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
                        Delivered: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
                        Cancelled: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30' },
                      };
                      const statusBadge = statusColors[order.status] || {
                        bg: 'bg-slate-800',
                        text: 'text-slate-300',
                        border: 'border-slate-700',
                      };

                      return (
                        <div
                          key={order.id}
                          className="p-5 rounded-2xl bg-white/5 hover:bg-white/[0.07] border border-white/10 hover:border-blue-500/40 transition-all duration-200 space-y-4 group cursor-pointer shadow-lg"
                          onClick={() => {
                            setSelectedOrderForDetail(order);
                            setTrackingInput(order.trackingNumber || '');
                            const isPc = hasPcBuildInOrder(order);
                            const isPickup = order.paymentMethod.toLowerCase().includes('pickup');
                            setCourierInput(
                              order.courierName ||
                                (isPc
                                  ? 'Daewoo Express Cargo'
                                  : isPickup
                                  ? 'Store Pickup (No Courier Tracking)'
                                  : 'Leopards Courier')
                            );
                          }}
                        >
                          {/* Order Header */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                                <Receipt className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-blue-400 font-mono tracking-wider">
                                    ORDER #{order.orderNumber}
                                  </span>
                                  <span
                                    className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                                  >
                                    {order.status}
                                  </span>
                                  {order.paymentScreenshot && (
                                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                                      📷 Receipt Attached
                                    </span>
                                  )}
                                  {order.trackingNumber && (
                                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-full border border-cyan-800">
                                      Track: {order.trackingNumber}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-bold text-white mt-0.5 flex items-center gap-2">
                                  <span>{order.customer.fullName}</span>
                                  <span className="text-xs text-slate-400 font-normal">
                                    • {order.customer.city}
                                  </span>
                                </h4>
                                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                  <span>📞 {order.customer.phone}</span>
                                  <span>🕒 {new Date(order.createdAt).toLocaleString()}</span>
                                  <span>💳 {order.paymentMethod}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right Side: Total & Actions */}
                            <div
                              className="flex flex-wrap items-center gap-3 self-end lg:self-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                  Grand Total
                                </span>
                                <span className="text-xl font-black text-blue-400 font-mono">
                                  {formatPkr(order.total)}
                                </span>
                              </div>

                              <select
                                value={order.status}
                                onChange={(e: any) => handleUpdateOrderStatus(order.id, e.target.value)}
                                className="bg-slate-900 border border-white/15 text-white rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                              >
                                <option value="Pending">Pending Verification</option>
                                <option value="Verified">Verified by Phone</option>
                                <option value="Assembling">Assembling Rig</option>
                                <option value="Testing">Thermal Benchmarking</option>
                                <option value="Shipped">Shipped via Courier</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>

                              {/* CLICKABLE ACTION: INSPECT ORDER DETAILS */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForDetail(order);
                                  setTrackingInput(order.trackingNumber || '');
                                  const isPc = hasPcBuildInOrder(order);
                                  const isPickup = order.paymentMethod.toLowerCase().includes('pickup');
                                  setCourierInput(
                                    order.courierName ||
                                      (isPc
                                        ? 'Daewoo Express Cargo'
                                        : isPickup
                                        ? 'Store Pickup (No Courier Tracking)'
                                        : 'Leopards Courier')
                                  );
                                }}
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect Order →</span>
                              </button>

                              {/* DELETE ORDER BUTTON */}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteOrder(order, e)}
                                title="Delete Order Permanently"
                                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 transition-all active:scale-95 shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Preview of Ordered Items (Name, Quantity, Color, Price) */}
                          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1.5">
                              <span>Ordered Items ({order.items.length})</span>
                              <span>Item Total</span>
                            </div>

                            <div className="space-y-1.5">
                              {order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs text-slate-300 gap-4"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-blue-400 font-bold shrink-0">
                                      {item.quantity}x
                                    </span>
                                    <span className="font-semibold text-white truncate">
                                      {item.name}
                                    </span>
                                    {item.variantColor && (
                                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 text-[10px] font-bold shrink-0">
                                        Color: {item.variantColor}
                                      </span>
                                    )}
                                    {item.isCustomRig && (
                                      <span className="px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold shrink-0">
                                        Custom PC Build
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-mono font-bold text-slate-200">
                                      {formatPkr(item.price * item.quantity)}
                                    </span>
                                    {item.quantity > 1 && (
                                      <span className="text-[10px] text-slate-400 block">
                                        ({formatPkr(item.price)} each)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Quick Bottom Bar with Address and Action Hints */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 pt-1">
                            <div className="truncate">
                              <span className="font-bold text-slate-300">Deliver to: </span>
                              <span>{order.customer.address}, {order.customer.city}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWhatsAppOrder(order);
                                }}
                                className="text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1 hover:underline"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WhatsApp Customer</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyOrderSummary(order);
                                }}
                                className="text-blue-400 hover:text-blue-300 font-bold text-xs flex items-center gap-1 hover:underline"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy Details</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: SETTINGS */}
            {can(currentAdminUser, 'settings') && adminTab === 'settings' && (
              <div className="p-6 overflow-y-auto flex-1 max-w-3xl space-y-6 custom-scrollbar">
                {saveSuccessMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{saveSuccessMessage}</span>
                  </div>
                )}

                {/* Section 1: Admin & Owner Profile */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        Administrator & Store Owner Profile
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Update the official Owner and Administrator name displayed across the system, receipts, and WhatsApp communications.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>Owner / Admin Full Name</span>
                      </label>
                      <input
                        type="text"
                        value={settingsForm.ownerName || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, ownerName: e.target.value })}
                        placeholder="e.g. Hammad Ur Rehman"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Changes the store owner/admin identity name.
                      </span>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1.5">
                        Owner Title / Designation
                      </label>
                      <input
                        type="text"
                        value={settingsForm.ownerTitle || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, ownerTitle: e.target.value })}
                        placeholder="e.g. Store Owner & Lead Hardware Architect"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1.5">
                        Admin Username / Handle
                      </label>
                      <input
                        type="text"
                        value={settingsForm.adminUsername || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, adminUsername: e.target.value })}
                        placeholder="e.g. hammadurrehman"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1.5">
                        Admin Email Address
                      </label>
                      <input
                        type="email"
                        value={settingsForm.email || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                        placeholder="e.g. bhaiisheeda@gmail.com"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Store Branding & Contact */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        Store Branding & Pakistan Location
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Configure public store name, WhatsApp integration, and physical outlet location.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1">Store Name</label>
                      <input
                        type="text"
                        value={settingsForm.storeName || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1">Store Tagline / Slogan</label>
                      <input
                        type="text"
                        value={settingsForm.tagline || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                        placeholder="Pakistan's Premier Custom PC Builder & Hardware Hub"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1">WhatsApp Plugin Number</label>
                      <input
                        type="text"
                        value={settingsForm.whatsappNumber || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })}
                        placeholder="+447597030688"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1">Helpline Phone</label>
                      <input
                        type="text"
                        value={settingsForm.phone || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                        placeholder="+447597030688"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 uppercase block mb-1">Shop Address</label>
                      <input
                        type="text"
                        value={settingsForm.address || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                        placeholder="Shop #G-14, Ground Floor, Hafeez Centre, Main Boulevard Gulberg III"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1">Free Shipping Order Threshold (PKR)</label>
                      <input
                        type="number"
                        value={settingsForm.freeShippingThreshold || 50000}
                        onChange={(e) => setSettingsForm({ ...settingsForm, freeShippingThreshold: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 uppercase block mb-1">Standard Delivery Fee (PKR)</label>
                      <input
                        type="number"
                        value={settingsForm.defaultShippingFee || 1500}
                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultShippingFee: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Bank Transfer Details */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        Direct Bank Transfer (IBFT) Details
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Pakistani bank account details provided to customers for online order payments.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1 uppercase">Bank Name</label>
                      <input
                        type="text"
                        value={settingsForm.bankDetails?.bankName || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            bankDetails: {
                              bankName: e.target.value,
                              accountTitle: settingsForm.bankDetails?.accountTitle || '',
                              accountNumber: settingsForm.bankDetails?.accountNumber || '',
                              iban: settingsForm.bankDetails?.iban || '',
                            },
                          })
                        }
                        placeholder="Meezan Bank Ltd. / Bank Alfalah"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1 uppercase">Account Title</label>
                      <input
                        type="text"
                        value={settingsForm.bankDetails?.accountTitle || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            bankDetails: {
                              bankName: settingsForm.bankDetails?.bankName || '',
                              accountTitle: e.target.value,
                              accountNumber: settingsForm.bankDetails?.accountNumber || '',
                              iban: settingsForm.bankDetails?.iban || '',
                            },
                          })
                        }
                        placeholder="Apex Hardware PK"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1 uppercase">Account Number / Raast ID</label>
                      <input
                        type="text"
                        value={settingsForm.bankDetails?.accountNumber || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            bankDetails: {
                              bankName: settingsForm.bankDetails?.bankName || '',
                              accountTitle: settingsForm.bankDetails?.accountTitle || '',
                              accountNumber: e.target.value,
                              iban: settingsForm.bankDetails?.iban || '',
                            },
                          })
                        }
                        placeholder="01020304050607"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1 uppercase">IBAN Number</label>
                      <input
                        type="text"
                        value={settingsForm.bankDetails?.iban || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            bankDetails: {
                              bankName: settingsForm.bankDetails?.bankName || '',
                              accountTitle: settingsForm.bankDetails?.accountTitle || '',
                              accountNumber: settingsForm.bankDetails?.accountNumber || '',
                              iban: e.target.value,
                            },
                          })
                        }
                        placeholder="PK45MEZN0001020304050607"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      onUpdateSettings(settingsForm);
                      setSaveSuccessMessage('Store settings & Admin profile saved successfully!');
                      setTimeout(() => setSaveSuccessMessage(null), 4000);
                    }}
                    className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-98 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Store Settings & Admin Identity</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: ADMINS & USERS (OWNER-ONLY CONTROL) */}
            {isOwner && adminTab === 'users' && (
              <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
                {/* Success Notification Banner */}
                {userActionSuccess && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{userActionSuccess}</span>
                  </div>
                )}

                {/* Owner Authority Notice Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xl shrink-0 font-bold">
                      👑
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        Owner Authority & Access Control
                        <span className="px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-300 text-[10px] font-mono">
                          sheedatalli
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Store Administrators can only be created by the owner in this backend. Regular users must create an account on the website to sign in.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenAddUser}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all shrink-0 active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Admin</span>
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search accounts by name, username, email, phone..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchBackendUsers()}
                      disabled={isLoadingUsers}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      title="Refresh accounts list from server"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-blue-400' : 'text-slate-300'}`} />
                      <span>{isLoadingUsers ? 'Refreshing...' : 'Refresh List'}</span>
                    </button>

                    <span className="text-slate-400">Filter Role:</span>
                    <select
                      value={userRoleFilter}
                      onChange={(e: any) => setUserRoleFilter(e.target.value)}
                      className="bg-slate-900 border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs outline-none"
                    >
                      <option value="all">All Accounts ({backendUsers.length})</option>
                      <option value="admin">
                        Admins ({backendUsers.filter((u) => u.role === 'admin').length})
                      </option>
                      <option value="customer">
                        Customers ({backendUsers.filter((u) => u.role !== 'admin').length})
                      </option>
                    </select>
                  </div>
                </div>

                {/* Users Table */}
                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3.5">User Identity</th>
                          <th className="p-3.5">Username & Email</th>
                          <th className="p-3.5">Contact & City</th>
                          <th className="p-3.5">System Role</th>
                          <th className="p-3.5">Registered</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {backendUsers
                          .filter((u) => {
                            if (userRoleFilter === 'admin' && u.role !== 'admin') return false;
                            if (userRoleFilter === 'customer' && u.role === 'admin') return false;
                            if (userSearchQuery.trim()) {
                              const q = userSearchQuery.toLowerCase();
                              return (
                                u.fullName.toLowerCase().includes(q) ||
                                u.email.toLowerCase().includes(q) ||
                                (u.username && u.username.toLowerCase().includes(q)) ||
                                (u.phone && u.phone.includes(q)) ||
                                (u.city && u.city.toLowerCase().includes(q))
                              );
                            }
                            return true;
                          })
                          .map((usr) => {
                            const isOwnerAccount = usr.isOwner || usr.username === 'sheedatalli';
                            return (
                              <tr key={usr.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-3.5">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isOwnerAccount
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : usr.role === 'admin'
                                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                          : 'bg-white/10 text-slate-300 border border-white/10'
                                      }`}
                                    >
                                      {isOwnerAccount ? '👑' : usr.role === 'admin' ? '🛡️' : '👤'}
                                    </div>
                                    <div>
                                      <span className="font-bold text-white block">{usr.fullName}</span>
                                      <span className="text-[10px] font-mono text-slate-400">{usr.id}</span>
                                    </div>
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  <div className="space-y-0.5">
                                    {usr.username && (
                                      <span className="font-mono text-blue-300 font-bold block text-[11px]">
                                        @{usr.username}
                                      </span>
                                    )}
                                    <span className="font-mono text-slate-300 block text-[11px]">{usr.email}</span>
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-slate-300 block">{usr.phone || 'N/A'}</span>
                                    <span className="text-slate-400 block text-[11px]">{usr.city || 'Pakistan'}</span>
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  {isOwnerAccount ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                                      <span>👑 Primary Owner</span>
                                    </span>
                                  ) : usr.role === 'admin' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
                                      <ShieldCheck className="w-3 h-3 text-blue-400" />
                                      <span>Store Admin</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-white/10 text-[10px] font-semibold">
                                      <span>Website Customer</span>
                                    </span>
                                  )}
                                </td>

                                <td className="p-3.5 text-[11px] text-slate-400 font-mono">
                                  {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString() : 'Active'}
                                </td>

                                <td className="p-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {!isOwnerAccount && (
                                      <button
                                        onClick={() => handleToggleUserRole(usr)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                          usr.role === 'admin'
                                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                            : 'bg-blue-600/10 border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white'
                                        }`}
                                        title={usr.role === 'admin' ? 'Demote to Customer' : 'Promote to Store Admin'}
                                      >
                                        {usr.role === 'admin' ? 'Demote' : 'Make Admin'}
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleOpenEditUser(usr)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white"
                                      title="Edit user details"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>

                                    {!isOwnerAccount && (
                                      <button
                                        onClick={() => handleDeleteUserAccount(usr)}
                                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/20"
                                        title="Delete account from database"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
              </ERPSuite>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT CATEGORY */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-[#0f172a] border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 text-slate-100 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">
                    {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Hardware Category'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {catError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                  {catError}
                </div>
              )}

              <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gaming Chairs, VR Headsets, Custom Cables..."
                    value={catNameInput}
                    onChange={(e) => setCatNameInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="font-bold text-slate-300 uppercase block mb-1">Icon / Emoji</label>
                    <input
                      type="text"
                      placeholder="💺"
                      value={catIconInput}
                      onChange={(e) => setCatIconInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-center text-lg focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="font-bold text-slate-300 uppercase block mb-1">Short Description</label>
                    <input
                      type="text"
                      placeholder="Ergonomic high-density gaming chairs"
                      value={catDescInput}
                      onChange={(e) => setCatDescInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Category Image Upload & Preview */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 uppercase tracking-wider block flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Category Card Image</span>
                    </span>
                    {catImageInput && (
                      <button
                        type="button"
                        onClick={() => setCatImageInput('')}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Thumbnail Preview */}
                    <div className="w-20 h-20 rounded-xl bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 relative group">
                      {catImageInput ? (
                        <>
                          <img
                            src={catImageInput}
                            alt="Category preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              openImageCropper(
                                catImageInput,
                                'Adjust & Crop Category Image',
                                '16:9',
                                (url) => setCatImageInput(url)
                              )
                            }
                            title="Crop & Frame Image"
                            className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-blue-400 text-[10px] font-bold transition-opacity cursor-pointer"
                          >
                            <Crop className="w-4 h-4 mb-0.5" />
                            <span>Crop</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-2xl text-slate-600">{catIconInput || '📦'}</span>
                      )}
                      {isUploadingCatImage && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                        </div>
                      )}
                    </div>

                    {/* Upload Controls */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={catFileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden="true"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              handleUploadFile(
                                f,
                                (url) => setCatImageInput(url),
                                setIsUploadingCatImage,
                                { title: 'Crop & Frame Category Image', aspectRatio: '16:9' }
                              );
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => catFileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openImageCropper(
                              catImageInput,
                              'Adjust & Crop Category Image',
                              '16:9',
                              (url) => setCatImageInput(url)
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 transition-all cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5 text-blue-400" />
                          <span>Crop & Frame</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Or paste image URL (https://...)"
                        value={catImageInput}
                        onChange={(e) => setCatImageInput(e.target.value)}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">
                    Brand Subcategories (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Secretlab, Cougar, Razer, Corsair"
                    value={catBrandsInput}
                    onChange={(e) => setCatBrandsInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    These brand subcategories will appear as clickable filter chips in the catalog and product editor.
                  </span>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setEditingCategory(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  >
                    {editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT USER OR ADMIN (OWNER ONLY) */}
        {isUserModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-[#0f172a] border border-blue-500/30 rounded-3xl max-w-lg w-full p-6 space-y-4 text-slate-100 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                    🛡️
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {editingUser ? `Edit Account: ${editingUser.fullName}` : 'Provision New Store Admin / User'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Owner-only backend privilege management
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {userModalError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                  {userModalError}
                </div>
              )}

              <form onSubmit={handleSaveUserModal} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hammad Ur Rehman"
                    value={userFormFullName}
                    onChange={(e) => setUserFormFullName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@apexrig.pk"
                      value={userFormEmail}
                      onChange={(e) => setUserFormEmail(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1">Username (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. hammad_admin"
                      value={userFormUsername}
                      onChange={(e) => setUserFormUsername(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">
                    {editingUser ? 'New Password (Leave blank to keep existing)' : 'Account Password *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder="••••••••"
                    value={userFormPassword}
                    onChange={(e) => setUserFormPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1">Phone / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="+923001234567"
                      value={userFormPhone}
                      onChange={(e) => setUserFormPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1">City</label>
                    <input
                      type="text"
                      placeholder="Lahore / Karachi / Islamabad"
                      value={userFormCity}
                      onChange={(e) => setUserFormCity(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">Account Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUserFormRole('admin')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        userFormRole === 'admin'
                          ? 'bg-blue-600/30 border-blue-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <div>
                        <span className="block text-xs">Store Admin</span>
                        <span className="text-[10px] text-slate-400">Full backend dashboard access</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserFormRole('customer')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        userFormRole === 'customer'
                          ? 'bg-blue-600/30 border-blue-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <User className="w-4 h-4 text-slate-300" />
                      <div>
                        <span className="block text-xs">Customer</span>
                        <span className="text-[10px] text-slate-400">Order tracking & website account</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserModalOpen(false);
                      setEditingUser(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/25"
                  >
                    {editingUser ? 'Save User Changes' : 'Provision Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRM DELETE USER (OWNER SAFEGUARD) */}
        {userToDelete && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-[#0f172a] border border-red-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 text-slate-100 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center text-lg font-bold shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete User Account?</h3>
                  <p className="text-[11px] text-slate-400">This action will remove the user permanently from the database.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-bold text-white">{userToDelete.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-slate-300">{userToDelete.email}</span>
                </div>
                {userToDelete.username && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Username:</span>
                    <span className="font-mono text-blue-300">@{userToDelete.username}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Role:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    userToDelete.role === 'admin' ? 'bg-blue-600/30 text-blue-300' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {userToDelete.role === 'admin' ? 'Store Admin' : 'Website Customer'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-red-400/90 leading-relaxed">
                Are you sure you want to delete this account? All associated login sessions and privileges will be terminated immediately.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeletingUser}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeleteUser}
                  disabled={isDeletingUser}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-98 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center gap-1.5 transition-all"
                >
                  {isDeletingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT PRODUCT */}
        {(isAddingNew || editingProduct) && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="bg-[#0f172a] border border-white/10 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">
                    {isAddingNew ? '+ Add New Hardware Product' : `Edit: ${editingProduct?.name}`}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingProduct(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs custom-scrollbar">
                {/* SKU Code & EAN Barcode Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* SKU Identifier */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-amber-300 uppercase flex items-center gap-1.5 text-[11px] tracking-wider">
                        <Tag className="w-3.5 h-3.5" />
                        <span>SKU Identifier *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newSku = generateProductSKU(
                            { name: formName, brand: formBrand, category: formCategory },
                            products
                          );
                          setFormSku(newSku);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        title="Auto-generate SKU from Category, Brand & Model"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto SKU</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formSku || ''}
                      onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g. GPU-ASUS-RTX4070-12G"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-amber-300 font-mono text-xs uppercase font-bold tracking-wider outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Product SKU for catalog lookup and inventory reports.
                    </p>
                  </div>

                  {/* EAN-13 / Retail Barcode */}
                  <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-purple-300 uppercase flex items-center gap-1.5 text-[11px] tracking-wider">
                        <Barcode className="w-3.5 h-3.5" />
                        <span>EAN / Barcode</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const random12 = '883' + Math.floor(100000000 + Math.random() * 900000000).toString();
                          let sum = 0;
                          for (let i = 0; i < 12; i++) {
                            sum += parseInt(random12[i], 10) * (i % 2 === 0 ? 1 : 3);
                          }
                          const check = (10 - (sum % 10)) % 10;
                          setFormEan(random12 + check);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        title="Generate Barcode"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Gen Barcode</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formEan || ''}
                      onChange={(e) => setFormEan(e.target.value.trim())}
                      placeholder="e.g. 883921049281 (optional)"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-purple-300 font-mono text-xs uppercase font-bold tracking-wider outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Retail barcode for scanning and lookup.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1">Product Title *</label>
                    <input
                      type="text"
                      value={formName || ''}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      placeholder="e.g. ASUS TUF Gaming GeForce RTX 4070 Super 12GB"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1">Brand *</label>
                    <input
                      type="text"
                      value={formBrand || ''}
                      onChange={(e) => setFormBrand(e.target.value)}
                      required
                      placeholder="e.g. ASUS, MSI, Corsair, AMD"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    {/* Brand quick chips from selected category */}
                    {selectedCatObj?.brands && selectedCatObj.brands.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                        <span className="text-[10px] text-slate-500 font-semibold">Suggested:</span>
                        {selectedCatObj.brands.map((b) => (
                          <button
                            type="button"
                            key={b}
                            onClick={() => setFormBrand(b)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-blue-600/30 text-[10px] text-slate-300 hover:text-blue-300 border border-white/10 transition-colors"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-300 uppercase">Category *</label>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        + New
                      </button>
                    </div>
                    <select
                      value={formCategory}
                      onChange={(e: any) => setFormCategory(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.icon ? `${c.icon} ` : ''}{c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1 flex items-center justify-between">
                      <span>Price (PKR) *</span>
                      <span className="text-[10px] text-blue-400 font-semibold normal-case">Retail</span>
                    </label>
                    <input
                      type="number"
                      value={formPrice || ''}
                      onChange={(e) => setFormPrice(e.target.value ? Number(e.target.value) : 0)}
                      required
                      min={0}
                      placeholder="e.g. 195000"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 uppercase block mb-1 flex items-center justify-between">
                      <span>Sale (PKR)</span>
                      <span className="text-[10px] text-amber-400 font-semibold normal-case">Discounted</span>
                    </label>
                    <input
                      type="number"
                      value={formOriginalPrice || ''}
                      onChange={(e) => setFormOriginalPrice(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="e.g. 185000 (optional)"
                      min={0}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                    />
                  </div>
                </div>

                {/* Website Purchase Availability */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-white block">Stock Status:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormInStock(true)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                        formInStock
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      In Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormInStock(false)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                        !formInStock
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Out of Stock
                    </button>
                  </div>
                </div>

                {/* Live Pricing Breakdown / Website Preview */}
                {formOriginalPrice && formOriginalPrice > 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">Active On Website:</span>
                      <span className="text-white font-mono font-bold text-sm">
                        {formatPkr(Math.min(formPrice, formOriginalPrice))}
                      </span>
                      <span className="text-slate-400 line-through font-mono text-xs">
                        {formatPkr(Math.max(formPrice, formOriginalPrice))}
                      </span>
                      {Math.max(formPrice, formOriginalPrice) > Math.min(formPrice, formOriginalPrice) && (
                        <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                          -{Math.round(((Math.max(formPrice, formOriginalPrice) - Math.min(formPrice, formOriginalPrice)) / Math.max(formPrice, formOriginalPrice)) * 100)}% OFF
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-300">
                      Sale price is shown as the active selling price; default price is shown crossed out.
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>Active On Website:</span>
                      <span className="text-white font-mono font-bold">{formatPkr(formPrice || 0)}</span>
                      <span className="text-slate-500 text-[11px]">(Default price — No discount)</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Optional: Enter a Sale price to display a discounted deal</span>
                  </div>
                )}

                {/* Product Image Upload Section */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 uppercase tracking-wider block flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Product Image *</span>
                    </span>
                    {formImage && (
                      <button
                        type="button"
                        onClick={() => setFormImage('')}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Clear Image
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Thumbnail Preview */}
                    <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 relative group">
                      {formImage ? (
                        <>
                          <img
                            src={formImage}
                            alt="Product preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              openImageCropper(
                                formImage,
                                'Adjust & Crop Product Image',
                                '1:1',
                                (url) => setFormImage(url)
                              )
                            }
                            title="Crop & Frame Image"
                            className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-blue-400 text-xs font-bold transition-opacity cursor-pointer"
                          >
                            <Crop className="w-5 h-5 mb-1" />
                            <span>Crop & Frame</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-500">
                          <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                          <span className="text-[9px]">No Image</span>
                        </div>
                      )}
                      {isUploadingProductImage && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                          <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                        </div>
                      )}
                    </div>

                    {/* Upload & URL Inputs */}
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={prodFileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden="true"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              handleUploadFile(
                                f,
                                (url) => setFormImage(url),
                                setIsUploadingProductImage,
                                { title: 'Crop & Frame Product Image', aspectRatio: '1:1' }
                              );
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => prodFileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openImageCropper(
                              formImage,
                              'Adjust & Crop Product Image',
                              '1:1',
                              (url) => setFormImage(url)
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 transition-all cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5 text-blue-400" />
                          <span>Crop & Frame</span>
                        </button>
                        <span className="text-[11px] text-slate-400">PNG, JPG, WEBP</span>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={formImage || ''}
                          onChange={(e) => setFormImage(e.target.value)}
                          required
                          placeholder="https://... direct image link"
                          className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300 uppercase block text-[11px] tracking-wider">
                      Product Description *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDescription}
                      className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Generate technical overview and specifications"
                    >
                      {isGeneratingDescription ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-blue-200" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Generate Description</span>
                        </>
                      )}
                    </button>
                  </div>

                  {descriptionGenNotice && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{descriptionGenNotice}</span>
                    </div>
                  )}

                  <textarea
                    rows={3}
                    value={formDescription || ''}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide product highlights, warranty terms, specifications, and gaming or workstation capabilities..."
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs leading-relaxed outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Click <strong className="text-blue-400 font-semibold">Generate Description</strong> to auto-write a tailored technical and performance summary based on this product's name, brand, and specifications.
                  </p>
                </div>

                {/* Hardware Specifications & Dynamic Category Schema Engine */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-white text-xs uppercase tracking-wider">
                          Hardware Specifications & Technical Schema
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Category: <strong className="text-blue-300">{formCategory}</strong> — manual entry or 1-click web auto-fill.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoFillSpecs}
                        disabled={isAutoFillingSpecs || !formName.trim()}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                        title="Search hardware databases & AI to automatically populate technical specifications"
                      >
                        {isAutoFillingSpecs ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>Auto-Filling Specs...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Auto-Fill Specs from Web</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {autoFillNotice && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{autoFillNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoFillNotice(null)}
                        className="text-emerald-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Core PC Builder Compatibility Fields - Only shown for relevant PC component categories */}
                  {(() => {
                    const catLower = (formCategory || '').toLowerCase();
                    const isCpu = catLower.includes('processor') || catLower.includes('cpu');
                    const isGpu = catLower.includes('graphic') || catLower.includes('gpu') || catLower.includes('video card');
                    const isMobo = catLower.includes('motherboard') || catLower.includes('mobo');
                    const isRam = catLower.includes('ram') || catLower.includes('memory');
                    const isPsu = catLower.includes('power supply') || catLower.includes('psu');
                    const isCooler = catLower.includes('cooler');
                    const isCasing = catLower.includes('casing') || catLower.includes('case');
                    const isPrebuilt = catLower.includes('pre-built') || catLower.includes('prebuilt') || catLower.includes('pc build');

                    const hasCompatibilityFields = isCpu || isGpu || isMobo || isRam || isPsu || isCooler || isCasing || isPrebuilt;

                    if (!hasCompatibilityFields) {
                      return null;
                    }

                    return (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          PC Builder Compatibility Settings
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                          {(isCpu || isMobo || isCooler || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">Socket</label>
                              <select
                                value={formSocket || ''}
                                onChange={(e: any) => setFormSocket(e.target.value)}
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">None / Not Applicable</option>
                                <option value="AM4">AMD AM4</option>
                                <option value="AM5">AMD AM5</option>
                                <option value="LGA1700">Intel LGA1700</option>
                                <option value="LGA1851">Intel LGA1851</option>
                                <option value="LGA1200">Intel LGA1200</option>
                                <option value="TR4">AMD Threadripper</option>
                              </select>
                            </div>
                          )}

                          {(isRam || isMobo || isCpu || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">RAM Generation</label>
                              <select
                                value={formRamType || ''}
                                onChange={(e: any) => setFormRamType(e.target.value)}
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">None / Not Applicable</option>
                                <option value="DDR4">DDR4</option>
                                <option value="DDR5">DDR5</option>
                                <option value="DDR3">DDR3</option>
                              </select>
                            </div>
                          )}

                          {(isMobo || isPsu || isCasing || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">Form Factor</label>
                              <select
                                value={formFormFactor || ''}
                                onChange={(e: any) => setFormFormFactor(e.target.value)}
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">None / Not Applicable</option>
                                <option value="ATX">ATX</option>
                                <option value="Micro-ATX">Micro-ATX</option>
                                <option value="Mini-ITX">Mini-ITX</option>
                                <option value="E-ATX">E-ATX</option>
                                <option value="SFX">SFX (Compact PSU)</option>
                              </select>
                            </div>
                          )}

                          {(isCpu || isGpu || isCooler || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">TDP / Power (Watts)</label>
                              <input
                                type="number"
                                value={formTdpWatts || ''}
                                onChange={(e) => setFormTdpWatts(e.target.value ? Number(e.target.value) : '')}
                                placeholder="e.g. 65, 125, 285"
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                              />
                            </div>
                          )}

                          {(isGpu || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">VRAM Capacity (GB)</label>
                              <input
                                type="number"
                                value={formVramGb || ''}
                                onChange={(e) => setFormVramGb(e.target.value ? Number(e.target.value) : '')}
                                placeholder="e.g. 8, 12, 16, 24"
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                              />
                            </div>
                          )}

                          {(isPsu || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">PSU Capacity (Watts)</label>
                              <input
                                type="number"
                                value={formPsuWattage || ''}
                                onChange={(e) => setFormPsuWattage(e.target.value ? Number(e.target.value) : '')}
                                placeholder="e.g. 650, 750, 850, 1000"
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                              />
                            </div>
                          )}

                          {(isGpu || isPrebuilt) && (
                            <div>
                              <label className="text-slate-300 font-semibold block mb-1">Recommended PSU (Watts)</label>
                              <input
                                type="number"
                                value={formRecPsu || ''}
                                onChange={(e) => setFormRecPsu(e.target.value ? Number(e.target.value) : '')}
                                placeholder="e.g. 750"
                                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Category-Specific Dynamic Specification Fields from Schema */}
                  {(() => {
                    const schema = categorySchemas.find(
                      (s) => s.category.toLowerCase() === formCategory.toLowerCase()
                    );

                    if (!schema || schema.attributes.length === 0) {
                      return (
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            No custom schema fields defined for <strong>{formCategory}</strong>.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNew(false);
                              setEditingProduct(null);
                              setAdminTab('attributes');
                            }}
                            className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                          >
                            <span>Open Attribute Editor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="pt-2 border-t border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-blue-400" />
                            <span>{formCategory} Specifications Schema ({schema.attributes.length} fields)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNew(false);
                              setEditingProduct(null);
                              setAdminTab('attributes');
                            }}
                            className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                          >
                            Edit Category Schema
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {schema.attributes.map((attr) => {
                            const val = formCustomAttributes[attr.id] !== undefined ? formCustomAttributes[attr.id] : '';

                            return (
                              <div key={attr.id} className="space-y-1">
                                <label className="text-slate-300 font-medium text-xs flex items-center justify-between">
                                  <span>
                                    {attr.name} {attr.unit ? `(${attr.unit})` : ''}
                                  </span>
                                  {attr.required && (
                                    <span className="text-[9px] font-bold text-red-400 uppercase">
                                      Req
                                    </span>
                                  )}
                                </label>

                                {attr.type === 'select' ? (
                                  <select
                                    value={val}
                                    onChange={(e) =>
                                      setFormCustomAttributes((prev) => ({
                                        ...prev,
                                        [attr.id]: e.target.value,
                                      }))
                                    }
                                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                  >
                                    <option value="">Select {attr.name}...</option>
                                    {attr.options?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : attr.type === 'boolean' ? (
                                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/10 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(val)}
                                      onChange={(e) =>
                                        setFormCustomAttributes((prev) => ({
                                          ...prev,
                                          [attr.id]: e.target.checked,
                                        }))
                                      }
                                      className="w-4 h-4 rounded accent-blue-600"
                                    />
                                    <span className="text-slate-300">{val ? 'Yes / Supported' : 'No / Unsupported'}</span>
                                  </label>
                                ) : attr.type === 'number' ? (
                                  <input
                                    type="number"
                                    value={val}
                                    onChange={(e) =>
                                      setFormCustomAttributes((prev) => ({
                                        ...prev,
                                        [attr.id]: e.target.value ? Number(e.target.value) : '',
                                      }))
                                    }
                                    placeholder={attr.placeholder || (attr.unit ? `e.g. 5000 ${attr.unit}` : 'e.g. 100')}
                                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) =>
                                      setFormCustomAttributes((prev) => ({
                                        ...prev,
                                        [attr.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={attr.placeholder || `Enter ${attr.name.toLowerCase()}...`}
                                    className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                  />
                                )}

                                {attr.helpText && (
                                  <p className="text-[10px] text-slate-500 truncate">{attr.helpText}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Variable Products Option */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Variable Product (Multiple Colors / Editions)</span>
                      <span className="text-slate-400">e.g. White Edition vs Black Edition with custom pricing/stock</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formIsVariable}
                      onChange={(e) => setFormIsVariable(e.target.checked)}
                      className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {formIsVariable && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-300">Color Variants</span>
                        <button
                          type="button"
                          onClick={handleAddVariant}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
                        >
                          + Add Variant
                        </button>
                      </div>

                      {formVariants.map((v, vIdx) => (
                        <div key={v.id} className="p-3 rounded-xl bg-slate-900 border border-white/10 flex flex-wrap lg:flex-nowrap gap-2 items-center text-xs">
                          <div className="flex-1 min-w-[100px]">
                            <input
                              type="text"
                              value={v.color || v.name}
                              onChange={(e) => {
                                const copy = [...formVariants];
                                copy[vIdx].name = e.target.value;
                                copy[vIdx].color = e.target.value;
                                setFormVariants(copy);
                              }}
                              placeholder="Color/Name"
                              className="w-full p-1.5 rounded bg-slate-800 border border-white/10 text-white text-[11px]"
                            />
                          </div>
                          <div className="flex-1 min-w-[90px]">
                            <input
                              type="text"
                              value={v.sku || ''}
                              onChange={(e) => {
                                const copy = [...formVariants];
                                copy[vIdx].sku = e.target.value.toUpperCase();
                                setFormVariants(copy);
                              }}
                              placeholder="SKU"
                              className="w-full p-1.5 rounded bg-slate-800 border border-white/10 text-amber-300 font-mono text-[10px] uppercase font-semibold"
                            />
                          </div>

                          <div className="w-[90px]">
                            <input
                              type="number"
                              value={v.price}
                              onChange={(e) => {
                                const copy = [...formVariants];
                                copy[vIdx].price = Number(e.target.value);
                                setFormVariants(copy);
                              }}
                              placeholder="Price"
                              className="w-full p-1.5 rounded bg-slate-800 border border-white/10 text-white font-mono text-[11px]"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="cursor-pointer p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center justify-center text-[10px]" title="Upload & Frame Variant Image">
                              <Upload className="w-3 h-3" />
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden="true"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    handleUploadFile(
                                      f,
                                      (url) => {
                                        const copy = [...formVariants];
                                        copy[vIdx].image = url;
                                        setFormVariants(copy);
                                      },
                                      undefined,
                                      { title: `Crop & Frame Variant Image (${v.name || 'Variant'})`, aspectRatio: '1:1' }
                                    );
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {v.image && (
                              <button
                                type="button"
                                onClick={() =>
                                  openImageCropper(
                                    v.image,
                                    `Crop Variant Image (${v.name || 'Variant'})`,
                                    '1:1',
                                    (url) => {
                                      const copy = [...formVariants];
                                      copy[vIdx].image = url;
                                      setFormVariants(copy);
                                    }
                                  )
                                }
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-white/10 flex items-center justify-center text-[10px] cursor-pointer"
                                title="Adjust / Crop Variant Image"
                              >
                                <Crop className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <input
                              type="number"
                              value={v.stock}
                              onChange={(e) => {
                                const copy = [...formVariants];
                                copy[vIdx].stock = Number(e.target.value);
                                setFormVariants(copy);
                              }}
                              placeholder="Stock"
                              className="p-1.5 rounded bg-slate-800 border border-white/10 text-white w-12 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => setFormVariants(formVariants.filter((_, i) => i !== vIdx))}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/30"
                  >
                    Save Product to Store
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* MODAL: COMPREHENSIVE ORDER DETAILS INSPECTOR */}
        {selectedOrderForDetail && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#0b1120] border border-blue-500/30 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-white/10 bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-black text-blue-400 uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/30">
                        ORDER #{selectedOrderForDetail.orderNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        • {new Date(selectedOrderForDetail.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                      Customer Order & Hardware Invoice
                    </h3>
                  </div>
                </div>

                {/* Quick Header Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateOrderInvoicePdf(selectedOrderForDetail, storeSettings)}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
                    title="Download Official PDF Invoice"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">PDF Bill</span>
                  </button>

                  <button
                    onClick={() => handleCopyOrderSummary(selectedOrderForDetail)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Copy Order Summary"
                  >
                    <Copy className="w-4 h-4 text-blue-400" />
                    <span className="hidden sm:inline">Copy Bill</span>
                  </button>

                  <button
                    onClick={() => handleWhatsAppOrder(selectedOrderForDetail)}
                    className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Open WhatsApp Chat"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Print Invoice"
                  >
                    <Printer className="w-4 h-4 text-slate-300" />
                    <span className="hidden sm:inline">Print</span>
                  </button>

                  <button
                    onClick={() => setSelectedOrderForDetail(null)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-slate-400 flex items-center justify-center transition-all ml-1"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Scrollable Content */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                {/* Order Fulfillment & Logistics Management Section */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/20 space-y-4">
                  {/* Top Status & Verification Row */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Order Fulfillment & Verification
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={selectedOrderForDetail.status}
                            onChange={(e: any) =>
                              handleUpdateOrderStatus(
                                selectedOrderForDetail.id,
                                e.target.value,
                                trackingInput,
                                courierInput
                              )
                            }
                            className="bg-slate-900 border border-blue-500/30 text-blue-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                          >
                            <option value="Pending">Pending Verification (Invoice Locked)</option>
                            <option value="Verified">✓ Verified / Accepted (Invoice Downloadable)</option>
                            <option value="Assembling">Assembling PC Rig (Invoice Downloadable)</option>
                            <option value="Testing">Thermal & FPS Benchmarking (Invoice Downloadable)</option>
                            <option value="Shipped">Shipped via Cargo / Courier (Invoice Downloadable)</option>
                            <option value="Delivered">Delivered (Invoice Downloadable)</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Invoice Access:{' '}
                        {selectedOrderForDetail.status === 'Pending' || selectedOrderForDetail.status === 'Cancelled' ? (
                          <strong className="text-amber-400">Locked (Accept / Verify order to unlock PDF)</strong>
                        ) : (
                          <strong className="text-emerald-400">Unlocked & Downloadable for Customer</strong>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Order Nature Callout */}
                  {hasPcBuildInOrder(selectedOrderForDetail) ? (
                    <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-start gap-2.5 text-xs">
                      <span className="text-base">🖥️</span>
                      <div>
                        <div className="font-bold text-purple-300">Full PC Rig Build Detected</div>
                        <p className="text-slate-300 text-[11px] mt-0.5">
                          Full PC Rigs are dispatched via specialized <strong>Cargo Freight Services</strong> (e.g. Daewoo Express Cargo / Faisal Movers) instead of regular couriers (TCS / Leopards) to prevent internal vibration and transit damage.
                        </p>
                      </div>
                    </div>
                  ) : (selectedOrderForDetail.paymentMethod || '').toLowerCase().includes('pickup') || (selectedOrderForDetail.courierName || '').toLowerCase().includes('pickup') ? (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2.5 text-xs">
                      <span className="text-base">🏪</span>
                      <div>
                        <div className="font-bold text-emerald-300">Local Store Pickup (Hafeez Centre, Lahore)</div>
                        <p className="text-slate-300 text-[11px] mt-0.5">
                          Customer selected in-store collection. No courier tracking number is auto-assigned to preserve API tokens.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-start gap-2.5 text-xs">
                      <span className="text-base">📦</span>
                      <div>
                        <div className="font-bold text-blue-300">Loose Hardware / Component Dispatch</div>
                        <p className="text-slate-300 text-[11px] mt-0.5">
                          Dispatched via standard express couriers (Leopards / TCS / Trax).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Carrier Dropdown & Tracking Input Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Carrier / Cargo Service Dropdown Menu */}
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Dispatch / Cargo Service
                      </label>
                      <select
                        value={courierInput}
                        onChange={(e) => setCourierInput(e.target.value)}
                        className="w-full bg-slate-950 border border-white/15 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                      >
                        {CARRIER_SERVICE_OPTIONS.map((grp) => (
                          <optgroup key={grp.group} label={grp.group} className="bg-slate-900 text-slate-300 font-bold">
                            {grp.options.map((opt) => (
                              <option key={opt} value={opt} className="bg-slate-950 text-white font-normal">
                                {opt}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Tracking / Cargo Bilty CN Input */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Tracking / Bilty Consignment #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DWO-81920, FM-1029, LCS-78210-PK"
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    {/* Save Button & 1-Click Dispatch */}
                    <div className="md:col-span-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOrderStatus(
                            selectedOrderForDetail.id,
                            selectedOrderForDetail.status,
                            trackingInput,
                            courierInput
                          )
                        }
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Logistics</span>
                      </button>

                      {!hasPcBuildInOrder(selectedOrderForDetail) &&
                        courierInput.toLowerCase().includes('leopards') && (
                          <button
                            type="button"
                            disabled={isDispatchingLeopards}
                            onClick={() => handleDispatchLeopards(selectedOrderForDetail.id)}
                            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shrink-0 flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-40"
                            title="Auto-generate Leopards Consignment Number"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-slate-400 font-semibold mr-1">Quick Select:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCourierInput('Daewoo Express Cargo');
                        if (!trackingInput) setTrackingInput('DWO-');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/20 transition-all font-semibold"
                    >
                      🚚 Daewoo Cargo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCourierInput('Faisal Movers Cargo');
                        if (!trackingInput) setTrackingInput('FM-');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/20 transition-all font-semibold"
                    >
                      🚚 Faisal Movers Cargo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCourierInput('Leopards Courier');
                        if (!trackingInput || trackingInput.startsWith('DWO-') || trackingInput.startsWith('FM-')) {
                          setTrackingInput(`LCS-${selectedOrderForDetail.orderNumber.replace(/[^0-9]/g, '') || '1001'}-PK`);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/20 transition-all font-semibold"
                    >
                      📦 Leopards Courier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCourierInput('TCS Express');
                        if (!trackingInput || trackingInput.startsWith('DWO-') || trackingInput.startsWith('FM-')) {
                          setTrackingInput(`TCS-${selectedOrderForDetail.orderNumber.replace(/[^0-9]/g, '') || '1001'}`);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/20 transition-all font-semibold"
                    >
                      📦 TCS Express
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCourierInput('Store Pickup (No Courier Tracking)');
                        setTrackingInput('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 transition-all font-semibold"
                    >
                      🏪 Store Pickup
                    </button>
                  </div>
                </div>

                {leopardsNotice && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{leopardsNotice}</span>
                  </div>
                )}

                {/* Customer Information Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Contact Profile */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                      <User className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Customer Details
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400">Full Name:</span>
                        <p className="text-sm font-bold text-white">
                          {selectedOrderForDetail.customer.fullName}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-400">Phone Number:</span>
                          <p className="font-mono font-bold text-blue-300">
                            {selectedOrderForDetail.customer.phone}
                          </p>
                        </div>
                        <a
                          href={`tel:${selectedOrderForDetail.customer.phone}`}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-bold"
                        >
                          Call Customer
                        </a>
                      </div>
                      {selectedOrderForDetail.customer.email && (
                        <div>
                          <span className="text-slate-400">Email Address:</span>
                          <p className="text-slate-200 font-mono">
                            {selectedOrderForDetail.customer.email}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Payment Selected:</span>
                        <p className="font-semibold text-emerald-400">
                          💳 {selectedOrderForDetail.paymentMethod}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Shipping & Delivery Address */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Shipping & Delivery Info
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400">Destination City:</span>
                        <p className="text-sm font-bold text-white">
                          {selectedOrderForDetail.customer.city}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Street / Full Address:</span>
                        <p className="text-slate-200 font-medium mt-0.5 leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-white/5">
                          {selectedOrderForDetail.customer.address}
                        </p>
                      </div>
                      {selectedOrderForDetail.customer.notes && (
                        <div>
                          <span className="text-slate-400">Customer Delivery Instructions:</span>
                          <p className="text-amber-300 font-medium italic mt-0.5 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                            "{selectedOrderForDetail.customer.notes}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Payment Verification Screenshot Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Payment Screenshot & Deposit Slip Verification
                      </h4>
                    </div>
                    {selectedOrderForDetail.paymentScreenshot ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Receipt Attached by Customer
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10">
                        No screenshot uploaded yet
                      </span>
                    )}
                  </div>

                  {selectedOrderForDetail.paymentScreenshot ? (
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      <div className="relative group shrink-0">
                        <img
                          src={selectedOrderForDetail.paymentScreenshot}
                          alt="Customer Payment Receipt"
                          className="w-36 h-36 sm:w-44 sm:h-44 object-contain rounded-xl bg-black/60 border border-emerald-500/40 cursor-pointer shadow-lg hover:border-emerald-400 transition-all"
                          onClick={() => {
                            const w = window.open('');
                            if (w) {
                              w.document.write(`<img src="${selectedOrderForDetail.paymentScreenshot}" style="max-width:100%;height:auto;margin:auto;display:block;background:#000;" />`);
                            }
                          }}
                          title="Click to view full size"
                        />
                        <span className="text-[10px] text-slate-400 block text-center mt-1">
                          Click image to expand
                        </span>
                      </div>

                      <div className="space-y-2 text-xs flex-1">
                        <div>
                          <span className="text-slate-400">Payment Mode:</span>
                          <p className="text-sm font-bold text-white">{selectedOrderForDetail.paymentMethod}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Invoice Total Due:</span>
                          <p className="text-base font-black text-emerald-400 font-mono">
                            {formatPkr(selectedOrderForDetail.total)}
                          </p>
                        </div>
                        {selectedOrderForDetail.paymentScreenshotUploadedAt && (
                          <div>
                            <span className="text-slate-400">Uploaded At:</span>
                            <p className="text-slate-300">
                              {new Date(selectedOrderForDetail.paymentScreenshotUploadedAt).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {selectedOrderForDetail.status === 'Pending' && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(selectedOrderForDetail.id, 'Verified')}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Verify Receipt & Accept Order</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 py-1">
                      <p>
                        The customer has not uploaded a digital payment screenshot yet. You can confirm payment via WhatsApp or call, or accept the order once bank notification is received.
                      </p>
                    </div>
                  )}
                </div>

                {/* EXACT USER SPECIFICATION: ORDERED ITEMS WITH NAME, QUANTITY, COLOR, PRICE AND TOTAL IN THE END */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-2.5 gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Ordered Items & Hardware Configuration ({selectedOrderForDetail.items.length} items)
                      </h4>
                    </div>
                    
                    {!isEditingOrderItems ? (
                      <button
                        type="button"
                        onClick={() => handleStartEditOrderItems(selectedOrderForDetail)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm self-start sm:self-auto"
                        title="Swap out-of-stock components, replace parts or adjust quantities in this order"
                      >
                        <Wrench className="w-3.5 h-3.5 text-blue-400" />
                        <span>Edit Order Components / Substitute Parts</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={handleCancelEditOrderItems}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingOrderItems}
                          onClick={handleSaveOrderItems}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all"
                        >
                          {isSavingOrderItems ? 'Saving Changes...' : 'Save Order Changes'}
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingOrderItems ? (
                    /* INTERACTIVE EDITING & COMPONENT SWAPPING VIEW */
                    <div className="space-y-4 p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-300">
                          Editing Order #{selectedOrderForDetail.orderNumber} Components ({editableOrderItems.length} items)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Substitute out-of-stock parts or adjust quantities/prices
                        </span>
                      </div>

                      <div className="space-y-3">
                        {editableOrderItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-900 border border-white/10 space-y-3 shadow-md"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-blue-600/30 text-blue-400 font-mono text-[10px] font-bold flex items-center justify-center">
                                  #{idx + 1}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30">
                                  {item.category || 'Hardware'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSwappingItemIndex(swappingItemIndex === idx ? null : idx);
                                    setSwapProductSearch('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <span>🔁 Swap Component</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditableItem(idx)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            {/* Inputs for item details */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                              <div className="sm:col-span-5 space-y-1">
                                <label className="text-[10px] font-semibold text-slate-400 block">Product / Component Name</label>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateEditableItem(idx, 'name', e.target.value)}
                                  className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-semibold focus:border-blue-500 outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-semibold text-slate-400 block">Quantity</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateEditableItem(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-xs focus:border-blue-500 outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-semibold text-slate-400 block">Unit Price (PKR)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.price}
                                  onChange={(e) => handleUpdateEditableItem(idx, 'price', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                  className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-xs focus:border-blue-500 outline-none"
                                />
                              </div>
                              <div className="sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-semibold text-amber-400 block">Serial Number (S/N)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. SN-892401"
                                  value={item.serialNumber || (item.serialNumbers && item.serialNumbers.length > 0 ? item.serialNumbers.join(', ') : '') || ''}
                                  onChange={(e) => {
                                    handleUpdateEditableItem(idx, 'serialNumber', e.target.value);
                                    const clean = e.target.value.trim();
                                    const arr = clean ? clean.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [];
                                    handleUpdateEditableItem(idx, 'serialNumbers', arr);
                                  }}
                                  className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-xs focus:border-amber-500 outline-none placeholder-slate-600"
                                  title="Enter hardware serial number for this sold component"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                              <span className="text-slate-400 text-[11px]">
                                Spec / Color: <strong className="text-slate-200">{item.variantColor || item.variantName || 'Standard'}</strong>
                              </span>
                              <span className="text-blue-400 font-mono font-bold">
                                Line Total: {formatPkr((Number(item.price) || 0) * (Number(item.quantity) || 1))}
                              </span>
                            </div>

                            {/* INLINE PRODUCT PICKER FOR SWAPPING */}
                            {swappingItemIndex === idx && (
                              <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-indigo-300">
                                    Select Replacement Hardware from Inventory:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSwappingItemIndex(null)}
                                    className="text-slate-400 hover:text-white text-xs"
                                  >
                                    ✕ Close
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Filter products by title, category, or brand..."
                                  value={swapProductSearch}
                                  onChange={(e) => setSwapProductSearch(e.target.value)}
                                  className="w-full p-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                  {products
                                    .filter((p) => {
                                      if (!swapProductSearch.trim()) return true;
                                      const q = swapProductSearch.toLowerCase();
                                      return (
                                        p.name.toLowerCase().includes(q) ||
                                        p.category.toLowerCase().includes(q) ||
                                        p.brand.toLowerCase().includes(q)
                                      );
                                    })
                                    .slice(0, 15)
                                    .map((prod) => (
                                      <div
                                        key={prod.id}
                                        onClick={() => handleSwapItemWithProduct(idx, prod)}
                                        className="p-2 rounded-lg bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/40 flex items-center justify-between cursor-pointer transition-all text-xs"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          {prod.image && (
                                            <img src={prod.image} alt={prod.name} className="w-8 h-8 rounded object-cover shrink-0" />
                                          )}
                                          <div className="truncate">
                                            <p className="font-bold text-white truncate text-[11px]">{prod.name}</p>
                                            <span className="text-[10px] text-slate-400">
                                              [{prod.category}] • {prod.inStock !== false ? 'In Stock' : 'Out of Stock'}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0 pl-2">
                                          <span className="font-mono font-bold text-emerald-400 text-xs block">
                                            {formatPkr(prod.price)}
                                          </span>
                                          <span className="text-[10px] text-indigo-400 font-semibold">Select ➔</span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* ADD NEW COMPONENT BUTTON */}
                      <div className="pt-2">
                        {!isAddingNewOrderItem ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewOrderItem(true);
                              setSwapProductSearch('');
                            }}
                            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-white/20 hover:border-blue-400 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                          >
                            <span>+ Add Component / Item to this Order</span>
                          </button>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-400">
                                Add Product from Store Catalog to Order:
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsAddingNewOrderItem(false)}
                                className="text-slate-400 hover:text-white text-xs"
                              >
                                ✕ Cancel
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="Search product to add..."
                              value={swapProductSearch}
                              onChange={(e) => setSwapProductSearch(e.target.value)}
                              className="w-full p-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                              {products
                                .filter((p) => {
                                  if (!swapProductSearch.trim()) return true;
                                  const q = swapProductSearch.toLowerCase();
                                  return (
                                    p.name.toLowerCase().includes(q) ||
                                    p.category.toLowerCase().includes(q) ||
                                    p.brand.toLowerCase().includes(q)
                                  );
                                })
                                .slice(0, 15)
                                .map((prod) => (
                                  <div
                                    key={prod.id}
                                    onClick={() => handleAddNewItemToOrder(prod)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-emerald-600/20 border border-white/5 hover:border-emerald-500/40 flex items-center justify-between cursor-pointer transition-all text-xs"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      {prod.image && (
                                        <img src={prod.image} alt={prod.name} className="w-8 h-8 rounded object-cover shrink-0" />
                                      )}
                                      <div className="truncate">
                                        <p className="font-bold text-white truncate text-[11px]">{prod.name}</p>
                                        <span className="text-[10px] text-slate-400">[{prod.category}]</span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 pl-2">
                                      <span className="font-mono font-bold text-emerald-400 text-xs block">
                                        {formatPkr(prod.price)}
                                      </span>
                                      <span className="text-[10px] text-emerald-400 font-semibold">+ Add to Order</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recalculated Order Summary Bar */}
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">New Subtotal</span>
                            <span className="font-mono font-bold text-white">
                              {formatPkr(editableOrderItems.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0))}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery Fee</span>
                            <span className="font-mono font-bold text-white">
                              {formatPkr(selectedOrderForDetail.shippingFee)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">New Grand Total</span>
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {formatPkr(
                                Math.max(
                                  0,
                                  editableOrderItems.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0) +
                                    (selectedOrderForDetail.shippingFee || 0) -
                                    (selectedOrderForDetail.discount || 0)
                                )
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEditOrderItems}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSavingOrderItems}
                            onClick={handleSaveOrderItems}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors"
                          >
                            {isSavingOrderItems ? 'Saving...' : 'Save Order Changes'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                    {selectedOrderForDetail.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 hover:border-white/20 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-14 h-14 rounded-xl object-cover bg-slate-900 border border-white/10 shrink-0"
                              />
                            )}
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 border border-blue-500/30">
                                  {item.category || 'Hardware'}
                                </span>
                                {item.isCustomRig && (
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-purple-600/20 text-purple-300 border border-purple-500/30">
                                    Custom Built Rig
                                  </span>
                                )}
                              </div>
                              <h5 className="text-sm font-bold text-white mt-1">
                                {item.name}
                              </h5>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                                <span>
                                  🎨 <strong>Color / Option:</strong>{' '}
                                  <span className="text-slate-200 font-semibold">
                                    {item.variantColor || item.variantName || 'Standard Edition'}
                                  </span>
                                </span>
                                <span>
                                  🔢 <strong>Quantity:</strong>{' '}
                                  <span className="text-blue-300 font-mono font-bold">
                                    {item.quantity}
                                  </span>
                                </span>
                                <span>
                                  💵 <strong>Unit Price:</strong>{' '}
                                  <span className="text-slate-200 font-mono">
                                    {formatPkr(item.price)}
                                  </span>
                                </span>
                                {(item.serialNumber || (item.serialNumbers && item.serialNumbers.length > 0)) ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                                    <span>🏷️ S/N:</span> {item.serialNumber || item.serialNumbers?.join(', ')}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditOrderItems(selectedOrderForDetail)}
                                    className="text-[10px] text-slate-500 hover:text-amber-400 italic flex items-center gap-1 transition-colors"
                                    title="Click to enter product serial number"
                                  >
                                    + Enter Serial Number
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Line Total for Item */}
                          <div className="text-right sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                              Item Line Total
                            </span>
                            <span className="text-base font-black text-blue-400 font-mono">
                              {formatPkr(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        {/* If this item is a Custom Built PC, show all component parts breakdown */}
                        {item.customRigBreakdown && item.customRigBreakdown.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-blue-500/20 space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                              <Cpu className="w-3.5 h-3.5" />
                              <span>Custom PC Component Breakdown ({item.customRigBreakdown.length} parts)</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {item.customRigBreakdown.map((part, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                      {part.category}
                                    </span>
                                    <p className="text-white font-medium truncate text-[11px]">
                                      {part.productName}
                                    </p>
                                    {part.variantColor && part.variantColor !== 'Standard' && (
                                      <span className="text-[9px] text-blue-300">
                                        Color: {part.variantColor}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-bold text-slate-300 shrink-0 text-[11px]">
                                    {formatPkr(part.price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )}
                </div>

                {/* FINANCIAL TOTAL IN THE END */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/50 border border-blue-500/30 space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Invoice Summary & Grand Total
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Items Subtotal:</span>
                      <span className="font-mono font-bold text-white">
                        {formatPkr(selectedOrderForDetail.subtotal)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Shipping & Courier Delivery:</span>
                      <span className="font-mono font-bold text-white">
                        {selectedOrderForDetail.shippingFee === 0
                          ? 'FREE (Standard Express)'
                          : formatPkr(selectedOrderForDetail.shippingFee)}
                      </span>
                    </div>

                    {selectedOrderForDetail.discount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Promotional Discount:</span>
                        <span className="font-mono font-bold">
                          - {formatPkr(selectedOrderForDetail.discount)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-300">
                      <span>Payment Method:</span>
                      <span className="font-bold text-slate-200">
                        {selectedOrderForDetail.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* PROMINENT GRAND TOTAL IN THE END */}
                  <div className="pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-950/40 p-4 rounded-xl border border-blue-500/30">
                    <div>
                      <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block">
                        Total Amount Payable / Received
                      </span>
                      <span className="text-xs text-slate-400">
                        Includes all hardware components, warranties, and delivery
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                        {formatPkr(selectedOrderForDetail.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Order synced with database</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => handleDeleteOrder(selectedOrderForDetail)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600/15 hover:bg-red-600/30 text-red-300 hover:text-red-200 border border-red-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Delete Order</span>
                  </button>

                  <button
                    onClick={() => handleCopyOrderSummary(selectedOrderForDetail)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Copy className="w-4 h-4 text-blue-400" />
                    <span>Copy Full Invoice</span>
                  </button>

                  <button
                    onClick={() => setSelectedOrderForDetail(null)}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IN-APP CONFIRMATION MODAL: DELETE ORDER */}
        {orderToDelete && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-red-950/50 text-left relative">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-red-400 block">
                    Confirm Order Deletion
                  </span>
                  <h3 className="text-lg font-black text-white">
                    Delete Order #{orderToDelete.orderNumber}?
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    This will permanently delete the order record for <strong className="text-white">{orderToDelete.customer?.fullName || 'Customer'}</strong> from the database.
                  </p>
                </div>
              </div>

              <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Customer:</span>
                  <span className="text-slate-200 font-semibold">{orderToDelete.customer?.fullName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Contact:</span>
                  <span className="text-slate-200 font-mono">{orderToDelete.customer?.phone}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Amount:</span>
                  <span className="text-emerald-400 font-bold font-mono">{formatPkr(orderToDelete.total)}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={() => executeDeleteOrder(orderToDelete)}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs transition-all shadow-lg shadow-red-600/30 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingOrder ? 'Deleting...' : 'Delete Permanently'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SKU BARCODE LABEL PRINT STUDIO */}
        {labelModalProduct && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 max-w-6xl w-full shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                    <Barcode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">SKU Barcode & Price Tag</h3>
                    <p className="text-[11px] text-slate-400">Inventory ready physical label with Code-128 SVG barcode</p>
                  </div>
                </div>
                <button
                  onClick={() => setLabelModalProduct(null)}
                  className="text-slate-400 hover:text-white text-base px-2"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 flex justify-center">
                <BarcodeLabel
                  product={labelModalProduct}
                  showPrice={true}
                  showSerial={true}
                  showWarranty={true}
                  showQr={true}
                  onClose={() => setLabelModalProduct(null)}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setAdminTab('erp');
                    setLabelModalProduct(null);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                >
                  <span>Open ERP Inventory & S/N Ledger →</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLabelModalProduct(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* MODAL: CLEAR CATALOG CONFIRMATION */}
        {isClearCatalogModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Clear Product Catalog?</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Start fresh with empty inventory</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/20 text-xs text-red-200 leading-relaxed">
                This will permanently remove all <strong>{products.length}</strong> products from the database so you can add your custom hardware items from scratch.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClearCatalogModalOpen(false)}
                  disabled={isClearingCatalog}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isClearingCatalog}
                  onClick={handleClearCatalog}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all"
                >
                  {isClearingCatalog ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Yes, Clear All ({products.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL: ZERO STOCK CONFIRMATION */}
        {isZeroStockModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Set Every Product Stock to 0?</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Marks all inventory counts as out of stock</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
                This will set <strong>stockCount: 0</strong>, <strong>stock: 0</strong>, and <strong>inStock: false</strong> for all <strong>{products.length}</strong> products (including any variants) across the live database and online store.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsZeroStockModalOpen(false)}
                  disabled={isZeroingStock}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isZeroingStock}
                  onClick={handleZeroAllStock}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all"
                >
                  {isZeroingStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-3.5 h-3.5" />
                      <span>Yes, Set All to 0 ({products.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL: OWNER AUTHORIZATION VERIFICATION */}
        {isOwnerModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Owner Authorization</h3>
                    <p className="text-xs text-slate-400">Unlock Apex Enterprise ERP Suite</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOwnerModalOpen(false)}
                  className="text-slate-400 hover:text-white text-base px-2"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/20 text-xs text-slate-300 space-y-2">
                <p>
                  Apex ERP Suite is strictly restricted to Store Owner (<strong>sheedatalli</strong>).
                </p>
                <p className="text-[11px] text-slate-400">
                  Please enter the owner password to confirm authorization and proceed to the enterprise ledger.
                </p>
              </div>

              {ownerUnlockError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                  {ownerUnlockError}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const response = await fetch('/api/auth/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'sheedatalli', password: ownerPasswordInput }) });
                    const data = await response.json();
                    if (!response.ok || !data.user?.isOwner) throw new Error(data.error || 'Owner verification failed.');
                    setIsOwnerUnlocked(true); setIsOwnerModalOpen(false); setOwnerUnlockError(null); setOwnerPasswordInput(''); setAdminTab('erp');
                  } catch (error) { setOwnerUnlockError((error as Error).message); }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Store Owner Password
                  </label>
                  <input
                    type="password"
                    required
                    value={ownerPasswordInput}
                    onChange={(e) => setOwnerPasswordInput(e.target.value)}
                    placeholder="Enter owner password..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:ring-1 focus:ring-amber-500 outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Enter the owner password configured on the server.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOwnerModalOpen(false);
                      setAdminTab('operations');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Cancel / Use Operations Hub
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
                  >
                    Authorize & Unlock ERP
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* INTERACTIVE IMAGE CROPPING & FRAMING MODAL */}
        <ImageCropModal
          isOpen={cropModal.isOpen}
          onClose={() => setCropModal((prev) => ({ ...prev, isOpen: false }))}
          imageUrl={cropModal.imageUrl}
          title={cropModal.title}
          defaultAspectRatio={cropModal.aspectRatio}
          onCropComplete={(croppedUrl) => {
            cropModal.onCropComplete(croppedUrl);
            setCropModal((prev) => ({ ...prev, isOpen: false }));
          }}
        />
      </div>
    </div>
  );
};
