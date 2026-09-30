import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const sessions = new Map<string, { userId: string; expires: number }>();
const ttl = 8 * 60 * 60 * 1000;
const SESSION_FILE = path.join(process.cwd(), '.sessions.json');

function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, 'utf8');
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && (v as any).expires > now) {
          sessions.set(k, v as { userId: string; expires: number });
        }
      }
    }
  } catch {}
}
loadSessions();

function saveSessions() {
  try {
    const obj: Record<string, { userId: string; expires: number }> = {};
    const now = Date.now();
    for (const [k, v] of sessions.entries()) {
      if (v.expires > now) obj[k] = v;
    }
    fs.writeFileSync(SESSION_FILE, JSON.stringify(obj), 'utf8');
  } catch {}
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, stored?: string) {
  if (!stored || !password) return false;
  if (!stored.startsWith('scrypt:')) {
    return password === stored;
  }
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  try {
    return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}
function token(req: Request) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const customHeader = req.headers['x-apex-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  return req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('apex_session='))?.slice(13);
}
export function sessionUserId(req: Request) {
  const key = token(req);
  if (!key) return undefined;
  let session = sessions.get(key);
  if (!session) {
    loadSessions();
    session = sessions.get(key);
  }
  if (!session || session.expires < Date.now()) {
    if (key) {
      sessions.delete(key);
      saveSessions();
    }
    return undefined;
  }
  return session.userId;
}
export function startSession(req: Request, res: Response, userId: string): string {
  const old = token(req);
  if (old) sessions.delete(old);
  for (const [k, session] of sessions) if (session.expires < Date.now()) sessions.delete(k);
  const key = randomBytes(32).toString('hex');
  sessions.set(key, { userId, expires: Date.now() + ttl });
  saveSessions();
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true';
  res.cookie('apex_session', key, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: ttl,
    path: '/'
  });
  return key;
}
export function endSession(req: Request, res: Response) {
  const key = token(req);
  if (key) {
    sessions.delete(key);
    saveSessions();
  }
  res.clearCookie('apex_session', { path: '/' });
}
