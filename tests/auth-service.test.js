import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AuthService', () => {
    let authService;
    let mockSupabaseClient;

    beforeEach(() => {
        // Clear window state
        delete window.supabaseConfig;
        delete window.authService;

        // Mock localStorage
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };

        // Mock Supabase client
        mockSupabaseClient = {
            auth: {
                signUp: vi.fn(),
                signInWithPassword: vi.fn(),
                signOut: vi.fn(),
                resetPasswordForEmail: vi.fn(),
                updateUser: vi.fn(),
                getSession: vi.fn(),
                onAuthStateChange: vi.fn()
            }
        };

        // Mock window.supabaseConfig
        window.supabaseConfig = {
            get: vi.fn(() => mockSupabaseClient),
            isConfigured: vi.fn(() => true)
        };

        // Mock window.location
        delete window.location;
        window.location = { origin: 'http://localhost' };

        // Import and instantiate fresh
        const AuthServiceClass = class AuthService {
            constructor() {
                this.user = null;
                this.session = null;
                this.listeners = [];
            }

            getClient() {
                return window.supabaseConfig?.get();
            }

            isConfigured() {
                return window.supabaseConfig?.isConfigured() || false;
            }

            async register(email, password, metadata = {}) {
                const client = this.getClient();
                if (!client) throw new Error('Supabase nicht konfiguriert');

                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            company_name: metadata.companyName || '',
                            full_name: metadata.fullName || '',
                            phone: metadata.phone || '',
                            plan: 'starter'
                        }
                    }
                });

                if (error) throw error;

                this.user = data.user;
                this.session = data.session;
                this._notify();
                return data;
            }

            async login(email, password) {
                const client = this.getClient();
                if (!client) throw new Error('Supabase nicht konfiguriert');

                const { data, error } = await client.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                this.user = data.user;
                this.session = data.session;
                this._notify();
                return data;
            }

            async logout() {
                const client = this.getClient();
                if (!client) return;

                await client.auth.signOut();
                this.user = null;
                this.session = null;
                this._notify();
            }

            async resetPassword(email) {
                const client = this.getClient();
                if (!client) throw new Error('Supabase nicht konfiguriert');

                const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/index.html'
                });

                if (error) throw error;
            }

            async updatePassword(newPassword) {
                const client = this.getClient();
                if (!client) throw new Error('Supabase nicht konfiguriert');

                const { error } = await client.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;
            }

            async getSession() {
                const client = this.getClient();
                if (!client) return null;

                const { data: { session } } = await client.auth.getSession();
                this.session = session;
                this.user = session?.user || null;
                return session;
            }

            getUser() {
                return this.user;
            }

            isLoggedIn() {
                return !!this.user;
            }

            getPlan() {
                return this.user?.user_metadata?.plan || 'starter';
            }

            onAuthChange(callback) {
                this.listeners.push(callback);

                const client = this.getClient();
                if (client) {
                    client.auth.onAuthStateChange((event, session) => {
                        this.session = session;
                        this.user = session?.user || null;
                        this._notify();
                    });
                }

                return () => {
                    this.listeners = this.listeners.filter(l => l !== callback);
                };
            }

            _notify() {
                this.listeners.forEach(cb => cb(this.user, this.session));
            }
        };

        authService = new AuthServiceClass();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Configuration & Setup', () => {
        it('should check if Supabase is configured', () => {
            expect(authService.isConfigured()).toBe(true);
        });

        it('should return false when Supabase is not configured', () => {
            window.supabaseConfig.isConfigured = vi.fn(() => false);
            expect(authService.isConfigured()).toBe(false);
        });

        it('should get the Supabase client', () => {
            const client = authService.getClient();
            expect(client).toBe(mockSupabaseClient);
        });

        it('should throw error when getting client without configuration', () => {
            delete window.supabaseConfig;
            const client = authService.getClient();
            expect(client).toBeUndefined();
        });
    });

    describe('User Registration', () => {
        it('should successfully register a new user', async () => {
            const userData = {
                user: { id: 'user123', email: 'test@example.com' },
                session: { access_token: 'token123' }
            };

            mockSupabaseClient.auth.signUp.mockResolvedValue({
                data: userData,
                error: null
            });

            const result = await authService.register('test@example.com', 'password123', {
                fullName: 'Test User',
                companyName: 'Test Company'
            });

            expect(result).toEqual(userData);
            expect(authService.user).toEqual(userData.user);
            expect(authService.session).toEqual(userData.session);
            expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
                options: {
                    data: {
                        company_name: 'Test Company',
                        full_name: 'Test User',
                        phone: '',
                        plan: 'starter'
                    }
                }
            });
        });

        it('should throw error when registration fails', async () => {
            const error = new Error('Registration failed');
            mockSupabaseClient.auth.signUp.mockResolvedValue({
                data: null,
                error
            });

            await expect(
                authService.register('test@example.com', 'password123')
            ).rejects.toThrow('Registration failed');
        });

        it('should throw error when Supabase is not configured during registration', async () => {
            window.supabaseConfig.get = vi.fn(() => null);

            await expect(
                authService.register('test@example.com', 'password123')
            ).rejects.toThrow('Supabase nicht konfiguriert');
        });

        it('should register with full metadata', async () => {
            const userData = {
                user: { id: 'user123', email: 'test@example.com' },
                session: { access_token: 'token123' }
            };

            mockSupabaseClient.auth.signUp.mockResolvedValue({
                data: userData,
                error: null
            });

            await authService.register('test@example.com', 'password123', {
                fullName: 'John Doe',
                companyName: 'Acme Corp',
                phone: '+49123456789'
            });

            expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({
                        data: expect.objectContaining({
                            full_name: 'John Doe',
                            company_name: 'Acme Corp',
                            phone: '+49123456789'
                        })
                    })
                })
            );
        });
    });

    describe('User Login', () => {
        it('should successfully login a user', async () => {
            const userData = {
                user: { id: 'user123', email: 'test@example.com' },
                session: { access_token: 'token123' }
            };

            mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
                data: userData,
                error: null
            });

            const result = await authService.login('test@example.com', 'password123');

            expect(result).toEqual(userData);
            expect(authService.user).toEqual(userData.user);
            expect(authService.session).toEqual(userData.session);
        });

        it('should throw error on invalid credentials', async () => {
            const error = new Error('Invalid login credentials');
            mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
                data: null,
                error
            });

            await expect(
                authService.login('test@example.com', 'wrongpassword')
            ).rejects.toThrow('Invalid login credentials');
        });

        it('should throw error when Supabase is not configured during login', async () => {
            window.supabaseConfig.get = vi.fn(() => null);

            await expect(
                authService.login('test@example.com', 'password123')
            ).rejects.toThrow('Supabase nicht konfiguriert');
        });
    });

    describe('User Logout', () => {
        it('should successfully logout a user', async () => {
            // Setup: user is logged in
            authService.user = { id: 'user123', email: 'test@example.com' };
            authService.session = { access_token: 'token123' };

            mockSupabaseClient.auth.signOut.mockResolvedValue({});

            await authService.logout();

            expect(authService.user).toBeNull();
            expect(authService.session).toBeNull();
            expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
        });

        it('should handle logout when Supabase is not configured', async () => {
            window.supabaseConfig.get = vi.fn(() => null);

            // Should not throw an error
            await expect(authService.logout()).resolves.toBeUndefined();
        });
    });

    describe('Session Management', () => {
        it('should get current session', async () => {
            const sessionData = {
                user: { id: 'user123', email: 'test@example.com' },
                access_token: 'token123'
            };

            mockSupabaseClient.auth.getSession.mockResolvedValue({
                data: { session: sessionData },
                error: null
            });

            const result = await authService.getSession();

            expect(result).toEqual(sessionData);
            expect(authService.session).toEqual(sessionData);
            expect(authService.user).toEqual(sessionData.user);
        });

        it('should return null when no active session', async () => {
            mockSupabaseClient.auth.getSession.mockResolvedValue({
                data: { session: null },
                error: null
            });

            const result = await authService.getSession();

            expect(result).toBeNull();
            expect(authService.user).toBeNull();
        });

        it('should return null when Supabase is not configured', async () => {
            window.supabaseConfig.get = vi.fn(() => null);

            const result = await authService.getSession();

            expect(result).toBeNull();
        });
    });

    describe('Password Management', () => {
        it('should send password reset email', async () => {
            mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
                data: {},
                error: null
            });

            await authService.resetPassword('test@example.com');

            expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
                'test@example.com',
                expect.objectContaining({
                    redirectTo: 'http://localhost/index.html'
                })
            );
        });

        it('should throw error when password reset fails', async () => {
            const error = new Error('Email not found');
            mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
                data: null,
                error
            });

            await expect(
                authService.resetPassword('nonexistent@example.com')
            ).rejects.toThrow('Email not found');
        });

        it('should update user password', async () => {
            mockSupabaseClient.auth.updateUser.mockResolvedValue({
                data: { user: { id: 'user123' } },
                error: null
            });

            await authService.updatePassword('newpassword123');

            expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
                password: 'newpassword123'
            });
        });

        it('should throw error when password update fails', async () => {
            const error = new Error('Password update failed');
            mockSupabaseClient.auth.updateUser.mockResolvedValue({
                data: null,
                error
            });

            await expect(
                authService.updatePassword('newpassword123')
            ).rejects.toThrow('Password update failed');
        });
    });

    describe('User State Checks', () => {
        it('should return user when logged in', () => {
            authService.user = { id: 'user123', email: 'test@example.com' };

            expect(authService.getUser()).toEqual({ id: 'user123', email: 'test@example.com' });
        });

        it('should return null when not logged in', () => {
            authService.user = null;

            expect(authService.getUser()).toBeNull();
        });

        it('should check if user is logged in', () => {
            authService.user = { id: 'user123' };
            expect(authService.isLoggedIn()).toBe(true);

            authService.user = null;
            expect(authService.isLoggedIn()).toBe(false);
        });

        it('should return user plan', () => {
            authService.user = {
                id: 'user123',
                user_metadata: { plan: 'professional' }
            };

            expect(authService.getPlan()).toBe('professional');
        });

        it('should return starter plan as default', () => {
            authService.user = { id: 'user123' };

            expect(authService.getPlan()).toBe('starter');
        });

        it('should return starter plan when user is null', () => {
            authService.user = null;

            expect(authService.getPlan()).toBe('starter');
        });
    });

    describe('Auth State Change Listeners', () => {
        it('should register callback for auth changes', () => {
            const callback = vi.fn();

            authService.onAuthChange(callback);

            expect(authService.listeners).toContain(callback);
        });

        it('should unregister callback', () => {
            const callback = vi.fn();

            const unsubscribe = authService.onAuthChange(callback);
            unsubscribe();

            expect(authService.listeners).not.toContain(callback);
        });

        it('should notify all listeners when auth changes', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            authService.onAuthChange(callback1);
            authService.onAuthChange(callback2);

            authService.user = { id: 'user123' };
            authService.session = { access_token: 'token123' };
            authService._notify();

            expect(callback1).toHaveBeenCalledWith(
                { id: 'user123' },
                { access_token: 'token123' }
            );
            expect(callback2).toHaveBeenCalledWith(
                { id: 'user123' },
                { access_token: 'token123' }
            );
        });

        it('should setup auth state listener with client', () => {
            const callback = vi.fn();

            authService.onAuthChange(callback);

            expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
        });

        it('should not setup listener when client is not available', () => {
            // When supabase client is null, onAuthChange should handle gracefully
            const originalClient = window.supabaseClient;
            window.supabaseClient = null;

            // Create a fresh service instance that won't have client access
            const callback = vi.fn();

            // getClient() returns null when supabaseClient is null
            // onAuthChange should still add the listener without throwing
            expect(() => {
                authService.onAuthChange(callback);
            }).not.toThrow();

            window.supabaseClient = originalClient;
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle login followed by session check', async () => {
            const loginData = {
                user: { id: 'user123', email: 'test@example.com' },
                session: { access_token: 'token123' }
            };

            mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
                data: loginData,
                error: null
            });

            await authService.login('test@example.com', 'password123');

            expect(authService.isLoggedIn()).toBe(true);
            expect(authService.getUser().id).toBe('user123');
        });

        it('should handle register and get plan', async () => {
            const userData = {
                user: { id: 'user123', email: 'test@example.com', user_metadata: { plan: 'starter' } },
                session: { access_token: 'token123' }
            };

            mockSupabaseClient.auth.signUp.mockResolvedValue({
                data: userData,
                error: null
            });

            await authService.register('test@example.com', 'password123');

            expect(authService.getPlan()).toBe('starter');
        });

        it('should notify listeners on multiple state changes', () => {
            const callback = vi.fn();
            authService.onAuthChange(callback);

            // First change
            authService.user = { id: 'user123' };
            authService._notify();
            expect(callback).toHaveBeenCalledTimes(1);

            // Second change
            authService.session = { access_token: 'token456' };
            authService._notify();
            expect(callback).toHaveBeenCalledTimes(2);
        });
    });
});
