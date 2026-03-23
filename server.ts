import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sports_stock.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    code TEXT PRIMARY KEY,
    description TEXT,
    category TEXT,
    cost_price REAL,
    selling_price REAL,
    qty INTEGER
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    name TEXT,
    points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS points_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_phone TEXT,
    change INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT,
    date TEXT,
    product_code TEXT,
    qty INTEGER,
    total_price REAL,
    discount REAL,
    member_phone TEXT,
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    FOREIGN KEY(product_code) REFERENCES products(code)
  );

  CREATE TABLE IF NOT EXISTS sales_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT,
    type TEXT,
    amount REAL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    role TEXT PRIMARY KEY,
    password TEXT
  );
`);

// Migration: Add columns to sales if they don't exist
try {
  db.exec("ALTER TABLE sales ADD COLUMN points_earned INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE sales ADD COLUMN points_redeemed INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE sales ADD COLUMN transaction_id TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE members ADD COLUMN id INTEGER");
  db.exec("ALTER TABLE members ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
} catch (e) {}

// Seed initial data
const seedSettings = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
seedSettings.run("shop_name", "SportsStock Pro");

const seedUsers = db.prepare("INSERT OR IGNORE INTO users (role, password) VALUES (?, ?)");
seedUsers.run("admin", "admin123");
seedUsers.run("cashier", "cashier123");

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.post("/api/login", (req, res) => {
    const { role, password } = req.body;
    if (role === "dev") {
      if (password === "202050") return res.json({ success: true, role: "dev" });
      return res.status(401).json({ success: false, message: "Invalid dev password" });
    }
    const user = db.prepare("SELECT * FROM users WHERE role = ? AND password = ?").get(role, password);
    if (user) {
      res.json({ success: true, role });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { code, description, category, cost_price, selling_price, qty } = req.body;
    try {
      db.prepare(`
        INSERT INTO products (code, description, category, cost_price, selling_price, qty)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          description=excluded.description,
          category=excluded.category,
          cost_price=excluded.cost_price,
          selling_price=excluded.selling_price,
          qty=products.qty + excluded.qty
      `).run(code, description, category, cost_price, selling_price, qty);
      
      broadcast({ type: "STOCK_UPDATED" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/products/bulk", (req, res) => {
    const products = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    const insert = db.prepare(`
      INSERT INTO products (code, description, category, cost_price, selling_price, qty)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        description=excluded.description,
        category=excluded.category,
        cost_price=excluded.cost_price,
        selling_price=excluded.selling_price,
        qty=products.qty + excluded.qty
    `);

    const transaction = db.transaction((items) => {
      for (const item of items) {
        // Ensure selling price is at least 12% more than cost price if not provided or too low
        const minSellingPrice = item.cost_price * 1.12;
        const finalSellingPrice = Math.max(item.selling_price || 0, minSellingPrice);
        
        insert.run(item.code, item.description, item.category, item.cost_price, finalSellingPrice, item.qty);
      }
    });

    try {
      transaction(products);
      broadcast({ type: "STOCK_UPDATED" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/members/search", (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);
    const members = db.prepare("SELECT * FROM members WHERE phone LIKE ? OR name LIKE ? LIMIT 10")
      .all(`%${query}%`, `%${query}%`);
    res.json(members);
  });

  app.get("/api/members", (req, res) => {
    const members = db.prepare("SELECT * FROM members ORDER BY created_at DESC").all();
    res.json(members);
  });

  app.get("/api/members/:phone", (req, res) => {
    const member = db.prepare("SELECT * FROM members WHERE phone = ?").get(req.params.phone);
    res.json(member || null);
  });

  app.get("/api/members/:phone/history", (req, res) => {
    const history = db.prepare("SELECT * FROM points_history WHERE member_phone = ? ORDER BY created_at DESC")
      .all(req.params.phone);
    res.json(history);
  });

  app.post("/api/members", (req, res) => {
    const { phone, name } = req.body;
    try {
      db.prepare("INSERT INTO members (phone, name, points) VALUES (?, ?, 0)").run(phone, name);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/sales", (req, res) => {
    const { items, member_phone, discount, points_redeemed, payments } = req.body;
    const date = new Date().toISOString().split("T")[0];
    const transaction_id = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const transaction = db.transaction(() => {
      let totalTaka = 0;
      for (const item of items) {
        const product = db.prepare("SELECT * FROM products WHERE code = ?").get(item.code) as any;
        if (!product || product.qty < item.qty) throw new Error(`Insufficient stock for ${item.code}`);

        const itemTotal = item.qty * item.price;
        totalTaka += itemTotal;

        db.prepare("UPDATE products SET qty = qty - ? WHERE code = ?").run(item.qty, item.code);
      }

      const finalAmount = totalTaka - discount;
      const pointsEarned = member_phone ? Math.floor(finalAmount / 100) : 0;

      // Record sales
      for (const item of items) {
        db.prepare("INSERT INTO sales (transaction_id, date, product_code, qty, total_price, discount, member_phone, points_earned, points_redeemed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(transaction_id, date, item.code, item.qty, item.qty * item.price, discount / items.length, member_phone, pointsEarned / items.length, points_redeemed / items.length);
      }

      // Record payments
      if (payments && Array.isArray(payments)) {
        const insertPayment = db.prepare("INSERT INTO sales_payments (transaction_id, type, amount) VALUES (?, ?, ?)");
        for (const p of payments) {
          insertPayment.run(transaction_id, p.type, p.amount);
        }
      }

      if (member_phone) {
        const member = db.prepare("SELECT * FROM members WHERE phone = ?").get(member_phone) as any;
        if (!member) throw new Error("Member not found");

        if (points_redeemed > 0) {
          if (points_redeemed < 2) throw new Error("Minimum redemption is 2 points");
          if (points_redeemed > member.points) throw new Error("Insufficient points");
          if (points_redeemed > totalTaka) throw new Error("Redemption cannot exceed bill total");

          db.prepare("INSERT INTO points_history (member_phone, change, reason) VALUES (?, ?, ?)")
            .run(member_phone, -points_redeemed, "Redeemed for discount");
        }

        if (pointsEarned > 0) {
          db.prepare("INSERT INTO points_history (member_phone, change, reason) VALUES (?, ?, ?)")
            .run(member_phone, pointsEarned, "Earned from purchase");
        }

        db.prepare("UPDATE members SET points = points - ? + ? WHERE phone = ?")
          .run(points_redeemed || 0, pointsEarned, member_phone);
      }
    });

    try {
      transaction();
      broadcast({ type: "STOCK_UPDATED" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/reports/sales", (req, res) => {
    const { start, end } = req.query;
    const sales = db.prepare(`
      SELECT s.*, p.description 
      FROM sales s 
      JOIN products p ON s.product_code = p.code 
      WHERE date BETWEEN ? AND ?
    `).all(start, end);
    res.json(sales);
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const result = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(result);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  app.post("/api/users/password", (req, res) => {
    const { role, password } = req.body;
    db.prepare("UPDATE users SET password = ? WHERE role = ?").run(password, role);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
