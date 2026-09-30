import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../utils/apiClient';
import {
  PackagePlus,
  Printer,
  Sparkles,
  Barcode,
  Layers,
  FileCheck,
  CheckCircle2,
  Building2,
  Tag,
  DollarSign,
  ShieldCheck,
  Hash,
  Truck,
  RotateCcw,
  Sliders,
  Eye,
  Plus,
  Minus,
  Upload,
  Image as ImageIcon,
  Cpu,
  HardDrive,
  Zap,
  Fan,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  Check,
  HelpCircle,
  Copy,
  Boxes,
  Search,
  Filter,
  Layers3,
  Edit3,
  Loader2,
  Wand2,
  Crop,
} from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import {
  Product,
  ProductCategory,
  ProductVariant,
  CpuSocket,
  RamType,
  FormFactor,
  SerialNumberItem,
  CategoryAttributeSchema,
} from '../types';
import { DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS } from '../data/defaultCategoryAttributes';
import { formatPkr } from '../utils/formatters';
import { generateProductSKU, generateSequentialSerialNumbers, generateVariantSku, generateVariantSuffix } from '../utils/skuGenerator';
import { CATEGORY_FALLBACK_IMAGES } from '../utils/productImages';
import { BarcodeLabel } from './BarcodeLabel';
import { erpStorage } from '../services/erpStorage';

interface FastIntakeStationProps {
  products: Product[];
  categorySchemas?: CategoryAttributeSchema[];
  onCompleteIntake: (payload: {
    product: Partial<Product>;
    vendorName: string;
    billNumber: string;
    quantity: number;
    unitCost: number;
    sellingPrice: number;
    generatedSerials: string[];
    variantSerials?: any[];
    warrantyMonths: number;
    paymentStatus?: 'pending' | 'paid';
    autoPrint: boolean;
  }) => Promise<void>;
  onRefreshProducts?: () => void;
}

const COMMON_VENDORS = [
  'TechSource Distributors Lahore',
  'Apex International Components',
  'Hafeez Centre Wholesale Hub',
  'Digital Direct Importers',
  'Galaxy Computer Systems',
  'Direct Imports - Dubai Channel',
];

const ALL_CATEGORIES: ProductCategory[] = [
  'Processor',
  'Motherboard',
  'Graphic Card',
  'RAM',
  'Storage',
  'Power Supply',
  'Casing',
  'CPU Cooler',
  'PC Case Fans',
  'Casing Fans',
  'Monitor',
  'Gaming Mouse',
  'Gaming Keyboard',
  'Gaming Headset',
  'Peripherals',
  'Cables & Accessories',
  'Pre-Built PC',
];

