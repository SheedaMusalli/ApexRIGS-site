import { CategoryAttributeSchema } from '../types';

export const DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS: CategoryAttributeSchema[] = [
  {
    id: 'schema-cpu',
    category: 'Processor',
    description: 'Specifications for CPUs and Processors',
    attributes: [
      { id: 'socket', name: 'Socket', type: 'select', options: ['AM4', 'AM5', 'LGA1700', 'LGA1851', 'LGA1200'], required: true, displayInOverview: true },
      { id: 'cores_threads', name: 'Cores / Threads', type: 'text', placeholder: 'e.g. 8 Cores / 16 Threads', required: true, displayInOverview: true },
      { id: 'base_clock', name: 'Base Clock', type: 'text', unit: 'GHz', placeholder: '3.8' },
      { id: 'boost_clock', name: 'Boost Clock', type: 'text', unit: 'GHz', placeholder: '5.3', displayInOverview: true },
      { id: 'tdp', name: 'TDP / Power Consumption', type: 'number', unit: 'W', placeholder: '105' },
    ],
  },
  {
    id: 'schema-mobo',
    category: 'Motherboard',
    description: 'Motherboard Chipset and Compatibility',
    attributes: [
      { id: 'socket', name: 'Socket Support', type: 'select', options: ['AM4', 'AM5', 'LGA1700', 'LGA1851', 'LGA1200'], required: true, displayInOverview: true },
      { id: 'formFactor', name: 'Form Factor', type: 'select', options: ['ATX', 'Micro-ATX', 'Mini-ITX', 'E-ATX'], required: true, displayInOverview: true },
      { id: 'ramType', name: 'Memory Type', type: 'select', options: ['DDR4', 'DDR5'], required: true, displayInOverview: true },
      { id: 'ramSlots', name: 'RAM Slots', type: 'number', placeholder: '4' },
      { id: 'chipset', name: 'Chipset', type: 'text', placeholder: 'B650 / Z790 / B760' },
    ],
  },
  {
    id: 'schema-gpu',
    category: 'Graphic Card',
    description: 'Graphics Cards and Dedicated Video Accelerators',
    attributes: [
      { id: 'vram', name: 'VRAM Capacity', type: 'text', unit: 'GB', placeholder: '16GB GDDR6X', required: true, displayInOverview: true },
      { id: 'interface', name: 'PCIe Bus Interface', type: 'text', placeholder: 'PCIe 4.0 x16' },
      { id: 'length_mm', name: 'GPU Card Length', type: 'number', unit: 'mm', placeholder: '304' },
      { id: 'recommended_psu', name: 'Recommended PSU Wattage', type: 'number', unit: 'W', placeholder: '750', displayInOverview: true },
    ],
  },
  {
    id: 'schema-ram',
    category: 'RAM',
    description: 'Memory modules and Dual-Channel Kits',
    attributes: [
      { id: 'ramType', name: 'Memory Generation', type: 'select', options: ['DDR4', 'DDR5'], required: true, displayInOverview: true },
      { id: 'capacity', name: 'Total Kit Capacity', type: 'text', unit: 'GB', placeholder: '32GB (2x16GB)', required: true, displayInOverview: true },
      { id: 'speed', name: 'Rated Speed', type: 'number', unit: 'MHz', placeholder: '6000', displayInOverview: true },
      { id: 'latency', name: 'CAS Latency (CL)', type: 'text', placeholder: 'CL30 / CL36' },
    ],
  },
  {
    id: 'schema-storage',
    category: 'Storage',
    description: 'Solid State Drives and Hard Disk Drives',
    attributes: [
      { id: 'formFactor', name: 'Form Factor', type: 'select', options: ['M.2 NVMe', '2.5 inch SATA', '3.5 inch HDD'], required: true, displayInOverview: true },
      { id: 'capacity', name: 'Capacity', type: 'text', placeholder: '1TB / 2TB', required: true, displayInOverview: true },
      { id: 'readSpeed', name: 'Max Sequential Read', type: 'text', unit: 'MB/s', placeholder: '7400' },
    ],
  },
  {
    id: 'schema-psu',
    category: 'Power Supply',
    description: 'Power Supplies and Modular Cable Units',
    attributes: [
      { id: 'wattage', name: 'Wattage Output', type: 'number', unit: 'W', placeholder: '850', required: true, displayInOverview: true },
      { id: 'efficiency', name: '80 Plus Efficiency Rating', type: 'select', options: ['80+ Bronze', '80+ Gold', '80+ Platinum'], displayInOverview: true },
      { id: 'modularity', name: 'Cable Modularity', type: 'select', options: ['Full Modular', 'Semi-Modular', 'Non-Modular'] },
    ],
  },
  {
    id: 'schema-casing',
    category: 'Casing',
    description: 'PC Chassis and Cabinets',
    attributes: [
      { id: 'formFactor', name: 'Motherboard Support', type: 'select', options: ['ATX', 'Micro-ATX', 'Mini-ITX', 'E-ATX'], required: true, displayInOverview: true },
      { id: 'maxGpuLength', name: 'Max GPU Clearance', type: 'number', unit: 'mm', placeholder: '380' },
    ],
  },
  {
    id: 'schema-cooler',
    category: 'CPU Cooler',
    description: 'Air and Liquid AIO Cooling Solutions',
    attributes: [
      { id: 'coolerType', name: 'Cooler Category', type: 'select', options: ['AIO Liquid 240mm', 'AIO Liquid 360mm', 'Air Dual-Tower', 'Air Single-Tower'], displayInOverview: true },
      { id: 'supportedSockets', name: 'Socket Compatibility', type: 'text', placeholder: 'AM4, AM5, LGA1700, LGA1851', displayInOverview: true },
    ],
  },
];
