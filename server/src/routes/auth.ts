import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import db from '../db';
import { z } from 'zod';

// JWT interface extension
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; username: string };
    user: { id: string; username: string };
  }
}

// Request validation schemas
const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * Utility Hook for protecting routes
 * Example Usage: server.register(someRoute, { preValidation: [authenticate] })
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export default async function authRoutes(server: FastifyInstance) {
  server.post('/register', async (request, reply) => {
    try {
      const { username, email, password } = registerSchema.parse(request.body);

      // Check if user exists
      const existingUser = await db.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });

      if (existingUser) {
        return reply.status(400).send({ error: 'Username or email already in use' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await db.user.create({
        data: {
          username,
          email,
          passwordHash,
        },
      });

      // Generate JWT
      const token = server.jwt.sign({ id: user.id, username: user.username });

      return reply.send({
        token,
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input data', details: err.issues });
      }
      server.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  server.post('/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      // Find user
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = server.jwt.sign({ id: user.id, username: user.username });

      return reply.send({
        token,
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input data', details: err.issues });
      }
      server.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  server.get('/me', { preValidation: [authenticate] }, async (request, reply) => {
    const user = await db.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(user);
  });
}
