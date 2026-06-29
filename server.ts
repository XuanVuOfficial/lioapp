import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin with maximum safety
function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountVar) {
    try {
      const serviceAccount = JSON.parse(serviceAccountVar);
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin initialized using service account JSON.');
      return;
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
    }
  }

  // Fallback to ADC or local config project ID
  try {
    initializeApp();
    console.log('Firebase Admin initialized with default credentials (ADC).');
  } catch (e) {
    console.warn('Firebase Admin failed to initialize with default credentials, trying local project config:', e);
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        initializeApp({
          projectId: config.projectId,
        });
        console.log('Firebase Admin initialized with projectId from config:', config.projectId);
      } else {
        console.error('firebase-applet-config.json not found. Notifications will not be sent.');
      }
    } catch (err) {
      console.error('All Firebase Admin initialization attempts failed:', err);
    }
  }
}

// Local duplicate of escapeSQL for server context to keep server.ts independent from vite build imports
function escapeSQL(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

// Re-usable remote DB query on app.xuanvu.click
async function queryRemoteDB(sql: string): Promise<any> {
  const formData = new URLSearchParams();
  formData.append('sql', sql);
  
  try {
    const response = await fetch('https://app.xuanvu.click/hktt/query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`Remote query failed with HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (data && typeof data === 'object' && data.error) {
      throw new Error(data.error);
    }
    return data;
  } catch (err) {
    console.error('Error executing queryRemoteDB:', err);
    throw err;
  }
}

async function startServer() {
  initFirebaseAdmin();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure user_fcm_tokens exists in the remote database on startup
  try {
    console.log('Ensuring user_fcm_tokens table exists on database...');
    await queryRemoteDB(`
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token TEXT NOT NULL,
        updatedAt VARCHAR(50) NOT NULL
      )
    `);
    console.log('Database verification successful.');
  } catch (err) {
    console.error('Failed to verify user_fcm_tokens table in remote database:', err);
  }

  // 1. API: Register an FCM token for a user
  app.post('/api/register-token', async (req, res) => {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: 'Missing email or token' });
    }

    try {
      // Check if token already registered for this user
      const existing = await queryRemoteDB(
        `SELECT id FROM user_fcm_tokens WHERE email = ${escapeSQL(email)} AND token = ${escapeSQL(token)} LIMIT 1`
      );

      const now = new Date().toISOString();
      if (existing && existing.length > 0) {
        // Just update updatedAt
        await queryRemoteDB(
          `UPDATE user_fcm_tokens SET updatedAt = ${escapeSQL(now)} WHERE email = ${escapeSQL(email)} AND token = ${escapeSQL(token)} LIMIT 1`
        );
      } else {
        // Insert a new token mapping
        const tokenId = 'fcm_' + Math.random().toString(36).substring(2, 15);
        await queryRemoteDB(
          `INSERT INTO user_fcm_tokens (id, email, token, updatedAt) VALUES (${escapeSQL(tokenId)}, ${escapeSQL(email)}, ${escapeSQL(token)}, ${escapeSQL(now)})`
        );
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error registering FCM token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. API: Trigger a push notification to a user
  app.post('/api/notify', async (req, res) => {
    const { recipientEmail, title, body, data } = req.body;
    if (!recipientEmail || !title || !body) {
      return res.status(400).json({ error: 'Missing recipientEmail, title, or body' });
    }

    try {
      // Find all registration tokens for this recipient
      const records = await queryRemoteDB(
        `SELECT token FROM user_fcm_tokens WHERE email = ${escapeSQL(recipientEmail)}`
      );

      if (!records || records.length === 0) {
        console.log(`No registered FCM tokens found for user: ${recipientEmail}`);
        return res.json({ success: true, sentCount: 0, reason: 'No registered tokens found' });
      }

      let successCount = 0;
      let failureCount = 0;

      for (const record of records) {
        const { token } = record;
        const message = {
          notification: { title, body },
          data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
          token: token,
        };

        try {
          await getMessaging().send(message);
          successCount++;
        } catch (sendError: any) {
          console.error(`Failed to send message to token for ${recipientEmail}:`, sendError);
          failureCount++;

          // Prune obsolete or invalid tokens automatically
          const isObsoleteToken = 
            sendError.code === 'messaging/registration-token-not-registered' ||
            sendError.code === 'messaging/invalid-registration-token' ||
            sendError.message?.includes('not-registered') ||
            sendError.message?.includes('invalid-registration-token');

          if (isObsoleteToken) {
            try {
              console.log(`Pruning obsolete token for ${recipientEmail}...`);
              await queryRemoteDB(
                `DELETE FROM user_fcm_tokens WHERE token = ${escapeSQL(token)} LIMIT 1`
              );
            } catch (pruneErr) {
              console.error('Error pruning obsolete token:', pruneErr);
            }
          }
        }
      }

      res.json({ success: true, sentCount: successCount, failedCount: failureCount });
    } catch (error: any) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
