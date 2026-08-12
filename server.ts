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

  // 3. Fallback to embedded base64 credentials if .env and file are missing
  return {
    type: "service_account",
    project_id: "tets-14775",
    client_email: "firebase-adminsdk-o2eam@tets-14775.iam.gserviceaccount.com",
    private_key: Buffer.from(
      "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2QUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktZd2dnU2lBZ0VBQW9JQkFRRGFteEI0VDZJd0RMK1UKZnlGNVZsbExPd0hXQnhQVG1YdjkrNDFGTmFyUUxhWkNWaVdRN3FIK09xcjhURHhhOG4xTld4TDh0R0FsSkl5cAo3RHhjZFBEZXgzSW4zVGR3NFRvQjZmYW0wZU9qT3ozWTdlVHZlZGcxU0dwRFlDdWUyTlhQdVNGc042YU11bFNkCjI2eEtlU21uY2hUZDR6em5OTUdKd0dHcElnMHRVUEJPNnR2ODg5TVNsK3l0SldBL2o4V01mR1AzQS8yNnRqSgpsOFA5VW0vT3gwT1IydnppS1lmSUsxa3ptNmY3S0trOEp6dG15S2F0YndjS1RBTnF4ODMwWVJQWWN1cGlYSUNDCkIzNGtLMUM2ZTZFWUlhb1JFTi9iSVk4VlBCL3BaQzdtS1JGRHNUMTdkK1B0OWVCTlMyZTJaV01RazRPK29jNVIKb3BaOE9vQm5BZ01CQUFFQ2dnRUFCSjRoMnJMaUVVYkZRenZMQEpjU01Lc2g3RzM0VDBkMEZRWG1IMTYxTmt1dQo5a3NJQngxSk05ckJNL0tMSElGZWQ2QVUxMjJqVVo0U0lXVGtNYWZxbHdpSFRvNVZGRi9udG1vSmpYbjB6ZStJClV2T3BHdG1CUjhlb0RSMUxndHVFTDEvaDYxdGl5S0QyRGVLb3JHbTV3K21DZFgxdjkrSllOSW9xWmVrL29ENHAKMmUwRTRFUUJMa0FBQXMydEgyM2xOZDZ0Z0lMUVRsckpzc2VxUnM5RURJdWh2cktKQjBNVlc0UEVHQlhNYkZTKwpsd3o3M2FYWjEvdzRIVUlXZm83ZDVtTC8rbVFpVjY4VEFEbkduU2JhN2ZmTUVSSXpiK2pvOTZCa3dhSzdhZQpaZGtFb1VuVzVOSlRUUzJzRWRGWjgyY0hTUHcxU0s5aXFyaHZXMFFTaVFLQmdRRHM0ZU5DTjVrQ25NZ2JZNE0KckFEVEJpbHpoa05JU2dDR2IzUnl6MFQ0WXJQdEF0OFdNdDJDTFViNzVZQTlyVjZtSjZNSlN1Y21Ya1BFWU8wCnJNWEpkSE9DbHBlQkMwYW5aWEpWdGNvVjdlb3F5SG8xcEhSVVNXc1Y0dUR5WHVQYWljVWV1VE1jTjZaZFZuVU4KS1liazc4bWs2VGhZMU9TL1BNdVlYUHd0L3dLQmdRRHNQNUpOU1B0ODB4TjNDc1oyYUtpMVI1eFJiN1V4TEx0ZHV4TlBsb3RUY2xMZEUrZUhjSFI1Zm55dVRZYWxsdnUvTDVjaTFraE1sREpORlllcDA2cE9rdDk1TGxCOFRZTDEKM3VpRytnTDMxNmFZZ29mSW9nMDNVRmZiTUJuZDRNY3hXVENWMDF4bW83R0ZUU0dXc0daK2dsYQo1WGFMU09mS2dqSGY5bmRHaFdkZTJLcldjN1pmWW5KQm80akpHUTdRUXhxQUlTdmRqOXc1dHNiSEFvR0FGRndtCkxMcWlZZG5WZ3NIcjR5MWZXbitmc1l4eCtzY2VTZDJNcFcyekNvK0dlOXROSzdzV3N3YjBxbTd0ZUdETUl6WgphSmpuUjdZOTM0Ykxla1RMaEh4aEZ3SmM2ejZiRllaZkFodXJ0SjZQYUdla2xYaVlLci9ZZk9yeHhOR2pvM1ZWRnBibVRhKy83cGRYQlZTZHUxd2pqY3pQOFpvUXp2eWJkNTZZRUNnWUJOVUZxYkhSYlVQTnJTZXNjdmJzRApaM0M4WTBSZDA3YXpOcksreHdCMGtSVnoMm5lL2wzZ2ZnNHhZNVV6WHdOTHp0MjcvcFpHRjNsNEhXRkFMbVpICkYwQkpUelA4V3hRQHlReE9zSU8vcnRJMWlrQWV6cytpMDlrZkkyMTN5SmQxWTFFM1lRL00rZVR3bkFiUGZBRDkKNm1OMFdULzRsK0xZRzJJSDlFYzJYQT09",
      "base64"
    ).toString("utf-8")
  };
}

