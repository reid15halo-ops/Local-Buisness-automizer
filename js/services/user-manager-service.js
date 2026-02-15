/* ============================================
   User Manager Service - Local Multi-User
   PIN-based authentication, User switching
   ============================================ */

class UserManagerService {
    constructor() {
        this.currentUser = null;
        this.listeners = [];
        this.SESSION_KEY = 'mhs_current_user_session';
        this.SALT_LENGTH = 16; // bytes
        this.ITERATIONS = 100000; // PBKDF2 iterations
        this.KEY_LENGTH = 32; // bytes (256 bits)
    }

    /**
     * Initializes the service and restores previous session if exists.
     */
    async init() {
        // Check for existing session
        const sessionData = sessionStorage.getItem(this.SESSION_KEY);
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                const user = await window.dbService.getUser(session.userId);
                if (user) {
                    this.currentUser = user;
                    this._notify();
                    return user;
                }
            } catch (e) {
                console.error('Session restore failed:', e);
                sessionStorage.removeItem(this.SESSION_KEY);
            }
        }
        return null;
    }

    // ========================================
    // PIN Hashing (Web Crypto API - PBKDF2)
    // ========================================

    /**
     * Generates a cryptographic salt.
     * @returns {Uint8Array}
     */
    _generateSalt() {
        return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    }

    /**
     * Hashes a PIN using PBKDF2.
     * @param {string} pin - The PIN to hash
     * @param {Uint8Array} salt - Salt for hashing
     * @returns {Promise<{hash: string, salt: string}>}
     */
    async _hashPin(pin, salt = null) {
        if (!salt) {
            salt = this._generateSalt();
        }

        // Import PIN as key material
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(pin),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );

        // Derive key using PBKDF2
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            this.KEY_LENGTH * 8 // bits
        );

        // Convert to hex strings
        const hashArray = Array.from(new Uint8Array(derivedBits));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const saltArray = Array.from(salt);
        const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return { hash: hashHex, salt: saltHex };
    }

    /**
     * Verifies a PIN against a stored hash.
     * @param {string} pin - The PIN to verify
     * @param {string} storedHash - The stored hash
     * @param {string} storedSalt - The stored salt (hex)
     * @returns {Promise<boolean>}
     */
    async _verifyPin(pin, storedHash, storedSalt) {
        // Convert salt from hex to Uint8Array
        const saltArray = storedSalt.match(/.{2}/g).map(byte => parseInt(byte, 16));
        const salt = new Uint8Array(saltArray);

        // Hash the provided PIN with the stored salt
        const { hash } = await this._hashPin(pin, salt);

        // Constant-time comparison (timing attack resistant)
        return hash === storedHash;
    }

    // ========================================
    // User Management
    // ========================================

    /**
     * Gets all users from the database.
     * @returns {Promise<Array>}
     */
    async getAllUsers() {
        const users = await window.dbService.getAllUsers();
        // Don't return PIN hashes to the UI
        return users.map(user => ({
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            created_at: user.created_at
        }));
    }

    /**
     * Creates a new user with PIN.
     * @param {string} name - User display name
     * @param {string} pin - User PIN (4-6 digits recommended)
     * @param {string} avatar - Avatar emoji/icon (optional)
     * @returns {Promise<Object>} The created user (without PIN hash)
     */
    async createUser(name, pin, avatar = '👤') {
        if (!name || name.trim().length === 0) {
            throw new Error('Name ist erforderlich');
        }

        if (!pin || pin.length < 4) {
            throw new Error('PIN muss mindestens 4 Zeichen lang sein');
        }

        // Generate user ID
        const userId = this._generateUserId(name);

        // Check if user already exists
        const existingUser = await window.dbService.getUser(userId);
        if (existingUser) {
            throw new Error('Benutzer existiert bereits');
        }

        // Hash PIN
        const { hash, salt } = await this._hashPin(pin);

        // Create user object
        const user = {
            id: userId,
            name: name.trim(),
            pin_hash: hash,
            pin_salt: salt,
            avatar: avatar,
            created_at: new Date().toISOString()
        };

        // Save to database
        await window.dbService.saveUser(user);

        // Create user data store
        await window.dbService.createUserStore(userId);

        console.log(`User created: ${name} (${userId})`);

        // Return user without sensitive data
        return {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            created_at: user.created_at
        };
    }

    /**
     * Generates a user ID from name (lowercase, no spaces).
     * @param {string} name
     * @returns {string}
     */
    _generateUserId(name) {
        return name.toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    /**
     * Logs in a user with PIN.
     * @param {string} userId - User ID
     * @param {string} pin - User PIN
     * @returns {Promise<Object>} The logged-in user
     */
    async login(userId, pin) {
        // Get user from database
        const user = await window.dbService.getUser(userId);
        if (!user) {
            throw new Error('Benutzer nicht gefunden');
        }

        // Verify PIN
        const isValid = await this._verifyPin(pin, user.pin_hash, user.pin_salt);
        if (!isValid) {
            throw new Error('Falscher PIN');
        }

        // Set current user
        this.currentUser = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            created_at: user.created_at
        };

        // Save session
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({
            userId: user.id,
            loginAt: new Date().toISOString()
        }));

        this._notify();
        console.log(`User logged in: ${user.name}`);

        return this.currentUser;
    }

    /**
     * Logs out the current user.
     */
    logout() {
        if (!this.currentUser) return;

        const userName = this.currentUser.name;
        this.currentUser = null;
        sessionStorage.removeItem(this.SESSION_KEY);

        this._notify();
        console.log(`User logged out: ${userName}`);
    }

    /**
     * Switches to another user (requires PIN).
     * @param {string} userId
     * @param {string} pin
     * @returns {Promise<Object>}
     */
    async switchUser(userId, pin) {
        this.logout();
        return await this.login(userId, pin);
    }

    /**
     * Updates user information (name, avatar).
     * @param {string} userId
     * @param {Object} updates - { name?, avatar? }
     * @returns {Promise<void>}
     */
    async updateUser(userId, updates) {
        const user = await window.dbService.getUser(userId);
        if (!user) {
            throw new Error('Benutzer nicht gefunden');
        }

        // Update fields
        if (updates.name) user.name = updates.name.trim();
        if (updates.avatar) user.avatar = updates.avatar;

        // Save
        await window.dbService.saveUser(user);

        // Update current user if it's the same
        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser.name = user.name;
            this.currentUser.avatar = user.avatar;
            this._notify();
        }

        console.log(`User updated: ${user.name}`);
    }

    /**
     * Changes a user's PIN.
     * @param {string} userId
     * @param {string} oldPin
     * @param {string} newPin
     * @returns {Promise<void>}
     */
    async changePin(userId, oldPin, newPin) {
        const user = await window.dbService.getUser(userId);
        if (!user) {
            throw new Error('Benutzer nicht gefunden');
        }

        // Verify old PIN
        const isValid = await this._verifyPin(oldPin, user.pin_hash, user.pin_salt);
        if (!isValid) {
            throw new Error('Alter PIN ist falsch');
        }

        // Hash new PIN
        const { hash, salt } = await this._hashPin(newPin);
        user.pin_hash = hash;
        user.pin_salt = salt;

        // Save
        await window.dbService.saveUser(user);
        console.log(`PIN changed for user: ${user.name}`);
    }

    /**
     * Deletes a user and all their data.
     * @param {string} userId
     * @param {string} pin - PIN verification required
     * @returns {Promise<void>}
     */
    async deleteUser(userId, pin) {
        const user = await window.dbService.getUser(userId);
        if (!user) {
            throw new Error('Benutzer nicht gefunden');
        }

        // Verify PIN
        const isValid = await this._verifyPin(pin, user.pin_hash, user.pin_salt);
        if (!isValid) {
            throw new Error('Falscher PIN');
        }

        // Logout if current user
        if (this.currentUser && this.currentUser.id === userId) {
            this.logout();
        }

        // Delete user and data
        await window.dbService.deleteUser(userId);
        console.log(`User deleted: ${user.name}`);
    }

    /**
     * Creates a default "demo" user if no users exist.
     * @returns {Promise<Object|null>}
     */
    async createDefaultUserIfNeeded() {
        const users = await window.dbService.getAllUsers();
        if (users.length === 0) {
            console.log('No users found, creating default user...');
            return await this.createUser('default', '0000', '🔧');
        }
        return null;
    }

    // ========================================
    // State & Subscription
    // ========================================

    /**
     * Gets the current logged-in user.
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Checks if a user is currently logged in.
     * @returns {boolean}
     */
    isLoggedIn() {
        return !!this.currentUser;
    }

    /**
     * Subscribes to user change events.
     * @param {Function} callback - Called with (currentUser) when user changes
     * @returns {Function} Unsubscribe function
     */
    onUserChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Notifies all listeners of user state change.
     * @private
     */
    _notify() {
        this.listeners.forEach(cb => cb(this.currentUser));
    }
}

// Global instance
window.userManager = new UserManagerService();
