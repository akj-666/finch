import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertTriangle, Camera, Upload, Trash2, Eye, RefreshCw, Paperclip, Check } from 'lucide-react';
import {
  Expense,
  ExpenseCategory,
  ExpenseNature,
  PaymentMode,
  EXPENSE_CATEGORIES,
  PAYMENT_MODES,
} from '../types';
import { formatINR, getTodayDateString } from '../utils/formatters';
import { optimizeReceiptImage, getReceipt, StoredReceipt } from '../utils/receiptStorage';
import finchIconLightPng from '../assets/finch-icon-light.png';

export interface ReceiptAttachmentData {
  dataUrl: string;
  name: string;
  size: number;
  type: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string,
    receiptData?: ReceiptAttachmentData | null // null indicates user removed existing receipt
  ) => void;
  initialExpense?: Expense | null;
}

const COMMON_TAGS = ['General Business', 'Operations', 'Administration', 'Facility', 'Production'];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialExpense,
}) => {
  const [date, setDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Hardware & Electronics');
  const [nature, setNature] = useState<ExpenseNature>('CapEx');
  const [description, setDescription] = useState('');
  const [kioskTag, setKioskTag] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [notes, setNotes] = useState('');

  // Receipt attachment states
  const [receiptData, setReceiptData] = useState<ReceiptAttachmentData | null>(null);
  const [isReceiptRemoved, setIsReceiptRemoved] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewZoomOpen, setPreviewZoomOpen] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialExpense) {
        setDate(initialExpense.date);
        setAmount(String(initialExpense.amount));
        setCategory(initialExpense.category);
        setNature(initialExpense.nature);
        setDescription(initialExpense.description);
        setKioskTag(initialExpense.kioskTag || '');
        setPaymentMode(initialExpense.paymentMode);
        setNotes(initialExpense.notes || '');
        setIsReceiptRemoved(false);
        setImageError(null);

        // Fetch stored receipt from IndexedDB if marked as hasReceipt
        if (initialExpense.hasReceipt) {
          getReceipt(initialExpense.id).then((stored: StoredReceipt | null) => {
            if (stored) {
              setReceiptData({
                dataUrl: stored.dataUrl,
                name: stored.name,
                size: stored.size,
                type: stored.type,
              });
            } else {
              setReceiptData(null);
            }
          });
        } else {
          setReceiptData(null);
        }
      } else {
        // Reset to default for new expense
        setDate(getTodayDateString());
        setAmount('');
        setCategory('Hardware & Electronics');
        setNature('CapEx');
        setDescription('');
        setKioskTag('Operations');
        setPaymentMode('UPI');
        setNotes('');
        setReceiptData(null);
        setIsReceiptRemoved(false);
        setImageError(null);
      }
      setErrors({});
      setTouched({});
    }
  }, [isOpen, initialExpense]);

  if (!isOpen) return null;

  const handleImageFile = async (file: File) => {
    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    try {
      setIsProcessingImage(true);
      const optimized = await optimizeReceiptImage(file);
      setReceiptData(optimized);
      setIsReceiptRemoved(false);
    } catch (err) {
      console.error('Receipt processing error:', err);
      setImageError('Could not process this image. Please try another file.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
    // reset input so the same file could be selected again if replaced
    e.target.value = '';
  };

  const handleRemoveReceipt = () => {
    setReceiptData(null);
    setIsReceiptRemoved(true);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!date) {
      newErrors.date = 'Date of expense is required.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      newErrors.date = 'Please provide a valid date in YYYY-MM-DD format.';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount)) {
      newErrors.amount = 'Amount is required.';
    } else if (numAmount <= 0) {
      newErrors.amount = 'Amount must be a positive number greater than ₹0.';
    }

    if (!description.trim()) {
      newErrors.description = 'Item / vendor description is required.';
    } else if (description.trim().length < 3) {
      newErrors.description = 'Please provide a descriptive item name (at least 3 characters).';
    }

    if (!category) {
      newErrors.category = 'Please select an expense category.';
    }

    if (!nature) {
      newErrors.nature = 'Please select whether this is CapEx or OpEx.';
    }

    if (!paymentMode) {
      newErrors.paymentMode = 'Payment mode is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const hasAttachment = Boolean(receiptData && !isReceiptRemoved);

    onSave(
      {
        date,
        amount: Math.round(parseFloat(amount) * 100) / 100,
        category,
        nature,
        description: description.trim(),
        kioskTag: kioskTag.trim() || undefined,
        paymentMode,
        notes: notes.trim() || undefined,
        hasReceipt: hasAttachment,
        receiptName: hasAttachment && receiptData ? receiptData.name : undefined,
        receiptSize: hasAttachment && receiptData ? receiptData.size : undefined,
      },
      initialExpense ? initialExpense.id : undefined,
      isReceiptRemoved ? null : receiptData
    );
    onClose();
  };

  const parsedAmount = parseFloat(amount);
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#e5decb] overflow-hidden my-3 sm:my-6 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header (Sticky on mobile for clear orientation) */}
        <div className="bg-[#0F3B2E] text-[#FFF8EE] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-[#185241] flex-shrink-0">
          <div className="flex items-center space-x-3">
            <img src={finchIconLightPng} alt="Finch" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center space-x-2">
                <span>{initialExpense ? 'Edit Expense' : 'Record Expense'}</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#C89B3C] text-[#0A261E] font-bold">
                  Finch
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[#d8cfbe] mt-0.5 line-clamp-1">
                {initialExpense
                  ? 'Update expense details and attached receipt'
                  : 'Log expenditure, classify CapEx/OpEx, and attach bill proof'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#d8cfbe] hover:text-[#FFF8EE] hover:bg-[#185241] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {Object.keys(errors).length > 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Please complete the required fields:</span>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                  {Object.values(errors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Row 1: Date and Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
                Date of Expense <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTouched({ ...touched, date: true });
                }}
                className={`w-full px-3 py-2 sm:py-2.5 bg-[#FAF7F0] border rounded-lg text-sm text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 ${
                  errors.date && touched.date ? 'border-red-400 bg-red-50/50' : 'border-[#d9cfbe]'
                }`}
                required
              />
              <span className="text-[10px] text-[#7e998e] mt-0.5 block">Defaults to today</span>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#5a6e64] text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setTouched({ ...touched, amount: true });
                  }}
                  placeholder="e.g. 13500"
                  className={`w-full pl-7 pr-3 py-2 sm:py-2.5 bg-[#FAF7F0] border rounded-lg text-sm font-bold text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 ${
                    errors.amount && touched.amount ? 'border-red-400 bg-red-50/50' : 'border-[#d9cfbe]'
                  }`}
                  required
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#7e998e] mt-0.5">
                <span>Must be positive</span>
                {!isNaN(parsedAmount) && parsedAmount > 0 && (
                  <span className="font-bold text-[#0F3B2E]">Preview: {formatINR(parsedAmount)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
              Item / Vendor Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setTouched({ ...touched, description: true });
              }}
              placeholder="e.g. Laser printer toner cartridges, office desk, internet bill"
              className={`w-full px-3 py-2 sm:py-2.5 bg-[#FAF7F0] border rounded-lg text-sm text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 ${
                errors.description && touched.description ? 'border-red-400 bg-red-50/50' : 'border-[#d9cfbe]'
              }`}
              required
            />
            <span className="text-[10px] text-[#7e998e] mt-0.5 block">
              Specify item name, vendor, service or parts bought
            </span>
          </div>

          {/* Row 3: Category */}
          <div>
            <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
              Expense Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ExpenseCategory);
                setTouched({ ...touched, category: true });
              }}
              className="w-full px-3 py-2 sm:py-2.5 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-sm text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20"
              required
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4: Expense Nature (CapEx vs OpEx) - Responsive compact radio cards */}
          <div>
            <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
              Expense Nature <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* CapEx Option */}
              <label
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${
                  nature === 'CapEx'
                    ? 'border-[#1e4e79] bg-[#f0f6fc] shadow-xs'
                    : 'border-[#e5decb] bg-white hover:border-[#c3b69e]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="nature"
                    value="CapEx"
                    checked={nature === 'CapEx'}
                    onChange={() => setNature('CapEx')}
                    className="w-4 h-4 text-[#1e4e79] focus:ring-[#1e4e79]"
                  />
                  <span className="text-xs font-bold text-[#1e4e79]">
                    One-Time Capital Cost (CapEx)
                  </span>
                </div>
                <p className="text-[11px] text-[#55697d] mt-1 ml-6 leading-tight">
                  Machinery, electronics, office fixtures, computers, long-life assets.
                </p>
              </label>

              {/* OpEx Option */}
              <label
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${
                  nature === 'OpEx'
                    ? 'border-[#8c5e00] bg-[#fffaf0] shadow-xs'
                    : 'border-[#e5decb] bg-white hover:border-[#c3b69e]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="nature"
                    value="OpEx"
                    checked={nature === 'OpEx'}
                    onChange={() => setNature('OpEx')}
                    className="w-4 h-4 text-[#8c5e00] focus:ring-[#8c5e00]"
                  />
                  <span className="text-xs font-bold text-[#8c5e00]">
                    Recurring Operating Expense (OpEx)
                  </span>
                </div>
                <p className="text-[11px] text-[#7a6433] mt-1 ml-6 leading-tight">
                  Supplies, paper reams, toner, utilities, rent, cloud services, telecom.
                </p>
              </label>
            </div>
          </div>

          {/* Row 5: Tag / Department (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#0F3B2E] uppercase tracking-wider">
                Tag / Department <span className="text-[#7e998e] font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-[#7e998e]">e.g. Operations, Kerala Branch</span>
            </div>
            <input
              type="text"
              value={kioskTag}
              onChange={(e) => setKioskTag(e.target.value)}
              placeholder="e.g. Operations, Facility, Admin, Lab"
              className="w-full px-3 py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-sm text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20"
            />
            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] uppercase font-bold text-[#7e998e]">Suggestions:</span>
              {COMMON_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => setKioskTag(tag)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    kioskTag === tag
                      ? 'bg-[#0F3B2E] text-[#FFF8EE] border-[#0F3B2E] font-bold'
                      : 'bg-[#FAF7F0] text-[#5a6e64] border-[#d9cfbe] hover:bg-[#eee6d5]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Row 6: Payment Mode */}
          <div>
            <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                    paymentMode === mode
                      ? 'bg-[#0F3B2E] text-[#FFF8EE] border-[#0F3B2E] shadow-xs'
                      : 'bg-[#FAF7F0] text-[#42524a] border-[#d9cfbe] hover:bg-[#ede5d5]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Row 7: Receipt / Bill Image Attachment */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-[#d9cfbe] bg-[#FAF7F0] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Paperclip className="w-4 h-4 text-[#C89B3C]" />
                <span className="text-xs font-bold text-[#0F3B2E] uppercase tracking-wider">
                  Bill / Receipt Attachment
                </span>
                <span className="text-[10px] text-[#7e998e] font-normal">(Optional)</span>
              </div>
              {receiptData && (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-700" /> Attached
                </span>
              )}
            </div>

            {/* Hidden File Inputs: one for camera capture on phone, one for general file browser */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,image/heic,image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* If no receipt attached: Show Action Buttons */}
            {!receiptData ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Capture from Phone Camera */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessingImage}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-white border border-[#d9cfbe] hover:border-[#0F3B2E] hover:bg-[#FDFBF7] text-[#0F3B2E] text-xs font-semibold shadow-xs transition-all active:scale-98"
                  >
                    <Camera className="w-4 h-4 text-[#C89B3C]" />
                    <span>Take Photo / Capture</span>
                  </button>

                  {/* Browse / Upload File */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingImage}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-white border border-[#d9cfbe] hover:border-[#0F3B2E] hover:bg-[#FDFBF7] text-[#0F3B2E] text-xs font-semibold shadow-xs transition-all active:scale-98"
                  >
                    <Upload className="w-4 h-4 text-[#0F3B2E]" />
                    <span>Select from Gallery / Files</span>
                  </button>
                </div>
                <p className="text-[10px] text-[#7e998e] text-center sm:text-left">
                  Supports JPEG, PNG, WebP. High-res camera photos are automatically optimized for fast local storage.
                </p>
              </div>
            ) : (
              /* Receipt is attached: show Preview Card */
              <div className="bg-white rounded-lg p-2.5 sm:p-3 border border-[#d9cfbe] flex items-center justify-between gap-3 shadow-xs">
                {/* Thumbnail & Info */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    onClick={() => setPreviewZoomOpen(true)}
                    className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 cursor-pointer relative group"
                    title="Click to zoom preview"
                  >
                    <img
                      src={receiptData.dataUrl}
                      alt="Receipt preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F3B2E] truncate">
                      {receiptData.name || 'receipt-attachment.jpg'}
                    </div>
                    <div className="text-[10px] text-[#7e998e] flex items-center gap-1.5 mt-0.5">
                      <span>{formatFileSize(receiptData.size)}</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoomOpen(true)}
                        className="text-[#0F3B2E] font-semibold underline hover:text-[#C89B3C]"
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replace & Remove Actions */}
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Replace with another image"
                    className="p-1.5 rounded-md text-[#5a6e64] hover:text-[#0F3B2E] hover:bg-[#FAF7F0] border border-[#e5decb] text-xs font-medium inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    title="Remove attached receipt"
                    className="p-1.5 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </div>
            )}

            {isProcessingImage && (
              <div className="text-[11px] text-[#0F3B2E] font-medium flex items-center justify-center py-1">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#C89B3C]" />
                Optimizing image for fast offline storage...
              </div>
            )}

            {imageError && (
              <div className="text-[11px] text-red-600 font-medium">
                {imageError}
              </div>
            )}
          </div>

          {/* Row 8: Notes / Receipt Reference (Optional) */}
          <div>
            <label className="block text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-1">
              Notes / Memo <span className="text-[#7e998e] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Invoice #KL-5021, replacement warranty details, supplier phone number..."
              className="w-full px-3 py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-sm text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20"
            />
          </div>
        </form>

        {/* Modal Footer (Sticky at bottom for mobile convenience) */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[#FAF7F0] border-t border-[#f0ebd9] flex items-center justify-end space-x-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 sm:py-2.5 rounded-lg border border-[#d9cfbe] text-xs sm:text-sm font-semibold text-[#5a6e64] hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-[#0F3B2E] hover:bg-[#185241] text-[#FFF8EE] text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            <Save className="w-4 h-4 text-[#C89B3C]" />
            <span>{initialExpense ? 'Save Changes' : 'Record Expense'}</span>
          </button>
        </div>

        {/* Full Image Preview Zoom Overlay */}
        {previewZoomOpen && receiptData && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setPreviewZoomOpen(false)}
          >
            <div
              className="relative max-w-xl max-h-[85vh] bg-white rounded-xl p-2 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewZoomOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={receiptData.dataUrl}
                alt="Receipt Full Preview"
                className="max-h-[80vh] w-auto max-w-full object-contain rounded"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
