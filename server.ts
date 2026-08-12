import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import multer from 'multer';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, Messaging, Message } from 'firebase-admin/messaging';
import { createServer as createViteServer } from 'vite';

// Load environment variables from .env file
dotenv.config();

// Initialize MySQL Direct Connection Pool
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hktt',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const dbPool = mysql.createPool(dbConfig);

// Verify DB Connection
dbPool.getConnection()
  .then((conn) => {
    console.log('[Direct DB] Connected directly to MySQL database successfully.');
    conn.release();
  })
  .catch((err) => {
    console.warn('[Direct DB] Warning: MySQL database connection error:', err.message);
  });

// Initialize Firebase Admin SDK for Node FCM notifications
let messagingAdmin: Messaging | null = null;

function getServiceAccount() {
  // 1. Try reading service-account.json from filesystem
  const saPaths = [
    path.join(process.cwd(), 'service-account.json'),
    path.join(process.cwd(), 'public', 'hktt', 'service-account.json'),
  ];
  for (const saPath of saPaths) {
    if (fs.existsSync(saPath)) {
      try {
        return JSON.parse(fs.readFileSync(saPath, 'utf8'));
      } catch (e) {}
    }
  }

  // 2. Try loading from environment variables (.env)
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : (process.env.FIREBASE_PRIVATE_KEY_BASE64
        ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
        : undefined);

  if (envPrivateKey && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    return {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: envPrivateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

  return null;
}

try {
  const saContent = getServiceAccount();

  if (saContent) {
    if (!getApps().length) {
      initializeApp({
        credential: cert(saContent),
      });
    }
    messagingAdmin = getMessaging();
    console.log('[Node Notifications] Firebase Admin initialized with service account key.');
  } else {
    if (!getApps().length) {
      initializeApp();
    }
    messagingAdmin = getMessaging();
    console.log('[Node Notifications] Firebase Admin initialized with default credentials.');
  }
} catch (err) {
  console.warn('[Node Notifications] Firebase Admin initialization warning:', err);
}

// Token storage in persistent JSON file
interface UserFcmToken {
  id: string;
  email: string;
  token: string;
  updatedAt: string;
}

const TOKENS_FILE = path.join(process.cwd(), 'user_fcm_tokens.json');

function loadFcmTokens(): UserFcmToken[] {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const content = fs.readFileSync(TOKENS_FILE, 'utf8');
      return JSON.parse(content) || [];
    }
  } catch (err) {
    console.error('[Node Notifications] Error reading tokens file:', err);
  }
  return [];
}