// Initialize Firebase Admin SDK for Node FCM notifications
let globalMessagingInstance: Messaging | null = null;

function getFirebaseAdminMessaging(): Messaging | null {
  if (globalMessagingInstance) return globalMessagingInstance;

  try {
    const saContent = getServiceAccount();
    const projectId = saContent?.project_id || process.env.FIREBASE_PROJECT_ID || 'tets-14775';
    const clientEmail = saContent?.client_email || saContent?.clientEmail || 'firebase-adminsdk-o2eam@tets-14775.iam.gserviceaccount.com';
    const rawKey = String(saContent?.private_key || saContent?.privateKey || '');
    const privateKey = rawKey.replace(/\\n/g, '\n');

    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.GCP_PROJECT = projectId;

    const certObj = {
      projectId,
      project_id: projectId,
      clientEmail,
      client_email: clientEmail,
      privateKey,
      private_key: privateKey,
    };

    // Ensure service-account.json is physically available on disk for Google Cloud Auth Library
    const saPath = path.join(process.cwd(), 'service-account.json');
    if (!fs.existsSync(saPath)) {
      try {
        fs.writeFileSync(saPath, JSON.stringify({
          type: "service_account",
          project_id: projectId,
          private_key: privateKey,
          client_email: clientEmail,
        }, null, 2), 'utf8');
      } catch (e) {}
    }
    if (fs.existsSync(saPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;
    }

    let app;
    const adminApps = getApps();
    const foundApp = adminApps.find(a => a.name === 'hktt_admin');
    if (foundApp) {
      app = foundApp;
    } else {
      app = initializeApp({
        credential: cert(certObj),
        projectId: projectId,
      }, 'hktt_admin');
    }

    globalMessagingInstance = getMessaging(app);
    console.log(`[Node Notifications] Dedicated Firebase Admin initialized for project: ${projectId}`);
    return globalMessagingInstance;
  } catch (err: any) {
    console.error('[Node Notifications] Firebase Admin init error:', err?.message || err);
    return null;
  }
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

      const messagingAdmin = getFirebaseAdminMessaging();
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
                icon: 'https://thienlong.pro.vn/icon.jpg',
                badge: 'https://thienlong.pro.vn/icon.jpg',
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
  const publicPath = path.join(process.cwd(), 'public');
  const isProduction = process.env.NODE_ENV === 'production' || (fs.existsSync(path.join(distPath, 'index.html')) && process.env.NODE_ENV !== 'development');

  if (isProduction) {
    console.log('[Server] Serving static production build from:', distPath);
    app.use(express.static(distPath));
    app.use(express.static(publicPath));
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
