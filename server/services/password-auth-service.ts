import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { 
  users, 
  userCredentials, 
  authTokens, 
  pendingInvites,
  type User,
  type UserCredentials,
  type AuthToken,
  type PendingInvite,
  type CreateInvitation,
} from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { usageService } from './usage-service';

const SALT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const INVITATION_EXPIRY_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export class PasswordAuthService {
  
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }
  
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  generateToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }
  
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user || null;
  }
  
  async getUserCredentials(userId: string): Promise<UserCredentials | null> {
    const [creds] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId))
      .limit(1);
    return creds || null;
  }
  
  async createUserWithPendingAuth(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'student' | 'teacher';
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        role: data.role,
        authProvider: 'pending',
      })
      .returning();
    return user;
  }
  
  async setUserPassword(userId: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    
    const existingCreds = await this.getUserCredentials(userId);
    
    if (existingCreds) {
      await db
        .update(userCredentials)
        .set({
          passwordHash,
          passwordVersion: existingCreds.passwordVersion + 1,
          requiresReset: false,
          lastPasswordChange: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.userId, userId));
    } else {
      await db.insert(userCredentials).values({
        userId,
        passwordHash,
      });
    }
    
    await db
      .update(users)
      .set({ authProvider: 'password', updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  
  async validateLogin(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    if (user.authProvider !== 'password') {
      if (user.authProvider === 'replit') {
        return { success: false, error: 'This account uses Google Sign-In. Please use the "Continue with Google" button.' };
      }
      if (user.authProvider === 'pending') {
        return { success: false, error: 'Please complete your registration using the invitation link sent to your email.' };
      }
    }
    
    const creds = await this.getUserCredentials(user.id);
    if (!creds) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    if (creds.lockedUntil && creds.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((creds.lockedUntil.getTime() - Date.now()) / 60000);
      return { success: false, error: `Account locked. Try again in ${minutesLeft} minutes.` };
    }
    
    const isValid = await this.verifyPassword(password, creds.passwordHash);
    
    if (!isValid) {
      const newAttempts = creds.failedLoginAttempts + 1;
      const updates: Partial<UserCredentials> = {
        failedLoginAttempts: newAttempts,
        updatedAt: new Date(),
      };
      
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        updates.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      
      await db
        .update(userCredentials)
        .set(updates)
        .where(eq(userCredentials.id, creds.id));
      
      return { success: false, error: 'Invalid email or password' };
    }
    
    if (creds.failedLoginAttempts > 0) {
      await db
        .update(userCredentials)
        .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(userCredentials.id, creds.id));
    }
    
    return { success: true, user };
  }
  
  async createPasswordResetToken(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return { success: true };
    }
    
    if (user.authProvider !== 'password') {
      return { success: true };
    }
    
    await db
      .delete(authTokens)
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.tokenType, 'password_reset'),
          isNull(authTokens.consumedAt)
        )
      );
    
    const { token, hash } = this.generateToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);
    
    await db.insert(authTokens).values({
      userId: user.id,
      tokenHash: hash,
      tokenType: 'password_reset',
      expiresAt,
    });
    
    return { success: true, token };
  }
  
  async validateToken(token: string, type: 'password_reset' | 'invitation'): Promise<{ valid: boolean; userId?: string; error?: string }> {
    const tokenHash = this.hashToken(token);
    
    const [authToken] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.tokenType, type),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    
    if (!authToken) {
      return { valid: false, error: 'Invalid or expired token' };
    }
    
    return { valid: true, userId: authToken.userId };
  }
  
  async consumeToken(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    
    const result = await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          isNull(authTokens.consumedAt)
        )
      )
      .returning();
    
    return result.length > 0;
  }
  
  async invalidateAllUserTokens(userId: string, tokenType: 'password_reset' | 'invitation'): Promise<void> {
    await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.tokenType, tokenType),
          isNull(authTokens.consumedAt)
        )
      );
  }
  
  async createInvitation(
    invitation: CreateInvitation,
    invitedBy: string
  ): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    const existingUser = await this.getUserByEmail(invitation.email);
    if (existingUser && existingUser.authProvider !== 'pending') {
      return { success: false, error: 'A user with this email already exists' };
    }
    
    let user: User;
    if (existingUser) {
      user = existingUser;
      await db
        .update(users)
        .set({
          firstName: invitation.firstName || existingUser.firstName,
          lastName: invitation.lastName || existingUser.lastName,
          role: invitation.role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    } else {
      user = await this.createUserWithPendingAuth({
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: invitation.role,
      });
    }
    
    await db
      .delete(authTokens)
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.tokenType, 'invitation'),
          isNull(authTokens.consumedAt)
        )
      );
    
    const { token, hash } = this.generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    const [authToken] = await db.insert(authTokens).values({
      userId: user.id,
      tokenHash: hash,
      tokenType: 'invitation',
      expiresAt,
      createdBy: invitedBy,
      metadata: { classId: invitation.classId, initialCreditsSeconds: invitation.initialCreditsSeconds },
    }).returning();
    
    await db.insert(pendingInvites).values({
      email: invitation.email.toLowerCase(),
      role: invitation.role,
      invitedBy,
      classId: invitation.classId || null,
      tokenId: authToken.id,
      firstName: invitation.firstName || null,
      lastName: invitation.lastName || null,
      initialCreditsSeconds: invitation.initialCreditsSeconds || 0,
      expiresAt,
    });
    
    return { success: true, token, user };
  }
  
  async completeRegistration(
    token: string,
    password: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const validation = await this.validateToken(token, 'invitation');
    if (!validation.valid || !validation.userId) {
      return { success: false, error: validation.error || 'Invalid token' };
    }
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, validation.userId))
      .limit(1);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    await this.setUserPassword(user.id, password);
    
    const tokenHash = this.hashToken(token);
    const [authToken] = await db
      .select()
      .from(authTokens)
      .where(eq(authTokens.tokenHash, tokenHash))
      .limit(1);
    
    if (authToken) {
      const metadata = authToken.metadata as { classId?: string; initialCreditsSeconds?: number } | null;
      
      if (metadata?.initialCreditsSeconds && metadata.initialCreditsSeconds > 0) {
        await usageService.addCredits(
          user.id,
          metadata.initialCreditsSeconds,
          'bonus',
          `Initial credits from invitation`
        );
      }
      
      await db
        .update(pendingInvites)
        .set({
          acceptedAt: new Date(),
          acceptedUserId: user.id,
        })
        .where(eq(pendingInvites.tokenId, authToken.id));
    }
    
    await this.invalidateAllUserTokens(user.id, 'invitation');
    
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    
    return { success: true, user: updatedUser };
  }
  
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const validation = await this.validateToken(token, 'password_reset');
    if (!validation.valid || !validation.userId) {
      return { success: false, error: validation.error || 'Invalid token' };
    }
    
    await this.setUserPassword(validation.userId, newPassword);
    
    await this.invalidateAllUserTokens(validation.userId, 'password_reset');
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, validation.userId))
      .limit(1);
    
    return { success: true, user };
  }
  
  async getPendingInvites(invitedBy?: string): Promise<PendingInvite[]> {
    if (invitedBy) {
      return db
        .select()
        .from(pendingInvites)
        .where(
          and(
            eq(pendingInvites.invitedBy, invitedBy),
            isNull(pendingInvites.acceptedAt)
          )
        )
        .orderBy(pendingInvites.createdAt);
    }
    
    return db
      .select()
      .from(pendingInvites)
      .where(isNull(pendingInvites.acceptedAt))
      .orderBy(pendingInvites.createdAt);
  }
  
  async getInviteByToken(token: string): Promise<PendingInvite | null> {
    const tokenHash = this.hashToken(token);
    
    const [authToken] = await db
      .select()
      .from(authTokens)
      .where(eq(authTokens.tokenHash, tokenHash))
      .limit(1);
    
    if (!authToken) return null;
    
    const [invite] = await db
      .select()
      .from(pendingInvites)
      .where(eq(pendingInvites.tokenId, authToken.id))
      .limit(1);
    
    return invite || null;
  }
}

export const passwordAuthService = new PasswordAuthService();