function saveFcmTokens(tokens: UserFcmToken[]) {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (err) {
    console.error('[Node Notifications] Error writing tokens file:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS Middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Serve Service Worker at root with proper headers
  app.get('/firebase-messaging-sw.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Content-Type', 'application/javascript');
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    if (fs.existsSync(swPath)) {
      res.sendFile(swPath);
    } else {
      res.status(404).send('// Service Worker not found');
    }
  });

  // --- Node Notification API Routes ---

  // 1. Register or update FCM token
  app.post('/api/notifications/register-token', (req, res) => {
    const { email, token } = req.body || {};

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu email hoặc FCM token',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanToken = String(token).trim();
    const now = new Date().toISOString();

    let tokens = loadFcmTokens();
    const existingIndex = tokens.findIndex(
      t => t.email === cleanEmail && t.token === cleanToken
    );

    if (existingIndex >= 0) {
      tokens[existingIndex].updatedAt = now;
    } else {
      tokens.push({
        id: 'fcm_' + Math.random().toString(36).substring(2, 10),
        email: cleanEmail,
        token: cleanToken,
        updatedAt: now,
      });
    }

    saveFcmTokens(tokens);

    console.log(`[Node Notifications] Token registered for ${cleanEmail}`);
    return res.json({
      success: true,
      message: 'Đã lưu FCM token thành công (Node)',
      email: cleanEmail,
    });
  });

  // 2. Get registered tokens
  app.get('/api/notifications/tokens', (req, res) => {
    const tokens = loadFcmTokens();
    return res.json({
      success: true,
      count: tokens.length,
      tokens,
    });
  });

  // 3. Send Push Notification via Node FCM Admin
  app.post('/api/notifications/send', async (req, res) => {
    try {
      const input = req.body || {};
      const title = input.title || 'HKTT CRM';
      const body = input.body || input.message || '';
      let recipientEmail = input.recipientEmail || input.email || input.recipient_email || '';
      let recipientEmails: string[] = input.recipientEmails || [];

      if (typeof recipientEmails === 'string') {
        recipientEmails = (recipientEmails as string).split(',').map((s: string) => s.trim());
      }

      if (recipientEmail && !recipientEmails.includes(recipientEmail)) {
        recipientEmails.push(recipientEmail);
      }

      recipientEmails = recipientEmails
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

      const isSendToAll =
        recipientEmails.length === 0 || recipientEmails.includes('all');

      if (!title || !body) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu tiêu đề (title) hoặc nội dung (body) thông báo.',
        });
      }

      let allTokens = loadFcmTokens();
      let targetTokens = isSendToAll
        ? allTokens
        : allTokens.filter(t => recipientEmails.includes(t.email));

      if (targetTokens.length === 0) {
        return res.json({
          success: true,
          sentCount: 0,
          failedCount: 0,
          tokensCount: 0,
          message: 'Không tìm thấy FCM token nào cho email đăng ký.',
        });
      }

      if (!messagingAdmin) {
        return res.status(500).json({
          success: false,
          message: 'Chưa khởi tạo được Firebase Admin Messaging trên Node server.',
        });
      }

      const rawData = input.data || {};
      const formattedData: Record<string, string> = {
        title: String(title),
        body: String(body),
      };

      if (typeof rawData === 'object' && rawData !== null) {
        for (const [k, v] of Object.entries(rawData)) {
          formattedData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        }
      }

      let sentCount = 0;
      let failedCount = 0;
      const details: Array<{ email: string; success: boolean; error?: string }> = [];
      const staleTokenIds: string[] = [];

      for (const item of targetTokens) {
        let isSuccess = false;
        let errMsg = '';

        try {
          const message: Message = {
            token: item.token,
            notification: {
              title: String(title),
              body: String(body),
            },
            data: formattedData,
            webpush: {
              headers: {
                Urgency: 'high',
                TTL: '86400',
              },
              notification: {
                title: String(title),
                body: String(body),
                icon: 'https://thienlong.pro.vn/khachhang/icon.jpg',
                badge: 'https://thienlong.pro.vn/khachhang/icon.jpg',
                requireInteraction: true,
              },
              fcmOptions: {
                link: formattedData.url || 'https://thienlong.pro.vn',
              },
            },
          };

          await messagingAdmin.send(message);
          isSuccess = true;
          sentCount++;
        } catch (err: any) {
          failedCount++;
          errMsg = err?.message || String(err);

          if (
            errMsg.includes('registration-token-not-registered') ||
            errMsg.includes('invalid-registration-token') ||
            errMsg.includes('NOT_FOUND') ||
            errMsg.includes('UNREGISTERED')
          ) {
            staleTokenIds.push(item.id);
          }
        }

        details.push({
          email: item.email,
          success: isSuccess,
          error: errMsg || undefined,
        });
      }

      // Prune stale tokens if any
      if (staleTokenIds.length > 0) {
        const remainingTokens = allTokens.filter(t => !staleTokenIds.includes(t.id));
        saveFcmTokens(remainingTokens);
      }

      return res.json({
        success: sentCount > 0,
        sentCount,
        failedCount,
        tokensCount: targetTokens.length,
        details,
      });
    } catch (error: any) {
      console.error('[Node Notifications] Error sending push notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server Node khi gửi thông báo: ' + (error?.message || String(error)),
      });
    }
  });

  // --- Direct MySQL Database Query Endpoint ---
  app.post(['/api/query', '/hktt/query.php'], async (req, res) => {
    const sql = req.body?.sql || req.query?.sql;
    if (!sql) {
      return res.status(400).json({ error: 'Missing SQL query statement' });
    }

    try {
      const [results] = await dbPool.query(sql);
      if (Array.isArray(results)) {
        return res.json(results);
      } else {
        const okPacket = results as mysql.ResultSetHeader;
        return res.json({
          success: true,
          affected_rows: okPacket.affectedRows,
          insertId: okPacket.insertId,
        });
      }
    } catch (err: any) {
      console.error('[Direct DB] Query execution error:', err.message, 'SQL:', sql);
      return res.status(500).json({ error: err.message || 'Database query error' });
    }
  });

  // --- Direct Avatar Upload Endpoint ---
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const randomName = crypto.randomBytes(16).toString('hex');
      cb(null, `${randomName}_100${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.post(['/api/upload-avatar', '/hktt/upload_avatar.php'], upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file ảnh' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      data: {
        avatar_1080: fileUrl,
        avatar_100: fileUrl,
      },
    });
  });

  app.use('/uploads', express.static(uploadsDir));
  app.use('/hktt/uploads', express.static(uploadsDir));

  // Vite development middleware or static production serving
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production' || (fs.existsSync(path.join(distPath, 'index.html')) && process.env.NODE_ENV !== 'development');

  if (isProduction) {
    console.log('[Server] Serving static production build from:', distPath);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Server] Starting Vite development middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
