import { ExpenseCategory } from '../types';

export interface CategoryMeta {
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  iconName: string;
}

export const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  'Hardware & Electronics': {
    color: '#0F3B2E',
    bgLight: '#E8F3EE',
    borderColor: '#C3DFD3',
    textColor: '#0A261E',
    iconName: 'Cpu',
  },
  'Cabinet Fabrication & Materials': {
    color: '#8A5323',
    bgLight: '#FAF0E6',
    borderColor: '#EDD4BE',
    textColor: '#5E3411',
    iconName: 'Box',
  },
  'Branding, Decals & Design': {
    color: '#C89B3C',
    bgLight: '#FBF5E8',
    borderColor: '#EED9A6',
    textColor: '#7F5E15',
    iconName: 'Palette',
  },
  'Consumables & Refills': {
    color: '#2563EB',
    bgLight: '#EFF6FF',
    borderColor: '#BFDBFE',
    textColor: '#1E40AF',
    iconName: 'FileText',
  },
  'Software, Web & Hosting': {
    color: '#7C3AED',
    bgLight: '#F5F3FF',
    borderColor: '#DDD6FE',
    textColor: '#5B21B6',
    iconName: 'Globe',
  },
  'Logistics, Transport & Travel': {
    color: '#0D9488',
    bgLight: '#F0FDFA',
    borderColor: '#99F6E4',
    textColor: '#115E59',
    iconName: 'Truck',
  },
  'Operations, Rent & Utilities': {
    color: '#E11D48',
    bgLight: '#FFF1F2',
    borderColor: '#FECDD3',
    textColor: '#9F1239',
    iconName: 'Building',
  },
  'Miscellaneous / Tools': {
    color: '#4B5563',
    bgLight: '#F3F4F6',
    borderColor: '#E5E7EB',
    textColor: '#1F2937',
    iconName: 'Wrench',
  },
};