export const FastIntakeStation: React.FC<FastIntakeStationProps> = ({
  products,
  categorySchemas = DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS,
  onCompleteIntake,
  onRefreshProducts,
}) => {
  // Mode: Existing SKU vs Brand New Product Creation
  const [intakeMode, setIntakeMode] = useState<'existing' | 'new'>('new');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Search & Filter state for selecting existing catalog products
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');



  // Core Product Information
  const [name, setName] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [category, setCategory] = useState<ProductCategory>('PC Case Fans');
  const [sku, setSku] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [image, setImage] = useState<string>(
    'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&auto=format&fit=crop&q=80'
  );
  const [featured, setFeatured] = useState<boolean>(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState<boolean>(false);
  const [isCropperOpen, setIsCropperOpen] = useState<boolean>(false);
  const intakeFileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Vendors loaded from ERP / Database
  const [vendorsList, setVendorsList] = useState<string[]>(() => {
    const fromErp = erpStorage.getVendors().map((v) => v.name || v.companyName).filter(Boolean);
    return Array.from(new Set([...fromErp, ...COMMON_VENDORS]));
  });

  useEffect(() => {
    const refreshVendors = () => {
      const fromErp = erpStorage.getVendors().map((v) => v.name || v.companyName).filter(Boolean);
      const combined = Array.from(new Set([...fromErp, ...COMMON_VENDORS]));
      setVendorsList(combined);
    };

    authFetch('/api/erp/vendors')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((v) => erpStorage.saveVendor(v));
          refreshVendors();
        }
      })
      .catch(() => {});

    window.addEventListener('apex:vendors_updated', refreshVendors);
    window.addEventListener('apex:erp_updated', refreshVendors);
    window.addEventListener('storage', refreshVendors);
    window.addEventListener('focus', refreshVendors);
    const poll = setInterval(refreshVendors, 2500);

    return () => {
      window.removeEventListener('apex:vendors_updated', refreshVendors);
      window.removeEventListener('apex:erp_updated', refreshVendors);
      window.removeEventListener('storage', refreshVendors);
      window.removeEventListener('focus', refreshVendors);
      clearInterval(poll);
    };
  }, []);

  // Financials & Vendor / Bill
  const [vendorName, setVendorName] = useState<string>(() => {
    const fromErp = erpStorage.getVendors().map((v) => v.name || v.companyName).filter(Boolean);
    return fromErp[0] || 'TechSource Distributors Lahore';
  });
  const [customVendor, setCustomVendor] = useState<string>('');
  const [billNumber, setBillNumber] = useState<string>(
    () => `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [unitCost, setUnitCost] = useState<number | ''>(2800);
  const [sellingPrice, setSellingPrice] = useState<number | ''>(4200);
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(36);

  // Hardware Specifications Accordion & Attributes
  const [showSpecsSection, setShowSpecsSection] = useState<boolean>(true);
  const [socket, setSocket] = useState<CpuSocket | ''>('');
  const [ramType, setRamType] = useState<RamType | ''>('');
  const [formFactor, setFormFactor] = useState<FormFactor | ''>('');
  const [tdpWatts, setTdpWatts] = useState<number | ''>('');
  const [vramGb, setVramGb] = useState<number | ''>('');
  const [psuWattage, setPsuWattage] = useState<number | ''>('');
  const [recPsu, setRecPsu] = useState<number | ''>('');
  const [storageType, setStorageType] = useState<string>('');
  const [storageCapacity, setStorageCapacity] = useState<string>('');
  const [readSpeedMb, setReadSpeedMb] = useState<number | ''>('');
  const [coolerType, setCoolerType] = useState<string>('');
  const [rgbType, setRgbType] = useState<'ARGB' | 'Auto-RGB' | 'Non-RGB'>('ARGB');

  // AI Auto-Fill Specifications & Compatibility
  const [isAutoFillingSpecs, setIsAutoFillingSpecs] = useState<boolean>(false);
  const [autoFillNotice, setAutoFillNotice] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // Dynamic Category Schema Custom Attributes (Key-Value)
  const [customAttributes, setCustomAttributes] = useState<Record<string, any>>({});

  // Product Variants
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Quantity & Serial Sequencer
  const [quantity, setQuantity] = useState<number>(10);
  const [startSequence, setStartSequence] = useState<number>(1);
  const [customSerialPrefix, setCustomSerialPrefix] = useState<string>('');
  const [serialEntryMode, setSerialEntryMode] = useState<'auto' | 'manual'>('auto');
  const [manualSerialsText, setManualSerialsText] = useState<string>('');

  const [variantSerialConfigs, setVariantSerialConfigs] = useState<Record<string, { mode: 'auto' | 'manual'; manualText: string; quantity: number }>>({});
  const [activeVariantTab, setActiveVariantTab] = useState<string | null>(null);

  // Helper for batch date code e.g. '260914' (YYMMDD) to allow serial numbers to restart from 001 safely on restock
  const getTodayDateBatch = () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const buildSerialNumber = (basePrefix: string, seqNum: number) => {
    const dateBatch = getTodayDateBatch();
    const padSeq = String(seqNum).padStart(seqNum > 999 ? 4 : 3, '0');
    if (basePrefix.includes(dateBatch)) {
      return `${basePrefix}-${padSeq}`;
    }
    return `${basePrefix}-${dateBatch}-${padSeq}`;
  };

  useEffect(() => {
    if (hasVariants && variants.length > 0) {
      if (!activeVariantTab || !variants.find(v => v.id === activeVariantTab)) {
        setActiveVariantTab(variants[0].id);
      }
      setVariantSerialConfigs(prev => {
        const nextConfigs: Record<string, { mode: 'auto' | 'manual'; manualText: string; quantity: number }> = {};
        variants.forEach(v => {
          const prevCfg = prev[v.id];
          const targetQty = (v.stock !== undefined && v.stock >= 0) ? Number(v.stock) : (prevCfg?.quantity ?? 5);
          nextConfigs[v.id] = {
            mode: prevCfg?.mode || 'auto',
            manualText: prevCfg?.manualText || '',
            quantity: targetQty,
          };
        });
        return nextConfigs;
      });
    } else {
      setActiveVariantTab(null);
    }
  }, [variants, hasVariants]);

  // Modals & Submissions
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<{
    productName: string;
    sku: string;
    serials: string[];
    billNumber: string;
    totalAmount: number;
    paymentStatus?: 'pending' | 'paid';
    autoPrint: boolean;
  } | null>(null);

  const CATEGORY_SCHEMAS = useMemo(() => {
    return categorySchemas.reduce((acc, schema) => {
      acc[schema.category] = schema;
      return acc;
    }, {} as Record<string, CategoryAttributeSchema>);
  }, [categorySchemas]);
  const currentCategorySchema = CATEGORY_SCHEMAS[category];

  const availableProductCategories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [products]);

  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = productCategoryFilter === 'All' || p.category === productCategoryFilter;
      const matchesQuery = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                           (p.sku || '').toLowerCase().includes(productSearchQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [products, productCategoryFilter, productSearchQuery]);

  const activeProduct = useMemo(() => {
    if (intakeMode === 'existing') {
      return products.find((p) => p.id === selectedProductId);
    }
    return { name, brand, category, sku };
  }, [intakeMode, selectedProductId, products, name, brand, category, sku]);

  const generatedSerialNumbers = useMemo(() => {
    const baseCode = activeProduct?.sku || sku || 'SN';
    const prefix = customSerialPrefix.trim() || (baseCode.startsWith('SN-') ? baseCode : `SN-${baseCode}`);
    return Array.from({ length: quantity }).map((_, i) => buildSerialNumber(prefix, startSequence + i));
  }, [activeProduct, sku, quantity, startSequence, customSerialPrefix]);

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find((prod) => prod.id === prodId);
    if (p) {
      setName(p.name);
      setBrand(p.brand);
      setCategory(p.category);
      setSku(p.sku || generateProductSKU(p));
      setDescription(p.description || '');
      setImage(p.image || '');
      setSellingPrice(p.price);
      setUnitCost(p.costPrice || Math.round(p.price * 0.8));
      setOriginalPrice(p.originalPrice || '');
      setWarrantyMonths(p.specifications?.warrantyMonths || 36);
      setFeatured(Boolean(p.featured));
      setHasVariants(Boolean(p.isVariable && p.variants && p.variants.length > 0));
      setVariants(p.variants || []);
      setSocket(p.specifications?.socket || '');
      setRamType(p.specifications?.ramType || '');
      setFormFactor(p.specifications?.formFactor || '');
      setTdpWatts(p.specifications?.tdpWatts || '');
      setVramGb(p.specifications?.vramGb || '');
      setPsuWattage(p.specifications?.psuWattage || '');
      setRecPsu(p.specifications?.recommendedPsuWatts || '');
      setStorageType(p.specifications?.storageType || '');
      setStorageCapacity(p.specifications?.storageCapacity || '');
      setReadSpeedMb(p.specifications?.readSpeedMb || '');
      setCoolerType(p.specifications?.coolerType || '');
      setRgbType(p.specifications?.rgbType || 'ARGB');
      if (p.specifications?.customAttributes) {
        setCustomAttributes(p.specifications.customAttributes);
      } else {
        setCustomAttributes({});
      }
    }
  };

  const handleAutoGenerateSku = () => {
    if (!name.trim() || !brand.trim()) {
      alert('Please enter Product Name and Brand first to generate a smart SKU.');
      return;
    }
    const generated = generateProductSKU({ name, brand, category }, products);
    setSku(generated);
  };

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      alert('Please enter a Product Name first.');
      return;
    }
    setIsGeneratingDesc(true);
    try {
      const res = await fetch('/api/ai/generate-product-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, brand, category, price: Number(sellingPrice) || 0,
          specifications: { socket: socket || undefined, ramType: ramType || undefined, formFactor: formFactor || undefined, tdpWatts: tdpWatts ? Number(tdpWatts) : undefined, vramGb: vramGb ? Number(vramGb) : undefined, psuWattage: psuWattage ? Number(psuWattage) : undefined, recommendedPsuWatts: recPsu ? Number(recPsu) : undefined, storageType: storageType || undefined, storageCapacity: storageCapacity || undefined, readSpeedMb: readSpeedMb ? Number(readSpeedMb) : undefined, coolerType: coolerType || undefined, rgbType: rgbType || undefined, ...customAttributes }
        }),
      });
      const data = await res.json();
      if (data.description) setDescription(data.description);
      else throw new Error(data.error || 'Failed to generate');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleAutoFillSpecs = async () => {
    if (!name.trim()) {
      setAutoFillNotice({ message: 'Please enter a Product Title / Model Name before auto-filling specifications.', type: 'warning' });
      setTimeout(() => setAutoFillNotice(null), 3500);
      return;
    }
    setIsAutoFillingSpecs(true);
    setAutoFillNotice(null);
    try {
      const activeSchema = currentCategorySchema;
      const res = await fetch('/api/ai/fetch-hardware-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name, brand, category, schema: activeSchema })
      });
      const data = await res.json();
      if (data.success && (data.specifications || data.specs)) {
         const s = data.specifications || data.specs;
         if (s.socket) setSocket(s.socket);
         if (s.ramType) setRamType(s.ramType);
         if (s.formFactor) setFormFactor(s.formFactor);
         if (s.tdpWatts) setTdpWatts(s.tdpWatts);
         if (s.vramGb) setVramGb(s.vramGb);
         if (s.psuWattage) setPsuWattage(s.psuWattage);
         if (s.recommendedPsuWatts) setRecPsu(s.recommendedPsuWatts);
         if (s.storageType) setStorageType(s.storageType);
         if (s.storageCapacity) setStorageCapacity(s.storageCapacity);
         if (s.readSpeedMb) setReadSpeedMb(s.readSpeedMb);
         if (s.coolerType) setCoolerType(s.coolerType);
         if (s.rgbType) setRgbType(s.rgbType);
         if (s.customAttributes) setCustomAttributes(s.customAttributes);
         setAutoFillNotice({ message: 'Specifications auto-filled successfully!', type: 'success' });
      } else {
         throw new Error(data.error || 'Could not find exact specs');
      }
    } catch (err: any) {
      setAutoFillNotice({ message: err.message || 'Failed to fetch specs', type: 'warning' });
    } finally {
      setIsAutoFillingSpecs(false);
      setTimeout(() => setAutoFillNotice(null), 4000);
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
          setIsCropperOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleAddVariant = () => {
    const parentSku = sku.trim() || 'APX-ITEM';
    const sampleNames = [
      'Black - Forward',
      'White - Forward',
      'Black - Reverse',
      'White - Reverse',
    ];
    const defaultName = sampleNames[variants.length] || `Variant ${variants.length + 1}`;
    const variantCode = generateVariantSku(parentSku, defaultName);
    const newVariantId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newVariant: ProductVariant = {
      id: newVariantId,
      sku: variantCode,
      ean: variantCode,
      name: defaultName,
      color: defaultName.toLowerCase().includes('white') ? 'White' : 'Black',
      colorHex: defaultName.toLowerCase().includes('white') ? '#ffffff' : '#18181b',
      price: Number(sellingPrice) || 0,
      stock: 5,
      image: image,
    };
    setVariants([...variants, newVariant]);
    setVariantSerialConfigs(prev => ({
      ...prev,
      [newVariantId]: {
        mode: 'auto',
        manualText: '',
        quantity: 5,
      },
    }));
  };

  const handleVariantNameChange = (index: number, newName: string) => {
    const copy = [...variants];
    copy[index].name = newName;
    const parentSku = sku.trim() || 'APX-ITEM';
    const variantCode = generateVariantSku(parentSku, newName);
    copy[index].sku = variantCode;
    copy[index].ean = variantCode;
    setVariants(copy);
  };

  const handleUpdateVariantQuantity = (variantId: string, newQty: number) => {
    const safeQty = Math.max(0, newQty);
    setVariants(prev => prev.map(v => v.id === variantId ? { ...v, stock: safeQty } : v));
    setVariantSerialConfigs(prev => ({
      ...prev,
      [variantId]: {
        ...(prev[variantId] || { mode: 'auto', manualText: '' }),
        quantity: safeQty,
      },
    }));
  };

  const handleRemoveVariant = (variantId: string) => {
    setVariants(prev => prev.filter(v => v.id !== variantId));
    setVariantSerialConfigs(prev => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };

  const activeVendor = customVendor.trim() || vendorName;
  const costNum = Number(unitCost) || 0;
  const sellNum = Number(sellingPrice) || 0;
  const derivedQuantity = (hasVariants && variants.length > 0)
    ? variants.reduce((sum, v) => {
        const cfgQty = variantSerialConfigs[v.id]?.quantity;
        const vQty = (cfgQty !== undefined && cfgQty !== null) ? Number(cfgQty) : (Number(v.stock) || 0);
        return sum + vQty;
      }, 0)
    : quantity;
  const totalBillPkr = costNum * derivedQuantity;
  const marginPerUnit = sellNum - costNum;
  const marginPercent = sellNum > 0 ? Math.round((marginPerUnit / sellNum) * 100) : 0;

  const handleSubmitIntake = async (autoPrint: boolean = false) => {
    let finalSerials: string[] = [];
    let variantSerialsPayload: any[] = [];
    let computedTotalQuantity = quantity;

    if (hasVariants && variants.length > 0) {
      computedTotalQuantity = 0;
      for (const v of variants) {
         const cfg = variantSerialConfigs[v.id];
         const vQty = cfg ? cfg.quantity : (v.stock ?? 5);
         computedTotalQuantity += vQty;
         
         const baseCode = v.sku || generateVariantSku(sku, v.name);
         const prefix = customSerialPrefix.trim() || (baseCode.startsWith('SN-') ? baseCode : `SN-${baseCode}`);
         
         // Each variant starts its sequence independently from startSequence (e.g. 001) with date batch
         const vSerials = (!cfg || cfg.mode === 'auto')
           ? Array.from({ length: vQty }).map((_, i) => buildSerialNumber(prefix, startSequence + i))
           : cfg.manualText.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
           
         if (cfg?.mode === 'manual' && vSerials.length !== vQty) {
           alert(`Variant "${v.name}" expects ${vQty} serials but got ${vSerials.length}.`);
           return;
         }
         
         variantSerialsPayload.push({
           variantId: v.id,
           variantName: v.name,
           variantSku: baseCode,
           serials: vSerials,
         });
         finalSerials = finalSerials.concat(vSerials);
      }
    } else {
      finalSerials = serialEntryMode === 'auto' 
        ? generatedSerialNumbers 
        : manualSerialsText.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

      if (serialEntryMode === 'manual' && finalSerials.length !== quantity) {
        alert(`You provided ${finalSerials.length} manual serial numbers, but intake quantity is ${quantity}. Please match the exact quantity.`);
        return;
      }
    }

    if (intakeMode === 'new' && (!name.trim() || !brand.trim())) {
      alert('Please provide Product Name and Brand.');
      return;
    }
    if (intakeMode === 'existing' && !selectedProductId) {
      alert('Please select an existing product or switch to "New Product".');
      return;
    }
    if (costNum <= 0 || sellNum <= 0) {
      alert('Please enter valid Cost Price and Retail Price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetSku = sku.trim() || (activeProduct?.sku ? activeProduct.sku : generateProductSKU({ name, brand, category }, products));
      const cleanSpecs: any = {
        warrantyMonths,
        ...customAttributes,
        customAttributes: customAttributes,
      };
      if (socket) cleanSpecs.socket = socket;
      if (ramType) cleanSpecs.ramType = ramType;
      if (formFactor) cleanSpecs.formFactor = formFactor;
      if (tdpWatts) cleanSpecs.tdpWatts = Number(tdpWatts);
      if (vramGb) cleanSpecs.vramGb = Number(vramGb);
      if (psuWattage) cleanSpecs.psuWattage = Number(psuWattage);
      if (recPsu) cleanSpecs.recommendedPsuWatts = Number(recPsu);
      if (storageType) cleanSpecs.storageType = storageType;
      if (storageCapacity) cleanSpecs.storageCapacity = storageCapacity;
      if (readSpeedMb) cleanSpecs.readSpeedMb = Number(readSpeedMb);
      if (coolerType) cleanSpecs.coolerType = coolerType;
      if (rgbType) cleanSpecs.rgbType = rgbType;

      const existingVendors = erpStorage.getVendors();
      const existingMatch = existingVendors.find(
        (v) =>
          v.name.trim().toLowerCase() === activeVendor.trim().toLowerCase() ||
          v.companyName.trim().toLowerCase() === activeVendor.trim().toLowerCase()
      );
      if (!existingMatch) {
        const newVend = {
          id: 'vend-' + Date.now(),
          name: activeVendor.trim(),
          companyName: activeVendor.trim(),
          contactPerson: 'Sales Desk',
          email: '',
          phone: '+92 42 35789901',
          city: 'Lahore',
          address: 'Hafeez Centre Market Channel, Lahore',
          ntn: '7829103-4',
          isFiler: true,
          paymentTermsDays: 30,
          currentPayableBalancePkr: paymentStatus === 'paid' ? 0 : totalBillPkr,
          totalPurchasesPkr: totalBillPkr,
          productCategoriesSupplied: [category],
          createdAt: new Date().toISOString(),
        };
        erpStorage.saveVendor(newVend);
        authFetch('/api/erp/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newVend),
        }).catch(() => {});
        window.dispatchEvent(new CustomEvent('apex:vendors_updated', { detail: newVend }));
      }

      const payload = {
        product: {
          id: intakeMode === 'existing' ? selectedProductId : undefined,
          name: intakeMode === 'existing' && activeProduct ? activeProduct.name : name,
          brand: intakeMode === 'existing' && activeProduct ? activeProduct.brand : brand,
          category: intakeMode === 'existing' && activeProduct ? activeProduct.category : category,
          sku: targetSku,
          price: sellNum,
          costPrice: costNum,
          originalPrice: originalPrice ? Number(originalPrice) : undefined,
          description: description.trim() || `${brand} ${name} high-grade gaming component.`,
          image: image || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=60',
          featured,
          isVariable: hasVariants && variants.length > 0,
          variants: hasVariants ? variants.map(v => {
            const cfg = variantSerialConfigs[v.id];
            const vQty = cfg?.quantity !== undefined ? cfg.quantity : (v.stock ?? 5);
            const vSerials = variantSerialsPayload.find(p => p.variantId === v.id)?.serials || [];
            const variantCode = v.sku || generateVariantSku(targetSku, v.name);
            return {
              ...v,
              sku: variantCode,
              ean: variantCode,
              stock: vQty,
              serialNumber: vSerials[0] || v.serialNumber,
              serialNumbers: vSerials,
            };
          }) : [],
          specifications: cleanSpecs,
        },
        vendorName: activeVendor,
        billNumber: billNumber.trim() || `BILL-${Date.now()}`,
        quantity: computedTotalQuantity,
        unitCost: costNum,
        sellingPrice: sellNum,
        generatedSerials: finalSerials,
        variantSerials: variantSerialsPayload,
        warrantyMonths,
        paymentStatus,
        autoPrint,
      };

      await onCompleteIntake(payload);

      setSuccessModalData({
        productName: payload.product.name || 'Component',
        sku: targetSku,
        serials: finalSerials,
        billNumber: payload.billNumber,
        totalAmount: totalBillPkr,
        paymentStatus,
        autoPrint,
      });
    } catch (err: any) {
      console.error('Failed fast intake:', err);
      alert('Error during intake: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback image suggestions for current category
  const categoryImageSuggestions = useMemo((): string[] => {
    const preset = CATEGORY_FALLBACK_IMAGES[category];
    const base = [
      'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80',
    ];
    return preset ? [preset, ...base] : base;
  }, [category]);

  const catLower = category.toLowerCase();
  const isCpu = catLower.includes('processor') || catLower.includes('cpu');
  const isGpu = catLower.includes('graphic') || catLower.includes('gpu');
  const isMobo = catLower.includes('motherboard');
  const isVarMode = hasVariants && variants.length > 0 && activeVariantTab && variantSerialConfigs[activeVariantTab];
  const isRam = catLower.includes('ram') || catLower.includes('memory');
  const isStorage = catLower.includes('storage') || catLower.includes('ssd') || catLower.includes('hdd');
  const isPsu = catLower.includes('power supply') || catLower.includes('psu');
  const isCooler = catLower.includes('cooler') || catLower.includes('fan');
  const isCasing = catLower.includes('casing') || catLower.includes('case');

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/20 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold border border-amber-500/30 shrink-0">
            <PackagePlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                Fast-Intake & 1-Click Purchase Bill Station
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Re-scanning & No BarTender Needed</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create complete catalog products, receive supplier shipments, generate sequential S/N stickers, print thermal labels, and post the bill in 1 click.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/10 text-xs font-bold">
          <button
            type="button"
            onClick={() => setIntakeMode('new')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              intakeMode === 'new'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Full New Product</span>
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode('existing')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              intakeMode === 'existing'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stock Existing Product</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Intake Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Full Product Definition, Specs, Images & Vendor Billing (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Item Details Card */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>1. Product Identity & Category</span>
              </span>
              <span className="text-[11px] text-slate-400">Step 1 of 4</span>
            </div>

            {intakeMode === 'existing' ? (
              <div className="space-y-3 p-3.5 bg-slate-950/70 rounded-xl border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    <span>Select Existing Catalog Product to Stock:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Showing <strong className="text-white">{filteredCatalogProducts.length}</strong> of {products.length} Products
                  </span>
                </div>

                {/* Filter and Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {/* Category Filter Dropdown */}
                  <div className="sm:col-span-5 relative">
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:border-amber-400 focus:outline-none appearance-none"
                    >
                      <option value="All">All Categories ({products.length})</option>
                      {availableProductCategories.map((cat) => {
                        const count = products.filter((p) => p.category === cat).length;
                        return (
                          <option key={cat} value={cat}>
                            {cat} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Search Query Input */}
                  <div className="sm:col-span-7 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Search model, brand, SKU..."
                      className="w-full h-9 pl-8 pr-7 rounded-lg bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                    {productSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setProductSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Products Dropdown Selector */}
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="">-- Choose Product ({filteredCatalogProducts.length} available) --</option>
                  {filteredCatalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category}] {p.brand} - {p.name} (SKU: {p.sku || 'N/A'}) — In-Stock: {p.stockCount ?? 0}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Product Basic Fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Product Title / Model Name: *</label>
                    <button
                      type="button"
                      onClick={handleAutoFillSpecs}
                      disabled={isAutoFillingSpecs}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer disabled:opacity-50"
                      title="Auto-fill hardware specifications & compatibility using Gemini AI"
                    >
                      {isAutoFillingSpecs ? (
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                      )}
                      <span>{isAutoFillingSpecs ? 'Auto-Filling...' : 'AI Auto-Fill Specs'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Prism 8 ARGB 120mm PWM Fan 3-Pack"
                    className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl px-3 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Brand / Manufacturer: *</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Lian Li, Corsair, Kingston, ASUS"
                    className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl px-3 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Product Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">EAN / Model SKU:</label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateSku}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-Generate SKU
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. LL-PRI-120-3PK"
                    className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl px-3 font-mono text-xs text-amber-300 font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description & AI Generator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Product Description:</label>
                  <button
                    type="button"
                    disabled={isGeneratingDesc}
                    onClick={handleGenerateDescription}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isGeneratingDesc ? 'Generating AI Description...' : 'AI Auto-Describe'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed hardware product description, key highlights, or feature list..."
                  className="w-full p-2.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none resize-none"
                />
              </div>

              {/* Product Image & Upload */}
              <div className="space-y-2 pt-1 border-t border-white/10">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Product Image & Media:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">URL, File Upload or Category Presets</span>
                </label>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-950 border border-white/15 overflow-hidden shrink-0 flex items-center justify-center relative group">
                    {image ? (
                      <>
                        <img src={image} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setIsCropperOpen(true)}
                          title="Adjust / Crop Frame"
                          className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-blue-400 transition-opacity cursor-pointer"
                        >
                          <Crop className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="Paste Image URL (https://...)"
                      className="w-full h-8 bg-slate-950 border border-white/15 rounded-lg px-2.5 text-xs text-slate-300 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        ref={intakeFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => intakeFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3 h-3 text-blue-400" />
                        <span>Upload File</span>
                      </button>
                      {image && (
                        <button
                          type="button"
                          onClick={() => setIsCropperOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-blue-500/30"
                          title="Adjust / Crop Framing"
                        >
                          <Crop className="w-3 h-3" />
                          <span>Crop & Frame</span>
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {categoryImageSuggestions.map((imgUrl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setImage(imgUrl)}
                            className="w-6 h-6 rounded-md border border-white/20 overflow-hidden hover:scale-110 transition-transform cursor-pointer shrink-0"
                            title={`Use preset photo #${idx + 1}`}
                          >
                            <img src={imgUrl} alt="preset" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Featured & Variable Flags */}
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/20 focus:ring-0"
                  />
                  <span className="flex items-center gap-1 font-bold">
                    <Star className="w-3.5 h-3.5 text-amber-400" /> Featured on Homepage & Deals
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => {
                      setHasVariants(e.target.checked);
                      if (e.target.checked && variants.length === 0) {
                        handleAddVariant();
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/20 focus:ring-0"
                  />
                  <span className="flex items-center gap-1 font-bold">
                    <Boxes className="w-3.5 h-3.5 text-purple-400" /> Has Variants (Colors / Capacity)
                  </span>
                </label>
              </div>

              {/* Variants Mini Builder if Enabled */}
              {hasVariants && (
                <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5" /> Product Variants ({variants.length})
                      </span>
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        Total: {derivedQuantity} units
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded-lg border border-purple-500/20 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add Variant
                    </button>
                  </div>

                  {variants.length > 0 && (
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      <div className="col-span-4">Variant Name</div>
                      <div className="col-span-3">Variant EAN (Auto-Derived)</div>
                      <div className="col-span-2">Price (PKR)</div>
                      <div className="col-span-2 text-amber-400">Intake Qty</div>
                      <div className="col-span-1 text-center">Del</div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {variants.map((v, index) => {
                      const dynamicEan = v.ean || v.sku || generateVariantSku(sku, v.name);
                      const currentQty = v.stock ?? variantSerialConfigs[v.id]?.quantity ?? 5;
                      return (
                        <div
                          key={v.id}
                          className="grid grid-cols-12 gap-2 p-2 rounded-lg bg-slate-900 border border-white/10 items-center text-xs"
                        >
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={v.name}
                              onChange={(e) => handleVariantNameChange(index, e.target.value)}
                              placeholder="e.g. Black - Forward"
                              className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              readOnly
                              value={dynamicEan}
                              title="Dynamic EAN automatically pointing to variant name"
                              className="w-full bg-slate-950/70 border border-purple-500/30 rounded px-2 py-1 font-mono text-purple-300 text-xs select-all cursor-not-allowed truncate"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={v.price}
                              onChange={(e) => {
                                const copy = [...variants];
                                copy[index].price = Number(e.target.value) || 0;
                                setVariants(copy);
                              }}
                              placeholder="Price"
                              className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-white text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min={0}
                              value={currentQty}
                              onChange={(e) => handleUpdateVariantQuantity(v.id, parseInt(e.target.value, 10) || 0)}
                              placeholder="Qty"
                              className="w-full bg-slate-950 border border-amber-500/40 rounded px-2 py-1 text-amber-300 font-bold text-xs"
                            />
                          </div>
                          <div className="col-span-1 text-center flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(v.id)}
                              className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                              title="Remove variant"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Hardware Technical Specifications (Accordion) */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3">
            <div
              onClick={() => setShowSpecsSection(!showSpecsSection)}
              className="flex items-center justify-between cursor-pointer select-none border-b border-white/10 pb-2"
            >
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>2. Hardware Specifications & Compatibility</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAutoFillSpecs();
                  }}
                  disabled={isAutoFillingSpecs}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Use Gemini AI to verify and fill hardware specifications, sockets, wattage, form factor & custom attributes"
                >
                  {isAutoFillingSpecs ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-200" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                  )}
                  <span>{isAutoFillingSpecs ? 'AI Verifying Specs...' : 'AI Auto-Fill Specs'}</span>
                </button>
                <span className="hidden sm:inline-flex text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  PC Builder Compatible
                </span>
                {showSpecsSection ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {showSpecsSection && (
              <div className="space-y-3 pt-1 animate-in fade-in">
                {/* AI Auto-Fill Specs Notice / Status Banner */}
                {autoFillNotice && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center justify-between border transition-all ${
                      autoFillNotice.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span className="font-medium">{autoFillNotice.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoFillNotice(null)}
                      className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {/* Dynamic Category Specific Fields */}
                {(isCpu || isMobo || isCooler) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">CPU Socket Compatibility:</label>
                      <select
                        value={socket}
                        onChange={(e) => setSocket(e.target.value as CpuSocket)}
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Select Socket --</option>
                        <option value="AM5">AMD AM5 (Ryzen 7000 / 8000 / 9000)</option>
                        <option value="AM4">AMD AM4 (Ryzen 3000 / 5000)</option>
                        <option value="LGA1700">Intel LGA1700 (12th / 13th / 14th Gen)</option>
                        <option value="LGA1851">Intel LGA1851 (Core Ultra 200)</option>
                        <option value="LGA1200">Intel LGA1200 (10th / 11th Gen)</option>
                        <option value="Other">Other / Universal</option>
                      </select>
                    </div>

                    {(isCpu || isGpu) && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">TDP / Power Draw (Watts):</label>
                        <input
                          type="number"
                          value={tdpWatts}
                          onChange={(e) => setTdpWatts(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 65, 105, 170, 250"
                          className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 font-mono text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {(isRam || isMobo) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">RAM Generation / Memory Type:</label>
                      <select
                        value={ramType}
                        onChange={(e) => setRamType(e.target.value as RamType)}
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Select RAM Type --</option>
                        <option value="DDR5">DDR5 High Speed</option>
                        <option value="DDR4">DDR4 Standard</option>
                      </select>
                    </div>

                    {isMobo && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">Motherboard Form Factor:</label>
                        <select
                          value={formFactor}
                          onChange={(e) => setFormFactor(e.target.value as FormFactor)}
                          className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                        >
                          <option value="">-- Select Form Factor --</option>
                          <option value="ATX">ATX (Standard Size)</option>
                          <option value="Micro-ATX">Micro-ATX (Compact)</option>
                          <option value="Mini-ITX">Mini-ITX (SFF)</option>
                          <option value="E-ATX">E-ATX (Extended)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {isGpu && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">VRAM Buffer (GB):</label>
                      <input
                        type="number"
                        value={vramGb}
                        onChange={(e) => setVramGb(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 8, 12, 16, 24"
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Recommended PSU (Watts):</label>
                      <input
                        type="number"
                        value={recPsu}
                        onChange={(e) => setRecPsu(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 650, 750, 850"
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {isPsu && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Rated Output (Watts):</label>
                      <input
                        type="number"
                        value={psuWattage}
                        onChange={(e) => setPsuWattage(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 650, 750, 850, 1000"
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Efficiency Rating:</label>
                      <select className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none">
                        <option value="80+ Gold">80+ Gold Certified</option>
                        <option value="80+ Bronze">80+ Bronze Certified</option>
                        <option value="80+ Platinum">80+ Platinum</option>
                      </select>
                    </div>
                  </div>
                )}

                {isCooler && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Cooler / Radiator Type:</label>
                      <select
                        value={coolerType}
                        onChange={(e) => setCoolerType(e.target.value)}
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Choose Type --</option>
                        <option value="360mm AIO">360mm AIO Liquid Cooler</option>
                        <option value="240mm AIO">240mm AIO Liquid Cooler</option>
                        <option value="Air Cooler">Dual-Tower Air Cooler</option>
                        <option value="120mm PWM Fan">120mm PWM Chassis Fan</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Lighting / RGB Style:</label>
                      <select
                        value={rgbType}
                        onChange={(e) => setRgbType(e.target.value as any)}
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="ARGB">3-Pin 5V ARGB (Addressable)</option>
                        <option value="Auto-RGB">Auto-RGB (Static Cycling)</option>
                        <option value="Non-RGB">Non-RGB (Black Stealth / White)</option>
                      </select>
                    </div>
                  </div>
                )}

                {isStorage && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Storage Interface / Type:</label>
                      <select
                        value={storageType}
                        onChange={(e) => setStorageType(e.target.value)}
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Choose Interface --</option>
                        <option value="NVMe PCIe 5.0">NVMe PCIe 5.0 M.2</option>
                        <option value="NVMe PCIe 4.0">NVMe PCIe 4.0 M.2</option>
                        <option value="NVMe PCIe 3.0">NVMe PCIe 3.0 M.2</option>
                        <option value="SATA 2.5 SSD">SATA 2.5" SSD</option>
                        <option value="SATA 3.5 HDD">SATA 3.5" HDD</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Capacity:</label>
                      <input
                        type="text"
                        value={storageCapacity}
                        onChange={(e) => setStorageCapacity(e.target.value)}
                        placeholder="e.g. 1TB, 2TB, 500GB"
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">Read Speed (MB/s):</label>
                      <input
                        type="number"
                        value={readSpeedMb}
                        onChange={(e) => setReadSpeedMb(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 7450, 5000, 3500"
                        className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Category Dynamic Schema Attribute Fields */}
                {currentCategorySchema && currentCategorySchema.attributes && currentCategorySchema.attributes.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>{category} Specific Attributes ({currentCategorySchema.attributes.length} fields)</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {currentCategorySchema.attributes.map((attr) => {
                        const val = customAttributes[attr.id] !== undefined ? customAttributes[attr.id] : '';

                        return (
                          <div key={attr.id} className="space-y-1">
                            <label className="text-slate-300 font-medium text-[11px] flex items-center justify-between">
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
                                  setCustomAttributes((prev) => ({
                                    ...prev,
                                    [attr.id]: e.target.value,
                                  }))
                                }
                                className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                              >
                                <option value="">Select {attr.name}...</option>
                                {attr.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : attr.type === 'boolean' ? (
                              <label className="flex items-center gap-2 h-9 px-2.5 rounded-xl bg-slate-950 border border-white/15 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={Boolean(val)}
                                  onChange={(e) =>
                                    setCustomAttributes((prev) => ({
                                      ...prev,
                                      [attr.id]: e.target.checked,
                                    }))
                                  }
                                  className="w-4 h-4 rounded accent-amber-500"
                                />
                                <span className="text-slate-300">{val ? 'Yes / Supported' : 'No / Unsupported'}</span>
                              </label>
                            ) : attr.type === 'number' ? (
                              <input
                                type="number"
                                value={val}
                                onChange={(e) =>
                                  setCustomAttributes((prev) => ({
                                    ...prev,
                                    [attr.id]: e.target.value ? Number(e.target.value) : '',
                                  }))
                                }
                                placeholder={attr.placeholder || (attr.unit ? `e.g. 5000 ${attr.unit}` : 'e.g. 100')}
                                className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={val}
                                onChange={(e) =>
                                  setCustomAttributes((prev) => ({
                                    ...prev,
                                    [attr.id]: e.target.value,
                                  }))
                                }
                                placeholder={attr.placeholder || `Enter ${attr.name.toLowerCase()}...`}
                                className="w-full h-9 bg-slate-950 border border-white/15 rounded-xl px-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                              />
                            )}

                            {attr.helpText && (
                              <p className="text-[10px] text-slate-400 leading-tight">{attr.helpText}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Vendor & Accounts Payable Billing Card */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>3. Vendor Shipment & Accounts Payable</span>
              </span>
              <span className="text-[11px] text-slate-400">Step 3 of 4</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Supplier / Vendor:</label>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ✓ {vendorsList.length} suppliers synced
                  </span>
                </div>
                <select
                  value={vendorName}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    if (e.target.value !== 'Other') setCustomVendor('');
                  }}
                  className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl px-3 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  {vendorsList.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value="Other">+ Custom / New Vendor...</option>
                </select>
                {vendorName === 'Other' && (
                  <input
                    type="text"
                    value={customVendor}
                    onChange={(e) => setCustomVendor(e.target.value)}
                    placeholder="Enter Vendor Name (e.g. Royal Importers)"
                    className="w-full h-9 mt-1.5 bg-slate-950 border border-amber-500/40 rounded-xl px-3 text-xs text-white focus:outline-none"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Vendor Invoice / Bill #:</label>
                <input
                  type="text"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="e.g. BILL-2026-8942"
                  className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl px-3 font-mono text-xs text-blue-300 font-bold focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Financials Row: Landed Cost vs Selling Price & Projected Margin */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Unit Landed Cost (PKR) *</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Rs.</span>
                  <input
                    type="number"
                    min={0}
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="2800"
                    className="w-full font-mono font-black text-sm text-white bg-transparent outline-none"
                  />
                </div>
                <span className="text-[9.5px] text-slate-500">Paid to Vendor</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/20 space-y-1">
                <label className="text-[11px] font-bold text-amber-400 uppercase">Retail Price (PKR) *</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-500">Rs.</span>
                  <input
                    type="number"
                    min={0}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="4200"
                    className="w-full font-mono font-black text-sm text-amber-300 bg-transparent outline-none"
                  />
                </div>
                <span className="text-[9.5px] text-amber-400/70">Store Shelf Tag</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 space-y-1 flex flex-col justify-between">
                <label className="text-[11px] font-bold text-emerald-400 uppercase">Unit Margin & Markup</label>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-emerald-400">+{formatPkr(marginPerUnit)}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {marginPercent}%
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-500">Gross Margin</span>
              </div>
            </div>

            {/* Official Warranty Cover */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Warranty Cover Duration:</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[0, 1, 3, 6, 10, 12, 24, 36].map((m) => {
                  const label = m === 0 ? 'Testing Only' : (m === 12 ? '1Y' : m === 24 ? '2Y' : m === 36 ? '3Y' : `${m}M`);
                  return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWarrantyMonths(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      warrantyMonths === m
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Bill Summary + Sequential S/N Queue + 1-Click Execution (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 4. Batch Quantity & S/N Range Engine */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-400" />
                <span>4. Quantity & S/N Sequence Engine</span>
              </span>
              <span className="text-[11px] text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {derivedQuantity} Units to Stock
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantity Stepper */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>{hasVariants && variants.length > 0 ? 'Total Variant Quantity:' : 'Quantity to Intake:'}</span>
                  {(!hasVariants || variants.length === 0) && (
                    <div className="flex items-center gap-1">
                      {[5, 10, 20, 50].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantity(q)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            quantity === q ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                {hasVariants && variants.length > 0 ? (
                  <div className="h-10 px-3 bg-slate-950 border border-purple-500/30 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-purple-300 font-medium">Configured across variants:</span>
                    <span className="font-mono font-black text-amber-300 text-base">{derivedQuantity} Units Total</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                      className="w-full h-10 bg-slate-950 border border-white/15 rounded-xl text-center font-mono font-black text-amber-300 text-base focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(500, q + 1))}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Start Sequence Index */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Start Sequence Index:</span>
                  <span className="text-[10px] text-amber-400 font-mono">
                    #{startSequence} to #{startSequence + quantity - 1}
                  </span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={startSequence}
                  onChange={(e) => setStartSequence(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="1"
                  className="w-full h-10 bg-slate-950 border border-amber-500/30 rounded-xl px-3 font-mono text-sm text-amber-300 font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Purchase Bill & Accounting Ledger Summary */}
          <div className="p-5 bg-gradient-to-b from-slate-900 to-slate-950 border border-white/15 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Auto-Generated Bill Preview</span>
              </span>
              <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {billNumber}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Supplier:</span>
                <span className="font-bold text-white max-w-[200px] truncate">{activeVendor}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Target Product:</span>
                <span className="font-bold text-white max-w-[200px] truncate">
                  {name || activeProduct?.name || 'Hardware Unit'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-slate-400 font-sans">SKU / EAN:</span>
                <span className="font-bold text-amber-300 bg-amber-500/10 px-1.5 rounded">
                  {sku || activeProduct?.sku || 'SKU-TEMP'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-slate-400 font-sans">Intake Quantity:</span>
                <span className="font-bold text-white">{derivedQuantity} Units</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-slate-400 font-sans">Unit Landed Cost:</span>
                <span className="text-white">{formatPkr(costNum)}</span>
              </div>

              {/* Payment Settlement Status Toggle */}
              <div className="py-2 border-b border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Payment Settlement:</span>
                  <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[10px] ${
                    paymentStatus === 'paid' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {paymentStatus === 'paid' ? 'PAID IMMEDIATELY' : 'PENDING / CREDIT (ON ACCOUNT)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('pending')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      paymentStatus === 'pending'
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Pending / Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Paid Immediately
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 italic px-0.5">
                  {paymentStatus === 'paid'
                    ? 'Bill is logged as settled; supplier payable balance is 0.'
                    : 'Bill remains open as payable to the supplier (due in 30 days).'}
                </p>
              </div>

              <div className="flex justify-between py-2 bg-amber-500/10 -mx-2 px-2 rounded-xl border border-amber-500/20">
                <span className="font-bold text-amber-300">
                  {paymentStatus === 'paid' ? 'Total Paid Amount:' : 'Total Purchase Payable:'}
                </span>
                <span className="font-mono font-black text-amber-300 text-sm">{formatPkr(totalBillPkr)}</span>
              </div>
            </div>

                        {/* Serial Numbers Configuration */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Serial Numbers Setup</span>
                </span>
              </div>
              
              {hasVariants && variants.length > 0 && (
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setActiveVariantTab(v.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeVariantTab === v.id ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const isVarModeInner = hasVariants && variants.length > 0 && activeVariantTab && variantSerialConfigs[activeVariantTab];
                const activeCfg = isVarModeInner ? variantSerialConfigs[activeVariantTab] : { mode: serialEntryMode, manualText: manualSerialsText, quantity: quantity };
                
                const setMode = (mode) => {
                  if (isVarModeInner) {
                    setVariantSerialConfigs(prev => ({ ...prev, [activeVariantTab]: { ...prev[activeVariantTab], mode } }));
                  } else {
                    setSerialEntryMode(mode);
                  }
                };
                
                const setText = (text) => {
                  if (isVarModeInner) {
                    setVariantSerialConfigs(prev => ({ ...prev, [activeVariantTab]: { ...prev[activeVariantTab], manualText: text } }));
                  } else {
                    setManualSerialsText(text);
                  }
                };
                
                const activeQuantity = activeCfg.quantity;
                
                // Active Variant auto-generation
                let autoGens = generatedSerialNumbers;
                if (isVarModeInner) {
                  const activeVar = variants.find(v => v.id === activeVariantTab);
                  const baseCode = activeVar?.sku || generateVariantSku(sku, activeVar?.name || 'VAR');
                  const prefix = customSerialPrefix.trim() || (baseCode.startsWith('SN-') ? baseCode : `SN-${baseCode}`);
                  // Each variant has its own independent sequence starting from startSequence with date batch
                  autoGens = Array.from({ length: activeQuantity }).map((_, i) => buildSerialNumber(prefix, startSequence + i));
                }

                return (
                  <>
                    <div className="mb-3 p-3 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          {isVarModeInner ? 'Variant EAN / Barcode (Auto-Derived)' : 'EAN (European Article Number)'}
                        </label>
                        {isVarModeInner && (
                          <span className="text-[9px] font-mono text-purple-400 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-500/30">
                            Auto from Variant Name
                          </span>
                        )}
                      </div>
                      <input 
                        type="text"
                        readOnly={Boolean(isVarModeInner)}
                        value={isVarModeInner ? (variants.find(v => v.id === activeVariantTab)?.ean || variants.find(v => v.id === activeVariantTab)?.sku || generateVariantSku(sku, variants.find(v => v.id === activeVariantTab)?.name || '')) : (customAttributes.ean || '')}
                        onChange={(e) => {
                          if (!isVarModeInner) {
                            setCustomAttributes(prev => ({ ...prev, ean: e.target.value }));
                          }
                        }}
                        placeholder="e.g. APX-FAN-PRISM-ARGB-BF"
                        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs font-mono ${isVarModeInner ? 'border-purple-500/30 text-purple-300 select-all cursor-not-allowed' : 'border-white/10 text-white focus:ring-1 focus:ring-amber-500'}`}
                      />
                    </div>

                    {isVarModeInner && (
                      <div className="mb-3 p-3 rounded-xl bg-slate-900 border border-purple-500/20 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-white block">
                            Intake Qty for {variants.find(v => v.id === activeVariantTab)?.name}:
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Units to receive & generate serial numbers for
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={activeQuantity}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              handleUpdateVariantQuantity(activeVariantTab, val);
                            }}
                            className="w-20 bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-center text-sm font-bold text-amber-300 focus:ring-1 focus:ring-amber-500"
                          />
                          <span className="text-xs text-slate-400 font-medium">units</span>
                        </div>
                      </div>
                    )}
                  
                    <div className="flex items-center gap-2 mb-2 bg-slate-900 p-1 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setMode('auto')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeCfg.mode === 'auto' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                      >Auto-Generate</button>
                      <button
                        type="button"
                        onClick={() => setMode('manual')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeCfg.mode === 'manual' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                      >Manual Entry</button>
                    </div>
                    {activeCfg.mode === 'auto' ? (
                      <>
                        <div className="flex items-center justify-between text-xs mt-2">
                          <span className="font-bold text-slate-400 flex items-center gap-1.5">
                            <span>Preview Queue ({autoGens.length})</span>
                          </span>
                          <span className="text-[10px] text-slate-400">Ready to Print</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto bg-slate-950 p-2 rounded-xl border border-white/10 space-y-1 custom-scrollbar">
                          {autoGens.map((sn, idx) => (
                            <div
                              key={sn}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/90 border border-white/5 font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-bold">#{idx + 1}</span>
                                <span className="text-amber-300 font-bold">{sn}</span>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-semibold">{warrantyMonths === 0 ? 'Testing Only' : (warrantyMonths === 12 ? '1Y Warr' : warrantyMonths === 24 ? '2Y Warr' : warrantyMonths === 36 ? '3Y Warr' : `${warrantyMonths}M Warr`)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 mt-2">
                         <div className="flex items-center justify-between text-[10px]">
                           <span className="text-slate-400">Paste serials (one per line/comma separated).</span>
                           <span className={`font-bold ${activeCfg.manualText.split(/[\\n,]+/).map(s=>s.trim()).filter(s=>s.length > 0).length === activeQuantity ? 'text-emerald-400' : 'text-rose-400'}`}>
                             Count: {activeCfg.manualText.split(/[\\n,]+/).map(s=>s.trim()).filter(s=>s.length > 0).length} / {activeQuantity}
                           </span>
                         </div>
                         <textarea
                            value={activeCfg.manualText}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={`SN-0001\nSN-0002\n...`}
                            className="w-full h-32 bg-slate-950 border border-white/10 rounded-xl p-3 text-amber-300 font-mono text-xs focus:ring-1 focus:ring-amber-500 custom-scrollbar"
                         />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {/* ACTION BUTTONS: 1-Click Receive & Print Labels */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitIntake(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>Receive, Post Bill & Print {derivedQuantity} Thermal Labels</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitIntake(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Receive, Save Product & Post Bill (Skip Print)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS MODAL & DIRECT PRINT LAUNCHER */}
      {successModalData && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Product Created & Intake Completed!
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {successModalData.serials.length} units stocked under {successModalData.billNumber}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <span className="font-bold text-white">{successModalData.productName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400 font-sans">SKU / EAN:</span>
                <span className="text-amber-300 font-bold">{successModalData.sku}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400 font-sans">Purchase Bill Total:</span>
                <span className="text-emerald-400 font-black">{formatPkr(successModalData.totalAmount)}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400 font-sans">Payment Status:</span>
                <span className={`font-bold ${
                  successModalData.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-amber-300'
                }`}>
                  {successModalData.paymentStatus === 'paid' ? 'PAID IMMEDIATELY' : 'PENDING (ON CREDIT)'}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400 font-sans">Sequential S/Ns:</span>
                <span className="text-slate-300 font-bold">{successModalData.serials.length} Items</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  // Reset form for next entry
                  setName('');
                  setBrand('');
                  setSku('');
                  setDescription('');
                  setBillNumber(`BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
                }}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
              >
                Done & Next Intake
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Interactive Image Cropping & Framing Modal */}
      <ImageCropModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        imageUrl={image}
        title="Crop & Frame Intake Image"
        defaultAspectRatio="1:1"
        onCropComplete={async (croppedUrl) => {
          setImage(croppedUrl);
          setIsCropperOpen(false);
          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: croppedUrl, name: `intake-${Date.now()}.webp` }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.url) {
                setImage(data.url);
              }
            }
          } catch (err) {
            console.warn('Persisted locally as data URL', err);
          }
        }}
      />
    </div>
  );
};
