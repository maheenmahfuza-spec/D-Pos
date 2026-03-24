/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Download, 
  Upload,
  Share2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Info,
  X,
  Sun,
  Moon,
  Menu,
  Pause,
  RotateCcw,
  ArrowLeftRight,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import { format, differenceInDays } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { QRCodeSVG } from "qrcode.react";

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Role = "cashier" | "admin" | "dev" | null;

interface Product {
  code: string;
  description: string;
  category: string;
  cost_price: number;
  selling_price: number;
  qty: number;
}

interface Member {
  phone: string;
  name: string;
  points: number;
  created_at?: string;
}

interface PointsHistory {
  id: number;
  member_phone: string;
  change: number;
  reason: string;
  created_at: string;
}

interface Sale {
  id: number;
  transaction_id: string;
  date: string;
  product_code: string;
  description: string;
  qty: number;
  total_price: number;
  discount: number;
  member_phone: string | null;
  points_earned?: number;
  points_redeemed?: number;
}

interface CartItem extends Product {
  cartQty: number;
  isReturn?: boolean;
  originalQty?: number;
  original_transaction_id?: string;
}

// --- Components ---

const SplashScreen = ({ onComplete, shopName, appLogo }: { onComplete: () => void; shopName: string; appLogo: string }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 100 }
    },
  };

  const boxVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { type: "spring", stiffness: 200, damping: 10 }
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      variants={containerVariants}
      className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Animated Background Boxes */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(16)].map((_, i) => (
            <motion.div
              key={i}
              variants={boxVariants}
              className="w-16 h-16 bg-emerald-500/20 rounded-xl border border-emerald-500/30"
            />
          ))}
        </div>
      </div>

      <motion.div variants={itemVariants} className="relative z-10 flex flex-col items-center">
        {appLogo ? (
          <motion.img 
            src={appLogo} 
            alt="Logo" 
            className="h-24 mb-6 object-contain"
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ duration: 0.5 }}
          />
        ) : (
          <motion.div 
            className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/20"
            variants={itemVariants}
          >
            <ShoppingCart className="text-white" size={48} />
          </motion.div>
        )}
        
        <motion.h1 
          variants={itemVariants}
          className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2 text-center px-4"
        >
          {shopName.split('').map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + (i * 0.05) }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>
        
        <motion.p 
          variants={itemVariants}
          className="text-emerald-500 font-mono tracking-widest uppercase text-sm"
        >
          Initializing System...
        </motion.p>
      </motion.div>

      <motion.div 
        className="absolute bottom-12 flex gap-2"
        variants={containerVariants}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            variants={boxVariants}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              repeat: Infinity,
              duration: 1,
              delay: i * 0.2,
            }}
            className="w-2 h-2 bg-emerald-500 rounded-full"
          />
        ))}
      </motion.div>
    </motion.div>
  );
};

const AVAILABLE_NOTES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

const getSuggestedPayments = (amount: number) => {
  if (amount <= 0) return [];
  const suggestions = new Set<number>();
  
  // 1. Exact amount
  suggestions.add(Math.ceil(amount));
  
  // 2. Round up to nearest 10
  suggestions.add(Math.ceil(amount / 10) * 10);
  
  // 3. Round up to nearest 50
  suggestions.add(Math.ceil(amount / 50) * 50);
  
  // 4. Round up to nearest 100
  suggestions.add(Math.ceil(amount / 100) * 100);
  
  // 5. Round up to nearest 500
  suggestions.add(Math.ceil(amount / 500) * 500);

  // 6. Round up to nearest 1000
  suggestions.add(Math.ceil(amount / 1000) * 1000);

  return Array.from(suggestions)
    .filter(s => s >= amount)
    .sort((a, b) => a - b)
    .slice(0, 6);
};

const getChangeBreakdown = (change: number) => {
  const breakdown: { note: number; count: number }[] = [];
  let remaining = Math.floor(change); // Integer part for notes
  
  const sortedNotes = [...AVAILABLE_NOTES].sort((a, b) => b - a);
  
  for (const note of sortedNotes) {
    if (remaining >= note) {
      const count = Math.floor(remaining / note);
      breakdown.push({ note, count });
      remaining %= note;
    }
  }
  
  return breakdown;
};

const PAYMENT_TYPES = ["Cash", "Card", "MFS", "Points", "Coupon"];

