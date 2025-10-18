import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SIMPLE_USER = {
  email: 'rafael@uds.com.br',
  password: 'Udsudsuds@00',
  name: 'Rafael Sapata',
};

const JWT_SECRET = process.env.JWT_SECRET || 'simple-secret-key';

export function simpleLogin(email: string, password: string) {
  if (email === SIMPLE_USER.email && password === SIMPLE_USER.password) {
    const token = jwt.sign(
      { email: SIMPLE_USER.email, name: SIMPLE_USER.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return { success: true, token, user: { email: SIMPLE_USER.email, name: SIMPLE_USER.name } };
  }
  return { success: false, error: 'Credenciais inválidas' };
}

export function verifySimpleToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; name: string };
    return { valid: true, user: decoded };
  } catch {
    return { valid: false, user: null };
  }
}

export function simpleAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const result = verifySimpleToken(token);
  if (!result.valid) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  (req as any).user = result.user;
  next();
}