const PaymentModal = ({ 
  total, 
  onClose, 
  onSave, 
  getThemeColor, 
  isDark 
}: { 
  total: number; 
  onClose: () => void; 
  onSave: (payments: { type: string; amount: number }[]) => void; 
  getThemeColor: (t: any) => string; 
  isDark: boolean 
}) => {
  const [currentPayments, setCurrentPayments] = useState<{ type: string; amount: number }[]>([]);
  const [selectedType, setSelectedType] = useState("Cash");
  const [amount, setAmount] = useState("");
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountInputRef.current?.focus();
    
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        const currentIndex = PAYMENT_TYPES.indexOf(selectedType);
        const nextIndex = (currentIndex + 1) % PAYMENT_TYPES.length;
        setSelectedType(PAYMENT_TYPES[nextIndex]);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = PAYMENT_TYPES.indexOf(selectedType);
        const nextIndex = (currentIndex - 1 + PAYMENT_TYPES.length) % PAYMENT_TYPES.length;
        setSelectedType(PAYMENT_TYPES[nextIndex]);
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = PAYMENT_TYPES.indexOf(selectedType);
        const nextIndex = (currentIndex + 1) % PAYMENT_TYPES.length;
        setSelectedType(PAYMENT_TYPES[nextIndex]);
      }

      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleModalKeyDown);
    return () => window.removeEventListener("keydown", handleModalKeyDown);
  }, [selectedType, onClose]);

  const isRefund = total < 0;
  const absTotal = Math.abs(total);
  const paidTotal = currentPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, absTotal - paidTotal);

  const addPayment = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    // Allow overpayment ONLY for Cash
    if (selectedType !== "Cash" && val > remaining) {
      setCurrentPayments([...currentPayments, { type: selectedType, amount: remaining }]);
    } else {
      setCurrentPayments([...currentPayments, { type: selectedType, amount: val }]);
    }
    setAmount("");
  };

  const removePayment = (index: number) => {
    setCurrentPayments(currentPayments.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border",
          isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
        )}
      >
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Payment Details</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-red-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="text-sm text-zinc-500 uppercase tracking-wider">{isRefund ? "Total Refund Amount" : "Total Amount Due"}</div>
              <div className={cn("text-4xl font-black", isRefund ? "text-red-500" : "")}>{absTotal.toFixed(2)} ৳</div>
              
              <div className="space-y-2">
                <label className="text-sm text-zinc-500">{isRefund ? "Select Refund Method" : "Select Payment Type"}</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedType(t)}
                      className={cn(
                        "py-2 rounded-lg text-xs font-bold transition-all",
                        selectedType === t 
                          ? cn(getThemeColor("bg"), "text-white") 
                          : isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

                <div className="space-y-2">
                <label className="text-sm text-zinc-500">{isRefund ? "Amount to Refund" : "Amount to Pay"}</label>
                <div className="flex gap-2">
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={remaining.toFixed(2)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (amount) {
                          addPayment();
                        } else if (paidTotal >= absTotal - 0.01) {
                          onSave(currentPayments);
                        }
                      }
                    }}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg border focus:outline-none",
                      isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                    )}
                  />
                  <button
                    onClick={addPayment}
                    className={cn("px-4 py-2 rounded-lg text-white font-bold", getThemeColor("bg"))}
                  >
                    Add
                  </button>
                </div>
                
                {!isRefund && selectedType === "Cash" && remaining > 0 && (
                  <div className="pt-2">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 block">Quick Cash Suggestions</label>
                    <div className="flex flex-wrap gap-2">
                      {getSuggestedPayments(remaining).map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setAmount(s.toString());
                            // Automatically add if it's a quick suggestion? 
                            // Let's just set the amount for now to let user confirm.
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            isDark 
                              ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500" 
                              : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          )}
                        >
                          {s} ৳
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-zinc-500 uppercase tracking-wider">{isRefund ? "Refunds Added" : "Payments Added"}</div>
              <div className={cn(
                "h-48 overflow-auto rounded-xl border p-4 space-y-2",
                isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-100"
              )}>
                {currentPayments.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs italic">
                    No {isRefund ? "refunds" : "payments"} added yet
                  </div>
                ) : (
                  currentPayments.map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50">
                      <span className="text-sm font-bold">{p.type}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{p.amount.toFixed(2)}</span>
                        <button onClick={() => removePayment(i)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                <span className="text-sm text-zinc-500">{isRefund ? "Total Refunded:" : "Total Paid:"}</span>
                <span className="text-xl font-bold">{paidTotal.toFixed(2)} ৳</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Remaining:</span>
                <span className={cn("text-xl font-bold", remaining > 0 ? "text-red-400" : "text-emerald-400")}>
                  {remaining.toFixed(2)} ৳
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(currentPayments)}
            disabled={paidTotal < absTotal - 0.01}
            className={cn(
              "flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50",
              getThemeColor("bg")
            )}
          >
            {isRefund ? "Complete Refund" : "Save & Complete"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Login = ({ onLogin, shopName, appLogo, getThemeColor }: { onLogin: (role: Role) => void; shopName: string; appLogo: string; getThemeColor: (t: any) => string }) => {
  const [role, setRole] = useState<"cashier" | "admin" | "dev">("cashier");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.role);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Connection error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <h1 className={cn("text-3xl font-bold mb-2", getThemeColor("text"))}>{shopName}</h1>
          )}
          <p className="text-zinc-400">Business Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Access Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cashier", "admin", "dev"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    role === r 
                      ? cn(getThemeColor("bg"), "text-white shadow-lg", getThemeColor("shadow")) 
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all",
                getThemeColor("border").replace("border-", "focus:ring-")
              )}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className={cn(
              "w-full text-white font-bold py-3 rounded-lg transition-all shadow-lg",
              getThemeColor("bg"),
              getThemeColor("shadow")
            )}
          >
            Login to Dashboard
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const Bill = ({ 
  items, 
  member, 
  discount, 
  total, 
  shopName, 
  appLogo,
  billQrData,
  billRef,
  pointsRedeemed,
  pointsEarned,
  transactionId,
  receivedAmount,
  changeAmount
}: { 
  items: CartItem[], 
  member: Member | null, 
  discount: number, 
  total: number, 
  shopName: string,
  appLogo: string,
  billQrData: string,
  billRef: React.RefObject<HTMLDivElement | null>,
  pointsRedeemed: number,
  pointsEarned: number,
  transactionId: string,
  receivedAmount: number,
  changeAmount: number
}) => {
  return (
    <div className="absolute -left-[9999px] top-0">
      <div 
        ref={billRef}
        className="w-[400px] bg-white p-8 text-black font-mono"
      >
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <img 
            src={appLogo || "https://cdn-icons-png.flaticon.com/512/857/857455.png"} 
            alt="Logo" 
            className="h-16 mx-auto mb-2 object-contain" 
            referrerPolicy="no-referrer"
          />
          <h2 className="text-2xl font-bold uppercase">{shopName}</h2>
          <div className="text-sm font-bold mt-1">Bill #: {transactionId}</div>
          <div className="text-sm font-bold">Txn #: {transactionId}</div>
          <p className="text-sm">{format(new Date(), "PPP p")}</p>
        </div>

        <div className="mb-4">
          <div className="grid grid-cols-4 font-bold border-b border-black pb-1 mb-2">
            <span className="col-span-2">Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
          </div>
          {items.map((item, i) => (
            <div key={i} className={cn("grid grid-cols-4 text-sm mb-1", item.isReturn && "text-red-600")}>
              <span className="col-span-2 truncate">{item.description}</span>
              <span className="text-right">x{Math.abs(item.cartQty)}</span>
              <span className="text-right">{Math.abs((item.selling_price || 0) * item.cartQty).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-black pt-2 space-y-1">
          {items.some(i => i.isReturn) && (
            <>
              <div className="flex justify-between text-sm text-red-600">
                <span>Return Amount:</span>
                <span>{Math.abs(items.filter(i => i.isReturn).reduce((sum, i) => sum + (i.selling_price * i.cartQty), 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600">
                <span>New Items Amount:</span>
                <span>{items.filter(i => !i.isReturn).reduce((sum, i) => sum + (i.selling_price * i.cartQty), 0).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span>Net Subtotal:</span>
            <span>{((total || 0) + (discount || 0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Discount:</span>
            <span>-{(discount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-1">
            <span>{total < 0 ? "REFUND TOTAL:" : "TOTAL:"}</span>
            <span>{Math.abs(total || 0).toFixed(2)} Taka</span>
          </div>
          <div className="flex justify-between text-sm pt-2">
            <span>Received:</span>
            <span>{(receivedAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Change:</span>
            <span>{(changeAmount || 0).toFixed(2)}</span>
          </div>
        </div>

        {member && (
          <div className="mt-6 p-3 bg-zinc-100 rounded border border-zinc-300">
            <p className="text-xs font-bold uppercase mb-1">Membership Info</p>
            <p className="text-sm">Name: {member.name}</p>
            <p className="text-sm">Phone: {member.phone}</p>
            <div className="mt-2 pt-2 border-t border-zinc-300 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Previous Points:</span>
                <span>{member.points}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Redeemed Points:</span>
                <span>-{pointsRedeemed}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Points Earned:</span>
                <span>+{pointsEarned}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-zinc-300">
                <span>Current Total:</span>
                <span>{member.points - pointsRedeemed + pointsEarned}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs space-y-4">
          <div className="border-t border-dashed border-black pt-4 text-left">
            <p className="font-bold mb-1">POLICY:</p>
            <p>• No Cash Refund</p>
            <p>• No Return After Purchase</p>
            <p>• Exchange Allowed Within 72 Hours</p>
            <p className="ml-2 text-[10px] italic">(Must bring receipt & product in good condition)</p>
          </div>
          <div className="pt-2">
            <p className="font-bold text-sm">Thank you for shopping with us!</p>
            <p>Visit again soon.</p>
          </div>
          {billQrData && (
            <div className="flex justify-center">
              <QRCodeSVG value={billQrData} size={80} level="M" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [activeTab, setActiveTab] = useState<"pos" | "inventory" | "members" | "reports" | "about" | "dev" | "add-product" | "history">("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [shopName, setShopName] = useState("SportsStock Pro");
  const [sales, setSales] = useState<Sale[]>([]);
  const [dateRange, setDateRange] = useState({ 
    start: format(new Date(), "yyyy-MM-dd"), 
    end: format(new Date(), "yyyy-MM-dd") 
  });
  
  const billRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const memberSearchRef = useRef<HTMLInputElement>(null);
  const completeSaleBtnRef = useRef<HTMLButtonElement>(null);

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<PointsHistory[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newMemberData, setNewMemberData] = useState({ phone: "", name: "" });
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [salesSearch, setSalesSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [memberDirectorySearch, setMemberDirectorySearch] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [appTheme, setAppTheme] = useState("emerald");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [appLogo, setAppLogo] = useState("");
  const [billQrData, setBillQrData] = useState("https://sportsstock.pro");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<{ type: string; amount: number }[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [changeAmount, setChangeAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [currentTransactionId, setCurrentTransactionId] = useState("");
  const [selectedCartIndex, setSelectedCartIndex] = useState(-1);
  const [lastF2PressTime, setLastF2PressTime] = useState(0);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [billNumberInput, setBillNumberInput] = useState("");
  const [foundBillSales, setFoundBillSales] = useState<Sale[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<{[key: string]: number}>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [heldBill, setHeldBill] = useState<{
    cart: CartItem[];
    member: Member | null;
    customDiscount: number;
    redeemPoints: number;
    memberSearch: string;
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (role) {
      fetchProducts();
      fetchAuditLogs();
      if (role === "admin" || role === "dev") {
        fetchSales();
        fetchAllMembers();
      }

      // WebSocket setup for real-time updates
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "STOCK_UPDATED") {
            fetchProducts();
            if (role === "admin" || role === "dev") {
              fetchSales();
            }
          }
        } catch (err) {
          console.error("WS error:", err);
        }
      };

      return () => ws.close();
    }
  }, [role, dateRange]);

  useEffect(() => {
    if (activeTab === "members" && (role === "admin" || role === "dev")) {
      fetchAllMembers();
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (billNumberInput.length >= 6) {
      const found = sales.filter(s => s.transaction_id === billNumberInput);
      setFoundBillSales(found);
      if (found.length > 0) {
        const qtys: {[key: string]: number} = {};
        found.forEach(s => {
          qtys[s.product_code] = s.qty;
        });
        setReturnQuantities(qtys);
      } else {
        setReturnQuantities({});
      }
    } else {
      setFoundBillSales([]);
      setReturnQuantities({});
    }
  }, [billNumberInput, sales]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      setAuditLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  const logEvent = async (type: string, details: string) => {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: type, details }),
      });
      fetchAuditLogs();
    } catch (err) {
      console.error("Failed to log event:", err);
    }
  };

  const fetchProducts = async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data);
  };

  const fetchSettings = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data.shop_name) setShopName(data.shop_name);
    if (data.app_theme) setAppTheme(data.app_theme);
    if (data.app_logo) setAppLogo(data.app_logo);
    if (data.bill_qr_data) setBillQrData(data.bill_qr_data);
  };

  const fetchSales = async () => {
    const res = await fetch(`/api/reports/sales?start=${dateRange.start}&end=${dateRange.end}`);
    const data = await res.json();
    setSales(data);
  };

  const fetchAllMembers = async () => {
    const res = await fetch("/api/members");
    const data = await res.json();
    setAllMembers(data);
  };

  const fetchMemberHistory = async (phone: string) => {
    const res = await fetch(`/api/members/${phone}/history`);
    const data = await res.json();
    setSelectedMemberHistory(data);
    setShowHistoryModal(true);
  };

  const handleLogout = () => {
    setRole(null);
    setCart([]);
    setMember(null);
  };

  // --- POS Logic ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.code === product.code && !p.isReturn);
      if (existing) {
        if (existing.cartQty >= product.qty) return prev;
        const updated = prev.map(p => (p.code === product.code && !p.isReturn) ? { ...p, cartQty: p.cartQty + 1 } : p);
        setSelectedCartIndex(updated.findIndex(p => p.code === product.code && !p.isReturn));
        return updated;
      }
      const updated = [...prev, { ...product, cartQty: 1, isReturn: false }];
      setSelectedCartIndex(updated.length - 1);
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    const item = cart[index];
    if (item) {
      logEvent("CART_REMOVE", `Removed ${item.description} (${item.code}) ${item.isReturn ? '(Return)' : ''} from cart`);
    }
    setCart(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) setSelectedCartIndex(-1);
      else setSelectedCartIndex(prev => Math.min(prev, updated.length - 1));
      return updated;
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.selling_price * item.cartQty), 0);
  const [customDiscount, setCustomDiscount] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);

  // Preview Bill State
  const [previewBillData, setPreviewBillData] = useState<{
    items: CartItem[];
    member: Member | null;
    discount: number;
    total: number;
    pointsRedeemed: number;
    pointsEarned: number;
    date: string;
    transaction_id: string;
    receivedAmount: number;
    changeAmount: number;
  } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const previewBillRef = useRef<HTMLDivElement>(null);

  const totalDiscount = customDiscount + (redeemPoints);
  const finalTotal = cartTotal - totalDiscount;

  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [showMemberResults, setShowMemberResults] = useState(false);

  const searchMembers = async (query: string) => {
    setMemberSearch(query);
    if (query.length < 2) {
      setMemberResults([]);
      return;
    }
    const res = await fetch(`/api/members/search?query=${query}`);
    const data = await res.json();
    setMemberResults(data);
    setShowMemberResults(true);
  };

  const pointsEarned = member ? Math.max(0, Math.floor(finalTotal / 100)) : 0;

  const handleCheckout = async (paymentList: { type: string; amount: number }[]) => {
    // Validation: Discount must be greater than cost price + 6% (only for normal sales)
    const totalCost = cart.reduce((sum, item) => sum + (item.cost_price * item.cartQty), 0);
    const hasReturn = cart.some(item => item.isReturn);
    
    if (!hasReturn && finalTotal < totalCost * 1.06) {
      showNotification("Discount too high! Final price must be at least 6% above cost price.", "error");
      return;
    }

    if (redeemPoints > 0 && redeemPoints < 2) {
      showNotification("Minimum redemption is 2 points.", "error");
      return;
    }

    const paidTotal = paymentList.reduce((sum, p) => sum + p.amount, 0);
    setReceivedAmount(paidTotal);
    
    if (finalTotal < 0) {
      // For refunds, change is 0 (we just pay back the abs total)
      setChangeAmount(0);
    } else {
      setChangeAmount(paidTotal - finalTotal);
    }

    const billNumber = format(new Date(), "yyyyMMddHHmmss");
    setCurrentTransactionId(billNumber);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: billNumber,
          items: cart.map(item => ({ 
            code: item.code, 
            qty: item.cartQty, 
            price: item.selling_price,
            original_transaction_id: item.original_transaction_id
          })),
          member_phone: member?.phone,
          discount: totalDiscount,
          points_redeemed: redeemPoints,
          payments: paymentList
        }),
      });

      if (res.ok) {
        const isReturn = cart.some(i => i.isReturn);
        const isExchange = isReturn && cart.some(i => !i.isReturn);
        const eventType = isExchange ? "EXCHANGE" : (isReturn ? "RETURN" : "SALE");
        const originalTxn = cart.find(i => i.isReturn)?.original_transaction_id;
        
        logEvent(eventType, `Completed ${eventType} ${billNumber}${originalTxn ? ` (Original: ${originalTxn})` : ""}. Total: ${finalTotal.toFixed(2)} ৳`);
        
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        // Generate Bill Image
        setTimeout(async () => {
          if (billRef.current) {
            const dataUrl = await toPng(billRef.current);
            const link = document.createElement('a');
            link.download = `bill-${billNumber}.png`;
            link.href = dataUrl;
            link.click();
            
            // Clear cart and states AFTER generation
            setCart([]);
            setMember(null);
            setCustomDiscount(0);
            setRedeemPoints(0);
            setMemberSearch("");
            setPayments([]);
            fetchProducts();
            if (role === "admin" || role === "dev") {
              fetchAllMembers();
            }
          }
        }, 1000);
      } else {
        const err = await res.json();
        setCheckoutError(err.message || "Unknown error occurred");
        setShowErrorModal(true);
      }
    } catch (err) {
      setCheckoutError("Network error occurred");
      setShowErrorModal(true);
    }
  };

  const holdBill = () => {
    if (cart.length === 0) {
      showNotification("Cannot hold an empty cart", "error");
      return;
    }
    setHeldBill({
      cart: [...cart],
      member,
      customDiscount,
      redeemPoints,
      memberSearch
    });
    setCart([]);
    setMember(null);
    setCustomDiscount(0);
    setRedeemPoints(0);
    setMemberSearch("");
    showNotification("Bill put on hold", "info");
  };

  const recallBill = () => {
    if (!heldBill) {
      showNotification("No bill on hold", "error");
      return;
    }
    if (cart.length > 0) {
      showNotification("Please clear current cart before recalling", "error");
      return;
    }
    setCart(heldBill.cart);
    setMember(heldBill.member);
    setCustomDiscount(heldBill.customDiscount);
    setRedeemPoints(heldBill.redeemPoints);
    setMemberSearch(heldBill.memberSearch);
    setHeldBill(null);
    showNotification("Bill recalled", "success");
  };

  const handleExchange = (billId: string, productCode?: string, returnQty?: number) => {
    const billSales = sales.filter(s => s.transaction_id === billId);
    if (billSales.length === 0) {
      showNotification("Bill not found", "error");
      return;
    }
    const billDate = new Date(billSales[0].date);
    const diff = differenceInDays(new Date(), billDate);
    if (diff > 3) {
      showNotification("Exchange only possible within 3 days", "error");
      return;
    }

    const itemsToExchange = productCode 
      ? billSales.filter(s => s.product_code === productCode)
      : billSales;

    // Add items to cart for exchange with negative quantity
    const exchangeItems: CartItem[] = itemsToExchange.map(s => {
      const product = products.find(p => p.code === s.product_code);
      const qtyToReturn = productCode && returnQty ? returnQty : s.qty;
      return {
        code: s.product_code,
        description: s.description,
        category: product?.category || "",
        cost_price: product?.cost_price || 0,
        selling_price: s.total_price / s.qty,
        qty: product?.qty || 0,
        cartQty: -qtyToReturn,
        isReturn: true,
        originalQty: s.qty,
        original_transaction_id: billId
      };
    });

    setCart(prev => [...prev, ...exchangeItems]);
    setShowExchangeModal(false);
    setBillNumberInput("");
    logEvent("EXCHANGE_START", `Started exchange for items from bill ${billId}${productCode ? ` (Product: ${productCode})` : ""}`);
    showNotification("Items added to cart as returns. Add new items to complete exchange.", "info");
  };

  const handleReturn = (billId: string, productCode?: string, returnQty?: number) => {
    const billSales = sales.filter(s => s.transaction_id === billId);
    if (billSales.length === 0) {
      showNotification("Bill not found", "error");
      return;
    }
    const billDate = new Date(billSales[0].date);
    const diff = differenceInDays(new Date(), billDate);
    if (diff > 3) {
      showNotification("Return only possible within 3 days", "error");
      return;
    }

    const itemsToReturn = productCode 
      ? billSales.filter(s => s.product_code === productCode)
      : billSales;

    // Add items to cart for return with negative quantity
    const returnItems: CartItem[] = itemsToReturn.map(s => {
      const product = products.find(p => p.code === s.product_code);
      const qtyToReturn = productCode && returnQty ? returnQty : s.qty;
      return {
        code: s.product_code,
        description: s.description,
        category: product?.category || "",
        cost_price: product?.cost_price || 0,
        selling_price: s.total_price / s.qty,
        qty: product?.qty || 0,
        cartQty: -qtyToReturn,
        isReturn: true,
        originalQty: s.qty,
        original_transaction_id: billId
      };
    });

    setCart(prev => [...prev, ...returnItems]);
    setShowReturnModal(false);
    setBillNumberInput("");
    logEvent("RETURN_START", `Started return for items from bill ${billId}${productCode ? ` (Product: ${productCode})` : ""}`);
    showNotification("Items added to cart as returns.", "info");
  };

  const openBillPreview = (transactionId: string) => {
    const transactionSales = sales.filter(s => s.transaction_id === transactionId);
    if (transactionSales.length === 0) return;

    const firstSale = transactionSales[0];
    const billItems: CartItem[] = transactionSales.map(s => ({
      code: s.product_code,
      description: s.description,
      category: "", 
      cost_price: 0,
      selling_price: s.total_price / s.qty,
      qty: 0,
      cartQty: s.qty
    }));

    const billMember = allMembers.find(m => m.phone === firstSale.member_phone) || null;

    setPreviewBillData({
      items: billItems,
      member: billMember,
      discount: transactionSales.reduce((sum, s) => sum + (s.discount || 0), 0),
      total: transactionSales.reduce((sum, s) => sum + (s.total_price || 0), 0) - transactionSales.reduce((sum, s) => sum + (s.discount || 0), 0),
      pointsRedeemed: transactionSales.reduce((sum, s) => sum + (s.points_redeemed || 0), 0),
      pointsEarned: transactionSales.reduce((sum, s) => sum + (s.points_earned || 0), 0),
      date: firstSale.date,
      transaction_id: transactionId,
      receivedAmount: 0,
      changeAmount: 0
    });
    setShowPreviewModal(true);

    // Fetch payment info
    fetch(`/api/sales/${transactionId}/payments`)
      .then(res => res.json())
      .then(payments => {
        const paidTotal = Array.isArray(payments) ? payments.reduce((sum: number, p: any) => sum + p.amount, 0) : 0;
        const billTotal = transactionSales.reduce((sum, s) => sum + (s.total_price || 0), 0) - transactionSales.reduce((sum, s) => sum + (s.discount || 0), 0);
        setPreviewBillData(prev => prev ? {
          ...prev,
          receivedAmount: paidTotal,
          changeAmount: paidTotal - billTotal
        } : null);
      });
  };

  const handleShare = async (platform: 'whatsapp' | 'messenger') => {
    if (!previewBillRef.current) return;
    
    try {
      const dataUrl = await toPng(previewBillRef.current, { backgroundColor: '#fff' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'bill.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Bill Receipt',
          text: `Here is your bill receipt from ${shopName}`,
        });
      } else {
        const message = encodeURIComponent(`Here is your bill receipt from ${shopName}. (Image sharing requires mobile device)`);
        if (platform === 'whatsapp') {
          window.open(`https://wa.me/?text=${message}`, '_blank');
        } else {
          showNotification("Sharing images directly to Messenger requires the Facebook app on mobile.", "info");
        }
      }
    } catch (err) {
      console.error("Error sharing:", err);
      showNotification("Failed to share bill", "error");
    }
  };

  const downloadSalesReport = () => {
    const reportData = sales.map(s => ({
      Date: s.date,
      'Transaction ID': s.transaction_id,
      'Product Code': s.product_code,
      Description: s.description,
      Quantity: s.qty,
      'Unit Price': (s.total_price / s.qty).toFixed(2),
      'Total Price': s.total_price.toFixed(2),
      Discount: (s.discount || 0).toFixed(2),
      'Net Total': (s.total_price - (s.discount || 0)).toFixed(2),
      Member: s.member_phone || 'Guest'
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `Sales_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadInventoryData = () => {
    const inventoryData = products.map(p => ({
      Code: p.code,
      Description: p.description,
      Category: p.category,
      'Cost Price': p.cost_price.toFixed(2),
      'Selling Price': p.selling_price.toFixed(2),
      Quantity: p.qty,
      'Total Cost Value': (p.cost_price * p.qty).toFixed(2),
      'Total Selling Value': (p.selling_price * p.qty).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(inventoryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_Data_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const registerMember = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { phone, name } = newMemberData;
    if (!phone || !name) return;

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name }),
    });

    if (res.ok) {
      showNotification("Member registered successfully!");
      const memberRes = await fetch(`/api/members/${phone}`);
      const memberData = await memberRes.json();
      setMember(memberData);
      setShowRegisterModal(false);
      setNewMemberData({ phone: "", name: "" });
      if (role === "admin" || role === "dev") {
        fetchAllMembers();
      }
    } else {
      const err = await res.json();
      showNotification(`Registration failed: ${err.message}`, "error");
    }
  };

  // --- Admin Logic ---
  const [newProduct, setNewProduct] = useState({ code: "", description: "", category: "", cost_price: 0, qty: 0 });
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const selling_price = newProduct.cost_price * 1.12;
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newProduct, selling_price }),
    });
    fetchProducts();
    setNewProduct({ code: "", description: "", category: "", cost_price: 0, qty: 0 });
  };

  // --- Dev Logic ---
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        console.log("Raw Excel Data:", data);

        const productsToUpload = data.map(row => {
          // Find keys case-insensitively and handle spaces/underscores
          const findKey = (patterns: string[]) => {
            const key = Object.keys(row).find(k => 
              patterns.some(p => k.toLowerCase().replace(/[^a-z0-9]/g, '') === p.toLowerCase().replace(/[^a-z0-9]/g, ''))
            );
            return key ? row[key] : undefined;
          };

          const code = String(findKey(["code", "productcode", "itemcode", "barcode", "id"]) || "").trim();
          const description = String(findKey(["description", "name", "itemname", "productname", "title", "label"]) || "").trim();
          const category = String(findKey(["category", "type", "dept", "department", "group"]) || "General").trim();
          
          const rawCost = findKey(["costprice", "cost", "cp", "purchaseprice", "buyingprice"]);
          const cost_price = parseFloat(String(rawCost || "0")) || 0;
          
          const rawPrice = findKey(["sellingprice", "price", "sp", "mrp", "rate", "selling"]);
          const selling_price = parseFloat(String(rawPrice || "0")) || 0;
          
          const rawQty = findKey(["qty", "quantity", "stock", "count", "inventory", "balance"]);
          const qty = parseInt(String(rawQty || "0"), 10) || 0;

          return { code, description, category, cost_price, selling_price, qty };
        }).filter(p => p.code && p.code !== "undefined" && p.code !== "null" && p.code !== "");

        console.log("Parsed Products:", productsToUpload);

        if (productsToUpload.length === 0) {
          showNotification("No valid products found. Please ensure your Excel has a 'Code' column.", "error");
          return;
        }

        const res = await fetch("/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productsToUpload),
        });

        if (res.ok) {
          showNotification(`Successfully imported ${productsToUpload.length} products!`);
          fetchProducts();
          logEvent("BULK_IMPORT", `Imported ${productsToUpload.length} products via Excel`);
          // Reset file input
          e.target.value = "";
        } else {
          const err = await res.json();
          showNotification(`Upload failed: ${err.message}`, "error");
        }
      } catch (err) {
        console.error("Excel parse error:", err);
        showNotification("Failed to parse Excel file. Please ensure it's a valid .xlsx or .xls file.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updatePassword = async (role: "admin" | "cashier") => {
    const password = passwords[role];
    if (!password) return;
    await fetch("/api/users/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, password }),
    });
    showNotification(`${role} password updated!`);
  };

  const updateShopName = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "shop_name", value: shopName }),
    });
    showNotification("Shop name updated!");
  };

  const updateSetting = async (key: string, value: string) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    showNotification(`${key.replace(/_/g, ' ')} updated!`);
  };

  const themeColors: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500",
    blue: "text-blue-500 bg-blue-500",
    violet: "text-violet-500 bg-violet-500",
    rose: "text-rose-500 bg-rose-500",
    amber: "text-amber-500 bg-amber-500",
  };

  const getThemeColor = (type: "text" | "bg" | "border" | "shadow" | "fill") => {
    const colors: Record<string, any> = {
      emerald: { text: "text-emerald-500", bg: "bg-emerald-500", border: "border-emerald-500", shadow: "shadow-emerald-500/20", fill: "fill-emerald-500" },
      blue: { text: "text-blue-500", bg: "bg-blue-500", border: "border-blue-500", shadow: "shadow-blue-500/20", fill: "fill-blue-500" },
      violet: { text: "text-violet-500", bg: "bg-violet-500", border: "border-violet-500", shadow: "shadow-violet-500/20", fill: "fill-violet-500" },
      rose: { text: "text-rose-500", bg: "bg-rose-500", border: "border-rose-500", shadow: "shadow-rose-500/20", fill: "fill-rose-500" },
      amber: { text: "text-amber-500", bg: "bg-amber-500", border: "border-amber-500", shadow: "shadow-amber-500/20", fill: "fill-amber-500" },
    };
    return colors[appTheme]?.[type] || colors.emerald[type];
  };

  const [passwords, setPasswords] = useState({ admin: "", cashier: "" });

  const isDark = themeMode === "dark";

  const filteredProducts = products.filter(p => 
    p.code.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.description.toLowerCase().includes(productSearch.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "pos") return;

      // Esc: Focus product search
      if (e.key === "Escape") {
        e.preventDefault();
        productSearchRef.current?.focus();
        setProductSearch("");
        setSelectedProductIndex(-1);
      }

      // Shift + M: Focus member search
      if (e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        memberSearchRef.current?.focus();
      }

      // Shift + C: New member modal
      if (e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setShowRegisterModal(true);
      }

      // Shift + H: Hold bill
      if (e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        holdBill();
      }

      // Shift + R: Recall bill
      if (e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        recallBill();
      }

      // Space: Complete sale
      if (e.key === " " && !showPaymentModal && !showSuccessModal && !showErrorModal) {
        const isSearchInput = document.activeElement === productSearchRef.current;
        const isOtherInput = document.activeElement?.tagName === "INPUT" && !isSearchInput;
        
        // Trigger checkout if not in another input, AND (not in search input OR search input is empty)
        if (!isOtherInput && (!isSearchInput || productSearch === "")) {
          e.preventDefault();
          if (cart.length > 0) {
            setShowPaymentModal(true);
          }
        }
      }

      // Arrow keys for product search navigation
      if (productSearch && filteredProducts.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedProductIndex(prev => (prev + 1) % filteredProducts.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedProductIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
        } else if (e.key === "Enter" && selectedProductIndex >= 0) {
          e.preventDefault();
          addToCart(filteredProducts[selectedProductIndex]);
          setProductSearch("");
          setSelectedProductIndex(-1);
        }
      } else if (cart.length > 0) {
        // Navigation in cart when search is empty
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCartIndex(prev => (prev + 1) % cart.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCartIndex(prev => (prev - 1 + cart.length) % cart.length);
        }
      }

      // F2: Focus product search or change qty
      if (e.key === "F2" && !showPaymentModal && !showSuccessModal && !showErrorModal) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastF2PressTime < 500 && selectedCartIndex >= 0) {
          // Double press F2
          const item = cart[selectedCartIndex];
          const newQty = prompt(`Enter new quantity for ${item.description}:`, item.cartQty.toString());
          if (newQty !== null) {
            const qty = parseInt(newQty);
            if (!isNaN(qty) && qty > 0) {
              setCart(prev => prev.map((p, i) => i === selectedCartIndex ? { ...p, cartQty: qty } : p));
            }
          }
        } else {
          // Single press F2
          productSearchRef.current?.focus();
        }
        setLastF2PressTime(now);
      }

      // F4: Remove item
      if (e.key === "F4" && !showPaymentModal && !showSuccessModal && !showErrorModal) {
        e.preventDefault();
        if (selectedCartIndex >= 0) {
          removeFromCart(selectedCartIndex);
        }
      }

      // Shift + X: Exchange
      if (e.shiftKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        setShowExchangeModal(true);
      }

      // Shift + U: Return
      if (e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        setShowReturnModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, productSearch, filteredProducts, selectedProductIndex, cart, selectedCartIndex, lastF2PressTime, showPaymentModal, showSuccessModal, showErrorModal]);

  if (showSplash) {
    return (
      <AnimatePresence>
        <SplashScreen 
          onComplete={() => setShowSplash(false)} 
          shopName={shopName}
          appLogo={appLogo}
        />
      </AnimatePresence>
    );
  }

  if (!role) return <Login onLogin={setRole} shopName={shopName} appLogo={appLogo} getThemeColor={getThemeColor} />;

  return (
    <div className={cn(
      "min-h-screen flex flex-col lg:flex-row w-full max-w-[1440px] mx-auto relative transition-colors duration-300",
      isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
    )}>
      <Bill 
        items={cart} 
        member={member} 
        discount={totalDiscount} 
        total={finalTotal} 
        shopName={shopName} 
        appLogo={appLogo}
        billQrData={billQrData}
        billRef={billRef}
        pointsRedeemed={redeemPoints}
        pointsEarned={pointsEarned}
        transactionId={currentTransactionId}
        receivedAmount={receivedAmount}
        changeAmount={changeAmount}
      />
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 20, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={cn(
              "fixed top-0 left-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md",
              notification.type === "success" 
                ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("border").replace("border-", "border-opacity-20 border-"), getThemeColor("text")) 
                : notification.type === "info"
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                  : "bg-red-500/10 border-red-500/20 text-red-500"
            )}
          >
            {notification.type === "success" ? <CheckCircle2 size={20} /> : notification.type === "info" ? <Info size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <div className={cn(
        "lg:hidden flex items-center justify-between p-4 border-b sticky top-0 z-[100] backdrop-blur-md",
        isDark ? "bg-zinc-900/80 border-zinc-800" : "bg-white/80 border-zinc-200"
      )}>
        <div className="flex items-center gap-3">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <h1 className={cn("text-lg font-bold", getThemeColor("text"))}>{shopName}</h1>
          )}
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className={cn("p-2 rounded-lg", isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] lg:hidden"
            />
            <motion.nav 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "fixed top-0 left-0 bottom-0 w-72 z-[160] p-6 flex flex-col gap-2 lg:hidden",
                isDark ? "bg-zinc-900 border-r border-zinc-800" : "bg-white border-r border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  {appLogo ? (
                    <img src={appLogo} alt="Logo" className="h-10 w-auto object-contain" />
                  ) : (
                    <h1 className={cn("text-xl font-bold", getThemeColor("text"))}>{shopName}</h1>
                  )}
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn("p-2 rounded-lg", isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                <button 
                  onClick={() => { setActiveTab("pos"); setIsMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                    activeTab === "pos" 
                      ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                      : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                  )}
                >
                  <ShoppingCart size={20} /> POS
                </button>

                {(role === "admin" || role === "dev") && (
                  <>
                    <button 
                      onClick={() => { setActiveTab("inventory"); setIsMobileMenuOpen(false); }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                        activeTab === "inventory" 
                          ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                          : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                      )}
                    >
                      <Package size={20} /> Inventory
                    </button>
                    <button 
                      onClick={() => { setActiveTab("members"); setIsMobileMenuOpen(false); }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                        activeTab === "members" 
                          ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                          : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                      )}
                    >
                      <Users size={20} /> Members
                    </button>
                    <button 
                      onClick={() => { setActiveTab("reports"); setIsMobileMenuOpen(false); }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                        activeTab === "reports" 
                          ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                          : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                      )}
                    >
                      <LayoutDashboard size={20} /> Sales Report
                    </button>
                  </>
                )}

                <button 
                  onClick={() => { setActiveTab("history"); setIsMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                    activeTab === "history" 
                      ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                      : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                  )}
                >
                  <RotateCcw size={20} /> History
                </button>

                <button 
                  onClick={() => { setActiveTab("about"); setIsMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                    activeTab === "about" 
                      ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                      : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                  )}
                >
                  <Info size={20} /> About
                </button>

                {role === "dev" && (
                  <button 
                    onClick={() => { setActiveTab("dev"); setIsMobileMenuOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full", 
                      activeTab === "dev" 
                        ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                        : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100")
                    )}
                  >
                    <Settings size={20} /> Dev Options
                  </button>
                )}
              </div>

              <div className={cn("mt-auto pt-4 border-t", isDark ? "border-zinc-800" : "border-zinc-200")}>
                <button 
                  onClick={() => setThemeMode(isDark ? "light" : "dark")}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all border mb-2 w-full",
                    isDark ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 w-full transition-all"
                >
                  <LogOut size={20} /> Logout
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.nav 
        initial={false}
        animate={{ width: isSidebarOpen ? 256 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "hidden lg:flex border-r p-4 flex-col gap-2 shrink-0 transition-colors overflow-hidden",
          isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
        )}
      >
        <div className="mb-8 px-2 flex flex-col gap-4 overflow-hidden">
          <div 
            className="cursor-pointer group" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-12 w-auto mb-4 object-contain transition-transform group-hover:scale-110" />
            ) : (
              <h1 className={cn("text-xl font-bold truncate transition-transform group-hover:scale-110", getThemeColor("text"))}>
                {isSidebarOpen ? shopName : shopName[0]}
              </h1>
            )}
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn("text-xs uppercase tracking-widest mt-1 truncate", isDark ? "text-zinc-500" : "text-zinc-400")}
                >
                  {role} Mode
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            onClick={() => setThemeMode(isDark ? "light" : "dark")}
            className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition-all border overflow-hidden",
              isDark ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200",
              !isSidebarOpen && "justify-center px-0"
            )}
            title={!isSidebarOpen ? (isDark ? "Light Mode" : "Dark Mode") : ""}
          >
            <span className="shrink-0">{isDark ? <Sun size={20} /> : <Moon size={20} />}</span>
            {isSidebarOpen && <span className="truncate">{isDark ? "Light Mode" : "Dark Mode"}</span>}
          </button>
        </div>

        <button 
          onClick={() => setActiveTab("pos")}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
            activeTab === "pos" 
              ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
              : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
            !isSidebarOpen && "justify-center px-0"
          )}
          title={!isSidebarOpen ? "POS" : ""}
        >
          <ShoppingCart size={20} className="shrink-0" />
          {isSidebarOpen && <span className="truncate">POS</span>}
        </button>

        {(role === "admin" || role === "dev") && (
          <>
            <button 
              onClick={() => setActiveTab("inventory")}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
                activeTab === "inventory" 
                  ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                  : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
                !isSidebarOpen && "justify-center px-0"
              )}
              title={!isSidebarOpen ? "Inventory" : ""}
            >
              <Package size={20} className="shrink-0" />
              {isSidebarOpen && <span className="truncate">Inventory</span>}
            </button>
            <button 
              onClick={() => setActiveTab("members")}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
                activeTab === "members" 
                  ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                  : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
                !isSidebarOpen && "justify-center px-0"
              )}
              title={!isSidebarOpen ? "Members" : ""}
            >
              <Users size={20} className="shrink-0" />
              {isSidebarOpen && <span className="truncate">Members</span>}
            </button>
            <button 
              onClick={() => setActiveTab("reports")}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
                activeTab === "reports" 
                  ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                  : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
                !isSidebarOpen && "justify-center px-0"
              )}
              title={!isSidebarOpen ? "Sales Report" : ""}
            >
              <LayoutDashboard size={20} className="shrink-0" />
              {isSidebarOpen && <span className="truncate">Sales Report</span>}
            </button>
          </>
        )}

        <button 
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
            activeTab === "history" 
              ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
              : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
            !isSidebarOpen && "justify-center px-0"
          )}
          title={!isSidebarOpen ? "History" : ""}
        >
          <RotateCcw size={20} className="shrink-0" />
          {isSidebarOpen && <span className="truncate">History</span>}
        </button>

        <button 
          onClick={() => setActiveTab("about")}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
            activeTab === "about" 
              ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
              : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
            !isSidebarOpen && "justify-center px-0"
          )}
          title={!isSidebarOpen ? "About" : ""}
        >
          <Info size={20} className="shrink-0" />
          {isSidebarOpen && <span className="truncate">About</span>}
        </button>

        {role === "dev" && (
          <button 
            onClick={() => setActiveTab("dev")}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all overflow-hidden", 
              activeTab === "dev" 
                ? cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text")) 
                : cn(isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"),
              !isSidebarOpen && "justify-center px-0"
            )}
            title={!isSidebarOpen ? "Dev Options" : ""}
          >
            <Settings size={20} className="shrink-0" />
            {isSidebarOpen && <span className="truncate">Dev Options</span>}
          </button>
        )}

        <div className={cn("mt-auto pt-4 border-t", isDark ? "border-zinc-800" : "border-zinc-200")}>
          <button 
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 w-full transition-all overflow-hidden",
              !isSidebarOpen && "justify-center px-0"
            )}
            title={!isSidebarOpen ? "Logout" : ""}
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="truncate">Logout</span>}
          </button>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className={cn(
        "flex-1 p-4 lg:p-8 transition-colors",
        activeTab === "pos" ? "lg:h-screen lg:overflow-hidden" : "overflow-auto",
        isDark ? "bg-zinc-950" : "bg-zinc-50"
      )}>
        <AnimatePresence mode="wait">
          {activeTab === "pos" && (
            <motion.div 
              key="pos"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6 lg:h-full"
            >
              {/* Full Screen Order Header */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Integrated Product Search */}
                <div className="relative w-full md:w-96">
                  <div className={cn(
                    "flex items-center gap-4 p-3 rounded-2xl border transition-colors w-full",
                    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <Search className="text-zinc-500" size={20} />
                    <input 
                      ref={productSearchRef}
                      type="text" 
                      placeholder="Search products to add..." 
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setSelectedProductIndex(-1);
                      }}
                      className={cn("bg-transparent border-none focus:outline-none w-full", isDark ? "text-white" : "text-zinc-900")}
                    />
                  </div>
                  
                  {productSearch && (
                    <div className={cn(
                      "absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-2xl overflow-hidden z-[110] max-h-96 overflow-y-auto",
                      isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    )}>
                      {filteredProducts
                        .map((p, index) => (
                          <button 
                            key={p.code}
                            onClick={() => {
                              addToCart(p);
                              setProductSearch("");
                              setSelectedProductIndex(-1);
                            }}
                            onMouseEnter={() => setSelectedProductIndex(index)}
                            disabled={p.qty <= 0}
                            className={cn(
                              "w-full text-left p-4 border-b last:border-none flex justify-between items-center transition-all",
                              isDark ? "hover:bg-zinc-800 border-zinc-800" : "hover:bg-zinc-50 border-zinc-100",
                              selectedProductIndex === index && (isDark ? "bg-zinc-800" : "bg-zinc-100"),
                              p.qty <= 0 && "opacity-50"
                            )}
                          >
                            <div>
                              <div className="font-bold">{p.description}</div>
                              <div className="text-xs text-zinc-500">{p.code} • Stock: {p.qty}</div>
                            </div>
                            <div className={cn("font-bold", getThemeColor("text"))}>{(p.selling_price || 0).toFixed(2)} ৳</div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-black tracking-tighter">Current Order</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 lg:overflow-hidden">
                {/* Cart Items Table */}
                <div className={cn(
                  "lg:col-span-2 rounded-3xl border flex flex-col lg:overflow-hidden",
                  isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                )}>
                  <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className={cn("text-zinc-500 text-xs uppercase tracking-wider sticky top-0 z-10", isDark ? "bg-zinc-900" : "bg-white")}>
                        <tr>
                          <th className="px-6 py-4">Product</th>
                          <th className="px-6 py-4">Price</th>
                          <th className="px-6 py-4">Qty</th>
                          <th className="px-6 py-4">Total</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className={cn("divide-y", isDark ? "divide-zinc-800" : "divide-zinc-100")}>
                        {cart.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-zinc-500">
                              <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                              <p>No items in cart. Use search to add products.</p>
                            </td>
                          </tr>
                        ) : (
                          cart.map((item, index) => (
                            <tr 
                              key={`${item.code}-${item.isReturn ? 'return' : 'sale'}`} 
                              onClick={() => setSelectedCartIndex(index)}
                              className={cn(
                                "transition-colors cursor-pointer", 
                                isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50",
                                selectedCartIndex === index && (isDark ? "bg-zinc-800/50" : "bg-zinc-100"),
                                item.isReturn && (isDark ? "bg-red-500/5" : "bg-red-50")
                              )}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {item.isReturn && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold uppercase">Return</span>
                                  )}
                                  <div>
                                    <div className="font-bold">{item.description}</div>
                                    <div className="text-xs text-zinc-500">{item.code}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(item.isReturn && "text-red-500")}>
                                  {Math.abs(item.selling_price || 0).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCart(prev => prev.map((p, i) => i === index ? { ...p, cartQty: p.isReturn ? Math.min(-1, p.cartQty + 1) : Math.max(1, p.cartQty - 1) } : p));
                                    }}
                                    className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-bold">{Math.abs(item.cartQty)}</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (item.isReturn) {
                                        if (Math.abs(item.cartQty) < (item.originalQty || 1)) {
                                          setCart(prev => prev.map((p, i) => i === index ? { ...p, cartQty: p.cartQty - 1 } : p));
                                        } else {
                                          showNotification("Cannot return more than original quantity", "error");
                                        }
                                      } else {
                                        addToCart(item);
                                      }
                                    }}
                                    className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold">
                                <span className={cn(item.isReturn && "text-red-500")}>
                                  {Math.abs((item.selling_price || 0) * item.cartQty).toFixed(2)} ৳
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFromCart(index);
                                  }} 
                                  className="text-zinc-500 hover:text-red-400"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary & Checkout */}
                <div className="flex flex-col gap-6">
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={holdBill}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase transition-all",
                        heldBill 
                          ? "animate-hold-glow text-white" 
                          : isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      )}
                    >
                      <Pause size={16} />
                      Hold
                    </button>
                    <button 
                      onClick={recallBill}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase transition-all",
                        isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      )}
                    >
                      <RotateCcw size={16} />
                      Recall
                    </button>
                    <button 
                      onClick={() => setShowReturnModal(true)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase transition-all",
                        isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      )}
                    >
                      <ArrowLeftRight size={16} />
                      Return
                    </button>
                    <button 
                      onClick={() => setShowExchangeModal(true)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase transition-all",
                        isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      )}
                    >
                      <RefreshCw size={16} />
                      Exchange
                    </button>
                  </div>

                  <div className={cn(
                    "rounded-3xl border flex flex-col transition-colors mt-4",
                    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-lg"
                  )}>
                    <div className="p-6 space-y-6">
                      <h3 className="text-xl font-bold">Order Summary</h3>
                    
                    {/* Member Section */}
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            ref={memberSearchRef}
                            type="text" 
                            placeholder="Search Member..." 
                            value={memberSearch}
                            onChange={(e) => searchMembers(e.target.value)}
                            className={cn(
                              "w-full border rounded-xl px-4 py-2 text-sm",
                              isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200"
                            )}
                          />
                          {showMemberResults && memberResults.length > 0 && (
                            <div className={cn(
                              "absolute bottom-full mb-2 left-0 right-0 border rounded-xl shadow-2xl overflow-hidden z-50",
                              isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200"
                            )}>
                              {memberResults.map(m => (
                                <button 
                                  key={m.phone}
                                  onClick={() => {
                                    setMember(m);
                                    setShowMemberResults(false);
                                    setMemberSearch(m.name);
                                  }}
                                  className={cn(
                                    "w-full text-left px-4 py-2 text-sm border-b last:border-none",
                                    isDark ? "hover:bg-zinc-700 border-zinc-700" : "hover:bg-zinc-50 border-zinc-100"
                                  )}
                                >
                                  <div className="font-bold">{m.name}</div>
                                  <div className="text-xs text-zinc-400">{m.phone} • {m.points} pts</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => setShowRegisterModal(true)}
                          className={cn("px-4 rounded-xl text-xs font-bold uppercase", getThemeColor("bg"), "text-white")}
                        >
                          New
                        </button>
                      </div>
                      {member && (
                        <div className={cn("border p-4 rounded-2xl flex justify-between items-center", getThemeColor("bg"), "bg-opacity-10", getThemeColor("border").replace("border-", "border-opacity-20 border-"))}>
                          <div>
                            <div className={cn("font-bold", getThemeColor("text"))}>{member.name}</div>
                            <div className="text-xs text-zinc-400">Points: {member.points}</div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const pts = Number(prompt(`Redeem points? (Min: 2, Max: ${Math.min(member.points, Math.floor(cartTotal))})`, "0"));
                                if (pts === 0) setRedeemPoints(0);
                                else if (pts < 2) showNotification("Minimum redemption is 2 points", "error");
                                else if (pts > member.points) showNotification("Insufficient points", "error");
                                else if (pts > cartTotal) showNotification("Redemption cannot exceed bill total", "error");
                                else setRedeemPoints(pts);
                              }}
                              className={cn("text-xs text-white px-3 py-1.5 rounded-lg", getThemeColor("bg"))}
                            >
                              Redeem
                            </button>
                            <button 
                              onClick={() => {
                                setMember(null);
                                setMemberSearch("");
                                setRedeemPoints(0);
                              }}
                              className="text-xs bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-zinc-800">
                      {cart.some(i => i.isReturn) && (
                        <>
                          <div className="flex justify-between text-red-400 text-sm">
                            <span>Return Amount</span>
                            <span>{Math.abs(cart.filter(i => i.isReturn).reduce((sum, i) => sum + (i.selling_price * i.cartQty), 0)).toFixed(2)} ৳</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 text-sm">
                            <span>New Items Amount</span>
                            <span>{cart.filter(i => !i.isReturn).reduce((sum, i) => sum + (i.selling_price * i.cartQty), 0).toFixed(2)} ৳</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-zinc-400">
                        <span>Net Subtotal</span>
                        <span>{(cartTotal || 0).toFixed(2)} ৳</span>
                      </div>
                      <div className="flex justify-between text-red-400">
                        <span>Discount</span>
                        <input 
                          type="number" 
                          value={customDiscount} 
                          onChange={(e) => setCustomDiscount(Number(e.target.value))}
                          className="w-24 bg-transparent text-right border-b border-zinc-700 focus:outline-none"
                        />
                      </div>
                      {redeemPoints > 0 && (
                        <div className={cn("flex justify-between", getThemeColor("text"))}>
                          <span>Points Discount</span>
                          <span>-{(redeemPoints || 0).toFixed(2)} ৳</span>
                        </div>
                      )}
                      <div className="flex justify-between text-3xl font-black pt-4 border-t border-zinc-800">
                        <span>Total</span>
                        <span>{(finalTotal || 0).toFixed(2)} ৳</span>
                      </div>
                    </div>

                    <button 
                      ref={completeSaleBtnRef}
                      onClick={() => setShowPaymentModal(true)}
                      disabled={cart.length === 0}
                      className={cn(
                        "w-full text-white font-bold py-5 rounded-3xl shadow-2xl transition-all disabled:bg-zinc-800 disabled:shadow-none",
                        getThemeColor("bg"),
                        getThemeColor("shadow")
                      )}
                    >
                      Complete Sale
                    </button>
                  </div>
                </div>
              </div>
            </div>
              
              {/* Modals */}
              <AnimatePresence>
                {showPaymentModal && (
                  <PaymentModal 
                    total={finalTotal}
                    isDark={isDark}
                    getThemeColor={getThemeColor}
                    onClose={() => setShowPaymentModal(false)}
                    onSave={handleCheckout}
                  />
                )}

                {showSuccessModal && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "w-full max-w-md rounded-3xl p-8 text-center space-y-6 border shadow-2xl",
                        isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                      )}
                    >
                      <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={48} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold">Sale Completed!</h3>
                        <p className="text-zinc-500">Thank you for your business.</p>
                      </div>
                      
                      <div className={cn("p-6 rounded-2xl space-y-4", isDark ? "bg-zinc-950" : "bg-zinc-50")}>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Received:</span>
                          <span className="font-bold">{receivedAmount.toFixed(2)} ৳</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">{finalTotal < 0 ? "Refund Total:" : "Bill Total:"}</span>
                          <span className="font-bold">{Math.abs(finalTotal).toFixed(2)} ৳</span>
                        </div>
                        <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                          <span className="text-zinc-500 font-bold">Change:</span>
                          <span className="text-2xl font-black text-emerald-500">{changeAmount.toFixed(2)} ৳</span>
                        </div>

                        {changeAmount >= 1 && (
                          <div className="pt-4 space-y-2">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider text-left">Change Breakdown (Notes)</div>
                            <div className="flex flex-wrap gap-2">
                              {getChangeBreakdown(changeAmount).map((b, i) => (
                                <div 
                                  key={i}
                                  className={cn(
                                    "px-3 py-1.5 rounded-xl border flex items-center gap-2",
                                    isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
                                  )}
                                >
                                  <span className="text-xs font-bold text-zinc-500">{b.count}x</span>
                                  <span className={cn("font-bold", getThemeColor("text"))}>{b.note} ৳</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => setShowSuccessModal(false)}
                        className={cn("w-full py-4 rounded-2xl text-white font-bold", getThemeColor("bg"))}
                      >
                        Close & New Order
                      </button>
                    </motion.div>
                  </div>
                )}

                {showErrorModal && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "w-full max-w-md rounded-3xl p-8 text-center space-y-6 border shadow-2xl",
                        isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                      )}
                    >
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle size={48} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-red-500">Checkout Error</h3>
                        <p className="text-zinc-500">{checkoutError}</p>
                      </div>
                      
                      <button 
                        onClick={() => setShowErrorModal(false)}
                        className="w-full py-4 rounded-2xl bg-zinc-800 text-white font-bold"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Register Member Modal */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-bold">Register New Member</h3>
                <button onClick={() => setShowRegisterModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={registerMember} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Phone Number</label>
                  <input 
                    type="tel" 
                    required
                    placeholder="e.g. 01700000000"
                    value={newMemberData.phone}
                    onChange={e => setNewMemberData({...newMemberData, phone: e.target.value})}
                    className={cn(
                      "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none transition-all",
                      getThemeColor("border").replace("border-", "focus:border-")
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Customer Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe"
                    value={newMemberData.name}
                    onChange={e => setNewMemberData({...newMemberData, name: e.target.value})}
                    className={cn(
                      "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none transition-all",
                      getThemeColor("border").replace("border-", "focus:border-")
                    )}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className={cn("flex-1 text-white font-bold py-3 rounded-xl transition-all", getThemeColor("bg"))}
                  >
                    Register Member
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-bold">Points History</h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-zinc-500 hover:text-white">
                  <Trash2 size={24} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-auto p-6">
                {selectedMemberHistory.length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">No history found</p>
                ) : (
                  <div className="space-y-4">
                    {selectedMemberHistory.map(h => (
                      <div key={h.id} className="flex justify-between items-center bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                        <div>
                          <div className="font-bold text-sm">{h.reason}</div>
                          <div className="text-xs text-zinc-500">{format(new Date(h.created_at), "PPP p")}</div>
                        </div>
                        <div className={cn(
                          "font-bold text-lg",
                          h.change > 0 ? getThemeColor("text") : "text-red-500"
                        )}>
                          {h.change > 0 ? "+" : ""}{h.change}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-6 bg-zinc-800/50 text-center">
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white px-8 py-2 rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            </motion.div>
          )}

          {activeTab === "inventory" && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold">Inventory Management</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border w-full sm:w-64 transition-colors",
                    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <Search size={18} className="text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Search by code, name, category..." 
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className={cn("bg-transparent border-none focus:outline-none text-sm w-full", isDark ? "text-white" : "text-zinc-900")}
                    />
                  </div>
                  <button 
                    onClick={downloadInventoryData}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border",
                      isDark ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50 shadow-sm"
                    )}
                  >
                    <Download size={18} /> Download Inventory
                  </button>
                  {(role === "admin" || role === "dev") && (
                    <button 
                      onClick={() => setActiveTab("add-product")}
                      className={cn("text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap", getThemeColor("bg"))}
                    >
                      <Plus size={20} /> Add Product
                    </button>
                  )}
                </div>
              </div>

              {/* Inventory Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total SKU", value: products.length, icon: Package },
                  { label: "Total Stock Qty", value: products.reduce((sum, p) => sum + p.qty, 0), icon: ShoppingCart },
                  { label: "Total Cost Value", value: `${products.reduce((sum, p) => sum + (p.cost_price * p.qty), 0).toFixed(2)} ৳`, icon: Download },
                  { label: "Total Selling Value", value: `${products.reduce((sum, p) => sum + (p.selling_price * p.qty), 0).toFixed(2)} ৳`, icon: LayoutDashboard },
                ].map((stat, i) => (
                  <div key={i} className={cn("p-6 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                    <div className="flex items-center gap-3 mb-2">
                      <stat.icon size={18} className="text-zinc-500" />
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">{stat.label}</div>
                    </div>
                    <div className={cn("text-2xl font-bold", i === 3 ? getThemeColor("text") : "")}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className={cn("rounded-3xl border overflow-hidden transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className={cn("text-zinc-400 text-xs uppercase tracking-wider", isDark ? "bg-zinc-800/50" : "bg-zinc-50")}>
                      <tr>
                        <th className="px-6 py-4">Code</th>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Cost</th>
                        <th className="px-6 py-4">Selling</th>
                        <th className="px-6 py-4">Stock</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y", isDark ? "divide-zinc-800" : "divide-zinc-100")}>
                      {products
                        .filter(p => 
                          (p.code || "").toLowerCase().includes(inventorySearch.toLowerCase()) || 
                          (p.description || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
                          (p.category || "").toLowerCase().includes(inventorySearch.toLowerCase())
                        )
                        .map(p => (
                        <tr key={p.code} className={cn("transition-all", isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50")}>
                          <td className="px-6 py-4 font-mono text-sm">{p.code}</td>
                          <td className="px-6 py-4">{p.description}</td>
                          <td className="px-6 py-4"><span className={cn("px-2 py-1 rounded text-xs", isDark ? "bg-zinc-800" : "bg-zinc-100")}>{p.category}</span></td>
                          <td className="px-6 py-4">{(p.cost_price || 0).toFixed(2)}</td>
                          <td className={cn("px-6 py-4 font-bold", getThemeColor("text"))}>{(p.selling_price || 0).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold",
                              p.qty < 5 ? "bg-red-500/10 text-red-500" : cn(getThemeColor("bg"), "bg-opacity-10", getThemeColor("text"))
                            )}>
                              {p.qty} units
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "add-product" && (
            <motion.div 
              key="add-product"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
                <h2 className="text-2xl font-bold mb-6">Add New Product</h2>
                <form onSubmit={handleAddProduct} className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm text-zinc-400 mb-2">Product Code</label>
                    <input 
                      type="text" 
                      required
                      value={newProduct.code}
                      onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-zinc-400 mb-2">Description</label>
                    <input 
                      type="text" 
                      required
                      value={newProduct.description}
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Category</label>
                    <input 
                      type="text" 
                      required
                      value={newProduct.category}
                      onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Cost Price</label>
                    <input 
                      type="number" 
                      required
                      value={newProduct.cost_price}
                      onChange={e => setNewProduct({...newProduct, cost_price: Number(e.target.value)})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Quantity</label>
                    <input 
                      type="number" 
                      required
                      value={newProduct.qty}
                      onChange={e => setNewProduct({...newProduct, qty: Number(e.target.value)})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className={cn("border p-3 rounded-xl w-full", getThemeColor("bg"), "bg-opacity-10", getThemeColor("border").replace("border-", "border-opacity-20 border-"))}>
                      <div className={cn("text-[10px] uppercase font-bold", getThemeColor("text"))}>Auto Selling Price (+12%)</div>
                      <div className="text-xl font-bold">{((newProduct.cost_price || 0) * 1.12).toFixed(2)} ৳</div>
                    </div>
                  </div>
                  <div className="col-span-2 flex gap-4 mt-4">
                    <button 
                      type="submit"
                      className={cn("flex-1 text-white font-bold py-4 rounded-2xl", getThemeColor("bg"))}
                    >
                      Save Product
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveTab("inventory")}
                      className="px-8 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === "members" && (
            <motion.div 
              key="members"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold">Membership Directory</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border w-full sm:w-64 transition-colors",
                    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <Search size={18} className="text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Search by name or phone..." 
                      value={memberDirectorySearch}
                      onChange={(e) => setMemberDirectorySearch(e.target.value)}
                      className={cn("bg-transparent border-none focus:outline-none text-sm w-full", isDark ? "text-white" : "text-zinc-900")}
                    />
                  </div>
                  <button 
                    onClick={() => setShowRegisterModal(true)}
                    className={cn("text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap", getThemeColor("bg"))}
                  >
                    <Plus size={20} /> Register Member
                  </button>
                </div>
              </div>

              <div className={cn("rounded-3xl border overflow-hidden transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className={cn("text-zinc-400 text-xs uppercase tracking-wider", isDark ? "bg-zinc-800/50" : "bg-zinc-50")}>
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Phone</th>
                        <th className="px-6 py-4">Points</th>
                        <th className="px-6 py-4">Joined</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y", isDark ? "divide-zinc-800" : "divide-zinc-100")}>
                      {allMembers
                        .filter(m => 
                          m.name.toLowerCase().includes(memberDirectorySearch.toLowerCase()) || 
                          m.phone.includes(memberDirectorySearch)
                        )
                        .map(m => (
                          <tr key={m.phone} className={cn("transition-all", isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50")}>
                            <td className="px-6 py-4 font-bold">{m.name}</td>
                            <td className="px-6 py-4 text-zinc-400">{m.phone}</td>
                            <td className="px-6 py-4">
                              <span className={cn("px-3 py-1 rounded-full font-bold text-sm", getThemeColor("bg"), "bg-opacity-10", getThemeColor("text"))}>
                                {m.points} pts
                              </span>
                            </td>
                            <td className="px-6 py-4 text-zinc-500 text-sm">
                              {m.created_at ? format(new Date(m.created_at), "MMM d, yyyy") : "-"}
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => fetchMemberHistory(m.phone)}
                                className={cn("hover:underline text-sm font-medium", getThemeColor("text"))}
                              >
                                View History
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "reports" && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold">Sales Reports</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border w-full sm:w-64 transition-colors",
                    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <Search size={18} className="text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Search by product, code, ID..." 
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      className={cn("bg-transparent border-none focus:outline-none text-sm w-full", isDark ? "text-white" : "text-zinc-900")}
                    />
                  </div>
                  <button 
                    onClick={downloadSalesReport}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border",
                      isDark ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50 shadow-sm"
                    )}
                  >
                    <Download size={18} /> Download Report
                  </button>
                  <div className={cn(
                    "flex items-center gap-2 p-2 rounded-2xl border transition-colors",
                    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <Calendar size={18} className="text-zinc-500 ml-2" />
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={e => setDateRange({...dateRange, start: e.target.value})}
                      className={cn("bg-transparent border-none text-sm focus:outline-none", isDark ? "text-white" : "text-zinc-900")}
                    />
                    <span className="text-zinc-500">to</span>
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={e => setDateRange({...dateRange, end: e.target.value})}
                      className={cn("bg-transparent border-none text-sm focus:outline-none", isDark ? "text-white" : "text-zinc-900")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: "Total Revenue", value: `${sales.filter(s => 
                    s.description.toLowerCase().includes(salesSearch.toLowerCase()) || 
                    s.product_code.toLowerCase().includes(salesSearch.toLowerCase()) || 
                    (s.transaction_id && s.transaction_id.toLowerCase().includes(salesSearch.toLowerCase())) ||
                    (s.member_phone && s.member_phone.includes(salesSearch))
                  ).reduce((sum, s) => sum + (s.total_price || 0), 0).toFixed(2)} ৳`, color: getThemeColor("text") },
                  { label: "Total Sales", value: sales.filter(s => 
                    s.description.toLowerCase().includes(salesSearch.toLowerCase()) || 
                    s.product_code.toLowerCase().includes(salesSearch.toLowerCase()) || 
                    (s.transaction_id && s.transaction_id.toLowerCase().includes(salesSearch.toLowerCase())) ||
                    (s.member_phone && s.member_phone.includes(salesSearch))
                  ).length },
                  { label: "Items Sold", value: sales.filter(s => 
                    s.description.toLowerCase().includes(salesSearch.toLowerCase()) || 
                    s.product_code.toLowerCase().includes(salesSearch.toLowerCase()) || 
                    (s.transaction_id && s.transaction_id.toLowerCase().includes(salesSearch.toLowerCase())) ||
                    (s.member_phone && s.member_phone.includes(salesSearch))
                  ).reduce((sum, s) => sum + s.qty, 0) },
                ].map((stat, i) => (
                  <div key={i} className={cn("p-6 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                    <div className="text-zinc-500 text-sm mb-1">{stat.label}</div>
                    <div className={cn("text-3xl font-bold", stat.color || "")}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className={cn("rounded-3xl border overflow-hidden transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className={cn("text-zinc-400 text-xs uppercase tracking-wider", isDark ? "bg-zinc-800/50" : "bg-zinc-50")}>
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4">Qty</th>
                        <th className="px-6 py-4">Total</th>
                        <th className="px-6 py-4">Member</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y", isDark ? "divide-zinc-800" : "divide-zinc-100")}>
                      {sales
                        .filter(s => 
                          s.description.toLowerCase().includes(salesSearch.toLowerCase()) || 
                          s.product_code.toLowerCase().includes(salesSearch.toLowerCase()) || 
                          (s.transaction_id && s.transaction_id.toLowerCase().includes(salesSearch.toLowerCase())) ||
                          (s.member_phone && s.member_phone.includes(salesSearch))
                        )
                        .map(s => (
                        <tr key={s.id} className={cn("transition-all", isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50")}>
                          <td className="px-6 py-4 text-sm">{s.date}</td>
                          <td className="px-6 py-4">
                            <div className={cn("font-medium", s.qty < 0 && "text-red-500")}>{s.description}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{s.product_code}</div>
                            {s.transaction_id && (
                              <div className="text-[8px] text-zinc-600 mt-1 uppercase">{s.transaction_id}</div>
                            )}
                          </td>
                          <td className={cn("px-6 py-4", s.qty < 0 && "text-red-500")}>{s.qty}</td>
                          <td className={cn("px-6 py-4 font-bold", s.qty < 0 && "text-red-500")}>{(s.total_price || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-zinc-500 text-sm">{s.member_phone || "-"}</td>
                          <td className="px-6 py-4 text-right">
                            {s.transaction_id && (
                              <button 
                                onClick={() => openBillPreview(s.transaction_id)}
                                className={cn("text-xs font-bold hover:underline", getThemeColor("text"))}
                              >
                                Preview Bill
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">System History (Last 12 Hours)</h2>
                <button 
                  onClick={fetchAuditLogs}
                  className={cn("p-2 rounded-xl transition-all", isDark ? "bg-zinc-800 hover:bg-zinc-700" : "bg-white border border-zinc-200 hover:bg-zinc-50 shadow-sm")}
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              <div className={cn("rounded-3xl border overflow-hidden transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className={cn("text-zinc-400 text-xs uppercase tracking-wider", isDark ? "bg-zinc-800/50" : "bg-zinc-50")}>
                      <tr>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">Event</th>
                        <th className="px-6 py-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y", isDark ? "divide-zinc-800" : "divide-zinc-100")}>
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-zinc-500 italic">No events recorded in the last 12 hours</td>
                        </tr>
                      ) : (
                        auditLogs.map(log => (
                          <tr key={log.id} className={cn("transition-all", isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50")}>
                            <td className="px-6 py-4 text-sm font-mono">
                              {format(new Date(log.created_at), "HH:mm:ss")}
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                                log.event_type === "SALE" ? "bg-emerald-500/10 text-emerald-500" :
                                log.event_type === "RETURN" ? "bg-red-500/10 text-red-500" :
                                log.event_type === "EXCHANGE" ? "bg-blue-500/10 text-blue-500" :
                                log.event_type === "BULK_IMPORT" ? "bg-purple-500/10 text-purple-500" :
                                log.event_type === "LOGIN" ? "bg-zinc-500/10 text-zinc-500" :
                                "bg-zinc-500/10 text-zinc-500"
                              )}>
                                {log.event_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "about" && (
            <motion.div 
              key="about"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8 pb-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold">About This Application</h2>
                <p className="text-zinc-500">A comprehensive guide on how to use the POS and Inventory Management System.</p>
              </div>

              <div className="grid gap-6">
                <section className={cn("p-8 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <h3 className={cn("text-xl font-bold mb-4 flex items-center gap-2", getThemeColor("text"))}>
                    <ShoppingCart size={24} /> POS (Point of Sale)
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    The POS tab is where you process sales. You can search for products by their code or description. 
                    Clicking on a product adds it to the "Current Order" cart. You can manage quantities, apply custom discounts, 
                    and redeem membership points. Once a sale is completed, a bill receipt is automatically generated for download.
                  </p>
                </section>

                <section className={cn("p-8 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <h3 className={cn("text-xl font-bold mb-4 flex items-center gap-2", getThemeColor("text"))}>
                    <Package size={24} /> Inventory Management
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Manage your stock here. You can view total stock statistics, SKU counts, and total values. 
                    Adding new products or editing existing ones is done through this interface. 
                    You can track cost prices, selling prices, and current stock levels in real-time.
                  </p>
                </section>

                <section className={cn("p-8 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <h3 className={cn("text-xl font-bold mb-4 flex items-center gap-2", getThemeColor("text"))}>
                    <Users size={24} /> Membership Directory
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Register and manage your customers. Members earn points on every purchase (1 point per 100 Taka). 
                    These points can be redeemed for discounts on future bills. You can view a member's transaction history 
                    and current point balance.
                  </p>
                </section>

                <section className={cn("p-8 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <h3 className={cn("text-xl font-bold mb-4 flex items-center gap-2", getThemeColor("text"))}>
                    <LayoutDashboard size={24} /> Sales Reports
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Analyze your business performance. Filter sales by date range, view total revenue, and see which items are selling best. 
                    You can also download detailed Excel reports for accounting purposes and preview/re-print past bills.
                  </p>
                </section>

                <section className={cn("p-8 rounded-3xl border transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <h3 className={cn("text-xl font-bold mb-4 flex items-center gap-2", getThemeColor("text"))}>
                    <Settings size={24} /> Dev Options & Settings
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Customize your application. Change the shop name, update the logo, set your theme color, 
                    and manage security passwords for Admin and Cashier roles. You can also perform bulk stock imports 
                    using Excel files.
                  </p>
                </section>

                <div className={cn("p-10 rounded-3xl border text-center space-y-4 transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-md")}>
                  <p className="text-lg font-medium">
                    The apps Is made By <span className={cn("font-bold", getThemeColor("text"))}>Double Design</span>.
                  </p>
                  <div className="space-y-1 text-zinc-400">
                    <p>For any information call: <span className="text-white font-mono">01888514118</span>, <span className="text-white font-mono">09638139968</span></p>
                    <p>or visit <a href="#" className={cn("hover:underline", getThemeColor("text"))}>Double Design Facebook Page</a></p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "dev" && (
            <motion.div 
              key="dev"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8 max-w-4xl mx-auto"
            >
              <h2 className="text-2xl font-bold">Developer Control Panel</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bulk Upload */}
                <div className={cn("p-8 rounded-3xl border space-y-6 transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <div className={cn("flex items-center gap-3", getThemeColor("text"))}>
                    <Upload size={24} />
                    <h3 className="text-lg font-bold">Bulk Stock Import</h3>
                  </div>
                  <p className="text-sm text-zinc-400">Upload an Excel file with columns: code, description, category, cost_price, selling_price, qty.</p>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleExcelUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={cn(
                      "border-2 border-dashed rounded-2xl p-8 text-center transition-all", 
                      isDark ? "border-zinc-700" : "border-zinc-200",
                      `group-hover:${getThemeColor("border")}/50`
                    )}>
                      <Download className="mx-auto mb-4 text-zinc-500" size={32} />
                      <p className="text-sm font-medium">Click or drag Excel file here</p>
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className={cn("p-8 rounded-3xl border space-y-6 transition-colors", isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm")}>
                  <div className={cn("flex items-center gap-3", getThemeColor("text"))}>
                    <Settings size={24} />
                    <h3 className="text-lg font-bold">System Settings</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase mb-2">Shop Name</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={shopName}
                          onChange={e => setShopName(e.target.value)}
                          className={cn("flex-1 border rounded-xl px-4 py-2", isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200")}
                        />
                        <button onClick={updateShopName} className={cn("px-4 rounded-xl text-xs", isDark ? "bg-zinc-700" : "bg-zinc-100")}>Save</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase mb-2">App Logo URL</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={appLogo}
                          onChange={e => setAppLogo(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className={cn("flex-1 border rounded-xl px-4 py-2", isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200")}
                        />
                        <button onClick={() => updateSetting("app_logo", appLogo)} className={cn("px-4 rounded-xl text-xs", isDark ? "bg-zinc-700" : "bg-zinc-100")}>Save</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase mb-2">Bill QR Data</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={billQrData}
                          onChange={e => setBillQrData(e.target.value)}
                          placeholder="Website or Payment Link"
                          className={cn("flex-1 border rounded-xl px-4 py-2", isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200")}
                        />
                        <button onClick={() => updateSetting("bill_qr_data", billQrData)} className={cn("px-4 rounded-xl text-xs", isDark ? "bg-zinc-700" : "bg-zinc-100")}>Save</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase mb-2">App Theme</label>
                      <div className="flex gap-2">
                        {Object.keys(themeColors).map(t => (
                          <button
                            key={t}
                            onClick={() => {
                              setAppTheme(t);
                              updateSetting("app_theme", t);
                            }}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-all",
                              appTheme === t ? (isDark ? "border-white" : "border-zinc-900") : "border-transparent",
                              themeColors[t].split(' ')[1]
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase mb-2">Admin Password</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          placeholder="New Admin Password"
                          onChange={e => setPasswords({...passwords, admin: e.target.value})}
                          className={cn("flex-1 border rounded-xl px-4 py-2", isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200")}
                        />
                        <button onClick={() => updatePassword("admin")} className={cn("px-4 rounded-xl text-xs", isDark ? "bg-zinc-700" : "bg-zinc-100")}>Update</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase mb-2">Cashier Password</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          placeholder="New Cashier Password"
                          onChange={e => setPasswords({...passwords, cashier: e.target.value})}
                          className={cn("flex-1 border rounded-xl px-4 py-2", isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200")}
                        />
                        <button onClick={() => updatePassword("cashier")} className={cn("px-4 rounded-xl text-xs", isDark ? "bg-zinc-700" : "bg-zinc-100")}>Update</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bill Preview Modal */}
        <AnimatePresence>
          {showExchangeModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "w-full max-w-md rounded-3xl p-8 space-y-6 border shadow-2xl",
                  isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">Exchange Product</h3>
                  <button onClick={() => { setShowExchangeModal(false); setBillNumberInput(""); setFoundBillSales([]); }} className="text-zinc-500 hover:text-red-500">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-zinc-500 text-sm">Enter the bill number to start an exchange. Only valid for sales within the last 3 days.</p>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Enter Bill Number (e.g. TXN-123456)" 
                    value={billNumberInput}
                    onChange={(e) => setBillNumberInput(e.target.value)}
                    className={cn(
                      "w-full bg-transparent border-b-2 p-3 outline-none transition-all text-xl font-mono",
                      isDark ? "border-zinc-800 focus:border-emerald-500 text-white" : "border-zinc-200 focus:border-emerald-500 text-zinc-900"
                    )}
                    autoFocus
                  />

                  {foundBillSales.length > 0 && (
                    <div className="space-y-3 max-h-60 overflow-auto p-2">
                      <p className="text-xs font-bold text-zinc-500 uppercase">Items in this Bill:</p>
                      {foundBillSales.map((item, i) => (
                        <div key={i} className={cn("flex items-center justify-between p-3 rounded-xl border", isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{item.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-zinc-500">Qty:</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setReturnQuantities(prev => ({...prev, [item.product_code]: Math.max(1, (prev[item.product_code] || 1) - 1)}))}
                                  className="w-5 h-5 rounded bg-zinc-700 text-white flex items-center justify-center text-[10px]"
                                >-</button>
                                <span className="text-xs font-bold w-4 text-center">{returnQuantities[item.product_code] || 0}</span>
                                <button 
                                  onClick={() => setReturnQuantities(prev => ({...prev, [item.product_code]: Math.min(item.qty, (prev[item.product_code] || 0) + 1)}))}
                                  className="w-5 h-5 rounded bg-zinc-700 text-white flex items-center justify-center text-[10px]"
                                >+</button>
                              </div>
                              <span className="text-xs text-zinc-500 ml-2">Price: {(item.total_price / item.qty).toFixed(2)}</span>
                              <span className="text-xs font-bold text-emerald-500 ml-auto">Total: {((item.total_price / item.qty) * (returnQuantities[item.product_code] || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleExchange(billNumberInput, item.product_code, returnQuantities[item.product_code])}
                            className={cn("px-3 py-1 rounded-lg text-xs font-bold text-white", getThemeColor("bg"))}
                          >
                            Exchange
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={() => handleExchange(billNumberInput)}
                    disabled={foundBillSales.length === 0}
                    className={cn(
                      "w-full py-4 rounded-2xl text-white font-bold transition-all", 
                      foundBillSales.length > 0 ? getThemeColor("bg") : "bg-zinc-500 cursor-not-allowed"
                    )}
                  >
                    Exchange All Items
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showReturnModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "w-full max-w-md rounded-3xl p-8 space-y-6 border shadow-2xl",
                  isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">Return Product</h3>
                  <button onClick={() => { setShowReturnModal(false); setBillNumberInput(""); setFoundBillSales([]); }} className="text-zinc-500 hover:text-red-500">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-zinc-500 text-sm">Enter the bill number to return items to stock. Only valid for sales within the last 3 days.</p>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Enter Bill Number (e.g. TXN-123456)" 
                    value={billNumberInput}
                    onChange={(e) => setBillNumberInput(e.target.value)}
                    className={cn(
                      "w-full bg-transparent border-b-2 p-3 outline-none transition-all text-xl font-mono",
                      isDark ? "border-zinc-800 focus:border-emerald-500 text-white" : "border-zinc-200 focus:border-emerald-500 text-zinc-900"
                    )}
                    autoFocus
                  />

                  {foundBillSales.length > 0 && (
                    <div className="space-y-3 max-h-60 overflow-auto p-2">
                      <p className="text-xs font-bold text-zinc-500 uppercase">Items in this Bill:</p>
                      {foundBillSales.map((item, i) => (
                        <div key={i} className={cn("flex items-center justify-between p-3 rounded-xl border", isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{item.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-zinc-500">Qty:</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setReturnQuantities(prev => ({...prev, [item.product_code]: Math.max(1, (prev[item.product_code] || 1) - 1)}))}
                                  className="w-5 h-5 rounded bg-zinc-700 text-white flex items-center justify-center text-[10px]"
                                >-</button>
                                <span className="text-xs font-bold w-4 text-center">{returnQuantities[item.product_code] || 0}</span>
                                <button 
                                  onClick={() => setReturnQuantities(prev => ({...prev, [item.product_code]: Math.min(item.qty, (prev[item.product_code] || 0) + 1)}))}
                                  className="w-5 h-5 rounded bg-zinc-700 text-white flex items-center justify-center text-[10px]"
                                >+</button>
                              </div>
                              <span className="text-xs text-zinc-500 ml-2">Price: {(item.total_price / item.qty).toFixed(2)}</span>
                              <span className="text-xs font-bold text-red-500 ml-auto">Total: {((item.total_price / item.qty) * (returnQuantities[item.product_code] || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleReturn(billNumberInput, item.product_code, returnQuantities[item.product_code])}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600"
                          >
                            Return
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={() => handleReturn(billNumberInput)}
                    disabled={foundBillSales.length === 0}
                    className={cn(
                      "w-full py-4 rounded-2xl text-white font-bold transition-all", 
                      foundBillSales.length > 0 ? "bg-red-500 hover:bg-red-600" : "bg-zinc-500 cursor-not-allowed"
                    )}
                  >
                    Return All Items
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showPreviewModal && previewBillData && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "border w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors",
                  isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}
              >
                <div className={cn("p-6 border-b flex justify-between items-center transition-colors", isDark ? "border-zinc-800" : "border-zinc-100")}>
                  <h3 className="text-xl font-bold">Bill Preview</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleShare('whatsapp')}
                      className="bg-emerald-500/10 text-emerald-500 p-2 rounded-lg hover:bg-emerald-500/20 transition-all"
                      title="Share to WhatsApp"
                    >
                      <Share2 size={20} />
                    </button>
                    <button onClick={() => setShowPreviewModal(false)} className="text-zinc-500 hover:text-red-500 p-2 transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                </div>
                
                <div className={cn("flex-1 overflow-auto p-8 flex justify-center transition-colors", isDark ? "bg-zinc-800" : "bg-zinc-50")}>
                  <div 
                    ref={previewBillRef}
                    className="w-[400px] bg-white p-8 text-black font-mono shadow-xl"
                  >
                    <div className="text-center border-b-2 border-black pb-4 mb-4">
                      <img 
                        src={appLogo || "https://cdn-icons-png.flaticon.com/512/857/857455.png"} 
                        alt="Logo" 
                        className="h-16 mx-auto mb-2 object-contain" 
                        referrerPolicy="no-referrer"
                      />
                      <h2 className="text-2xl font-bold uppercase">{shopName}</h2>
                      <div className="text-sm font-bold mt-1">Bill #: {previewBillData.transaction_id}</div>
                      <div className="text-sm font-bold">Txn #: {previewBillData.transaction_id}</div>
                      <p className="text-sm">{format(new Date(previewBillData.date), "PPP p")}</p>
                    </div>

                    <div className="mb-4">
                      <div className="grid grid-cols-4 font-bold border-b border-black pb-1 mb-2">
                        <span className="col-span-2">Item</span>
                        <span className="text-right">Qty</span>
                        <span className="text-right">Price</span>
                      </div>
                      {previewBillData.items.map((item, i) => (
                        <div key={i} className={cn("grid grid-cols-4 text-sm mb-1", item.isReturn && "text-red-600")}>
                          <span className="col-span-2 truncate">{item.description}</span>
                          <span className="text-right">x{Math.abs(item.cartQty)}</span>
                          <span className="text-right">{Math.abs((item.selling_price || 0) * item.cartQty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-black pt-2 space-y-1">
                      {previewBillData.items.some(i => i.isReturn) && (
                        <>
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Return Amount:</span>
                            <span>{Math.abs(previewBillData.items.filter(i => i.isReturn).reduce((sum, i) => sum + (i.selling_price * i.cartQty), 0)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-emerald-600">
                            <span>New Items Amount:</span>
                            <span>{previewBillData.items.filter(i => !i.isReturn).reduce((sum, i) => sum + (i.selling_price * i.cartQty), 0).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span>Net Subtotal:</span>
                        <span>{(previewBillData.total + previewBillData.discount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Discount:</span>
                        <span>-{(previewBillData.discount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-1">
                        <span>{previewBillData.total < 0 ? "REFUND TOTAL:" : "TOTAL:"}</span>
                        <span>{Math.abs(previewBillData.total || 0).toFixed(2)} Taka</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2">
                        <span>Received:</span>
                        <span>{(previewBillData.receivedAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span>Change:</span>
                        <span>{(previewBillData.changeAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {previewBillData.member && (
                      <div className="mt-6 p-3 bg-zinc-100 rounded border border-zinc-300">
                        <p className="text-xs font-bold uppercase mb-1">Membership Info</p>
                        <p className="text-sm">Name: {previewBillData.member.name}</p>
                        <p className="text-sm">Phone: {previewBillData.member.phone}</p>
                        <div className="mt-2 pt-2 border-t border-zinc-300 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span>Points Earned:</span>
                            <span>+{previewBillData.pointsEarned}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Points Redeemed:</span>
                            <span>-{previewBillData.pointsRedeemed}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-8 text-center text-xs space-y-4">
                      <div className="border-t border-dashed border-black pt-4 text-left">
                        <p className="font-bold mb-1">POLICY:</p>
                        <p>• No Cash Refund</p>
                        <p>• No Return After Purchase</p>
                        <p>• Exchange Allowed Within 72 Hours</p>
                        <p className="ml-2 text-[10px] italic">(Must bring receipt & product in good condition)</p>
                      </div>
                      <div className="pt-2">
                        <p className="font-bold text-sm">Thank you for shopping with us!</p>
                        <p>Visit again soon.</p>
                      </div>
                      {billQrData && (
                        <div className="flex justify-center">
                          <QRCodeSVG value={billQrData} size={80} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={cn("p-6 border-t flex gap-4 transition-colors", isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-100 bg-white")}>
                  <button 
                    onClick={() => setShowPreviewModal(false)}
                    className={cn("flex-1 font-bold py-3 rounded-xl transition-colors", isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500")}
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => {
                      if (previewBillRef.current) {
                        const content = previewBillRef.current.innerHTML;
                        const printWindow = window.open("", "_blank", "width=400,height=600");
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Bill Receipt</title>
                                <style>
                                  body { font-family: monospace; padding: 20px; }
                                  @media print { body { padding: 0; } }
                                </style>
                              </head>
                              <body>${content}</body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.focus();
                          setTimeout(() => {
                            printWindow.print();
                            printWindow.close();
                          }, 250);
                        }
                      }
                    }}
                    className={cn("flex-1 text-white font-bold py-3 rounded-xl", getThemeColor("bg"))}
                  >
                    Print Again
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
