/* ============================================
   Team Management Service
   Multi-User / Team with Roles & Permissions
   German craftspeople roles (Meister, Geselle, Azubi, Buero)
   ============================================ */

class TeamManagementService {
    constructor() {
        this.STORAGE_KEY = 'freyai_team_data';
        this.INVITES_KEY = 'freyai_team_invites';
        this.ASSIGNMENTS_KEY = 'freyai_team_assignments';
        this.ACTIVITY_KEY = 'freyai_team_activity';
        this.listeners = [];

        // Load persisted data
        this.teamData = this._loadData(this.STORAGE_KEY, { members: [], settings: {} });
        this.invites = this._loadData(this.INVITES_KEY, []);
        this.assignments = this._loadData(this.ASSIGNMENTS_KEY, []);
        this.activityLog = this._loadData(this.ACTIVITY_KEY, []);
    }

    // ============================================
    // Role Definitions with Permissions
    // ============================================

    ROLES = {
        meister: {
            label: 'Meister/Inhaber',
            icon: '\u{1F451}',
            color: '#f59e0b',
            description: 'Vollzugriff auf alle Funktionen. Kann Team verwalten, Einstellungen aendern und alle Daten einsehen.',
            permissions: ['*']
        },
        geselle: {
            label: 'Geselle',
            icon: '\u{1F527}',
            color: '#3b82f6',
            description: 'Kann Auftraege bearbeiten, Zeiten erfassen, Fotos hinzufuegen und Material einsehen.',
            permissions: [
                'view_all',
                'edit_auftraege',
                'edit_zeiterfassung',
                'add_photos',
                'view_material',
                'use_aufmass',
                'view_kunden',
                'view_angebote',
                'view_rechnungen'
            ]
        },
        azubi: {
            label: 'Azubi',
            icon: '\u{1F4DA}',
            color: '#22c55e',
            description: 'Kann zugewiesene Auftraege sehen, Zeiten erfassen und Fotos hinzufuegen.',
            permissions: [
                'view_assigned',
                'edit_zeiterfassung',
                'add_photos'
            ]
        },
        buero: {
            label: 'Buero',
            icon: '\u{1F4BC}',
            color: '#8b5cf6',
            description: 'Kann Anfragen, Angebote, Rechnungen, Kunden und Buchhaltung verwalten sowie E-Mails senden.',
            permissions: [
                'view_all',
                'edit_anfragen',
                'edit_angebote',
                'edit_rechnungen',
                'edit_kunden',
                'edit_buchhaltung',
                'send_emails',
                'view_auftraege',
                'view_material',
                'view_zeiterfassung'
            ]
        }
    };

    // All available permissions for the matrix display
    ALL_PERMISSIONS = [
        { key: 'view_all', label: 'Alle Daten einsehen', category: 'Ansicht' },
        { key: 'view_assigned', label: 'Zugewiesene Auftraege einsehen', category: 'Ansicht' },
        { key: 'view_kunden', label: 'Kunden einsehen', category: 'Ansicht' },
        { key: 'view_angebote', label: 'Angebote einsehen', category: 'Ansicht' },
        { key: 'view_rechnungen', label: 'Rechnungen einsehen', category: 'Ansicht' },
        { key: 'view_auftraege', label: 'Auftraege einsehen', category: 'Ansicht' },
        { key: 'view_material', label: 'Material einsehen', category: 'Ansicht' },
        { key: 'view_zeiterfassung', label: 'Zeiterfassung einsehen', category: 'Ansicht' },
        { key: 'edit_anfragen', label: 'Anfragen bearbeiten', category: 'Bearbeitung' },
        { key: 'edit_angebote', label: 'Angebote bearbeiten', category: 'Bearbeitung' },
        { key: 'edit_auftraege', label: 'Auftraege bearbeiten', category: 'Bearbeitung' },
        { key: 'edit_rechnungen', label: 'Rechnungen bearbeiten', category: 'Bearbeitung' },
        { key: 'edit_kunden', label: 'Kunden bearbeiten', category: 'Bearbeitung' },
        { key: 'edit_buchhaltung', label: 'Buchhaltung bearbeiten', category: 'Bearbeitung' },
        { key: 'edit_zeiterfassung', label: 'Zeiterfassung bearbeiten', category: 'Bearbeitung' },
        { key: 'add_photos', label: 'Fotos hinzufuegen', category: 'Medien' },
        { key: 'use_aufmass', label: 'Aufmass verwenden', category: 'Werkzeuge' },
        { key: 'send_emails', label: 'E-Mails senden', category: 'Kommunikation' },
        { key: 'manage_team', label: 'Team verwalten', category: 'Administration' },
        { key: 'manage_settings', label: 'Einstellungen aendern', category: 'Administration' }
    ];

    // ============================================
    // Data Persistence Helpers
    // ============================================

    _loadData(key, defaultValue) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {
            console.error(`TeamManagement: Fehler beim Laden von ${key}:`, e);
        }
        return defaultValue;
    }

    _saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            this._syncToSupabase(key, data);
        } catch (e) {
            console.error(`TeamManagement: Fehler beim Speichern von ${key}:`, e);
        }
    }

    _saveTeamData() {
        this._saveData(this.STORAGE_KEY, this.teamData);
        this._notify('team_updated');
    }

    _saveInvites() {
        this._saveData(this.INVITES_KEY, this.invites);
        this._notify('invites_updated');
    }

    _saveAssignments() {
        this._saveData(this.ASSIGNMENTS_KEY, this.assignments);
        this._notify('assignments_updated');
    }

    _saveActivity() {
        this._saveData(this.ACTIVITY_KEY, this.activityLog);
    }

    /**
     * Sync to Supabase when available (non-blocking).
     */
    async _syncToSupabase(key, data) {
        try {
            const client = window.supabaseConfig?.get();
            if (!client) { return; }

            const user = window.authService?.getUser();
            if (!user) { return; }

            await client
                .from('team_data')
                .upsert({
                    user_id: user.id,
                    data_key: key,
                    data_value: data,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,data_key' });
        } catch (e) {
            // Supabase sync is best-effort; don't block local operations
            console.warn('TeamManagement: Supabase-Sync fehlgeschlagen:', e.message);
        }
    }

    // ============================================
    // ID Generation
    // ============================================

    _generateId() {
        return 'tm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
    }

    _generateInviteToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        const values = crypto.getRandomValues(new Uint8Array(32));
        for (let i = 0; i < 32; i++) {
            token += chars[values[i] % chars.length];
        }
        return token;
    }

    // ============================================
    // Team Member CRUD
    // ============================================

    /**
     * Returns all team members.
     * @returns {Array} List of team member objects
     */
    getTeamMembers() {
        return [...this.teamData.members];
    }

    /**
     * Get a single team member by ID.
     * @param {string} memberId
     * @returns {Object|null}
     */
    getMember(memberId) {
        return this.teamData.members.find(m => m.id === memberId) || null;
    }

    /**
     * Add a new team member.
     * @param {Object} memberData - { name, email, phone, role, assignedJobs }
     * @returns {Object} The created member
     */
    addTeamMember({ name, email = '', phone = '', role = 'geselle', assignedJobs = [] }) {
        try {
            if (!name || name.trim().length === 0) {
                throw new Error('Name ist erforderlich');
            }

            if (!this.ROLES[role]) {
                throw new Error(`Unbekannte Rolle: ${role}`);
            }

            // Check for duplicate email if provided
            if (email && this.teamData.members.some(m => m.email === email)) {
                throw new Error('Ein Teammitglied mit dieser E-Mail existiert bereits');
            }

            const member = {
                id: this._generateId(),
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                role: role,
                assignedJobs: assignedJobs,
                status: 'active',
                avatar: this.ROLES[role].icon,
                customPermissions: null, // null = use role defaults; array = custom overrides
                joinedAt: new Date().toISOString(),
                lastActiveAt: null,
                notes: ''
            };

            this.teamData.members.push(member);
            this._saveTeamData();

            this._logActivity(member.id, 'member_added', {
                memberName: member.name,
                role: member.role
            });

            return member;
        } catch (e) {
            console.error('TeamManagement: Fehler beim Hinzufuegen:', e);
            throw e;
        }
    }

    /**
     * Update an existing team member.
     * @param {string} memberId
     * @param {Object} updates - Fields to update
     * @returns {Object} Updated member
     */
    updateTeamMember(memberId, updates) {
        try {
            const index = this.teamData.members.findIndex(m => m.id === memberId);
            if (index === -1) {
                throw new Error('Teammitglied nicht gefunden');
            }

            // Validate role if being changed
            if (updates.role && !this.ROLES[updates.role]) {
                throw new Error(`Unbekannte Rolle: ${updates.role}`);
            }

            // Prevent duplicate email
            if (updates.email) {
                const duplicate = this.teamData.members.find(
                    m => m.email === updates.email && m.id !== memberId
                );
                if (duplicate) {
                    throw new Error('Ein anderes Teammitglied hat bereits diese E-Mail');
                }
            }

            const oldMember = { ...this.teamData.members[index] };
            Object.assign(this.teamData.members[index], updates);
            this._saveTeamData();

            this._logActivity(memberId, 'member_updated', {
                memberName: this.teamData.members[index].name,
                changes: Object.keys(updates)
            });

            return this.teamData.members[index];
        } catch (e) {
            console.error('TeamManagement: Fehler beim Aktualisieren:', e);
            throw e;
        }
    }

    /**
     * Remove a team member.
     * @param {string} memberId
     * @returns {boolean} Success
     */
    removeTeamMember(memberId) {
        try {
            const index = this.teamData.members.findIndex(m => m.id === memberId);
            if (index === -1) {
                throw new Error('Teammitglied nicht gefunden');
            }

            const member = this.teamData.members[index];

            // Remove from team
            this.teamData.members.splice(index, 1);
            this._saveTeamData();

            // Remove all job assignments for this member
            this.assignments = this.assignments.filter(a => a.memberId !== memberId);
            this._saveAssignments();

            this._logActivity(null, 'member_removed', {
                memberName: member.name,
                role: member.role
            });

            return true;
        } catch (e) {
            console.error('TeamManagement: Fehler beim Entfernen:', e);
            throw e;
        }
    }

    /**
     * Set a member's status (active, inactive, away).
     * @param {string} memberId
     * @param {string} status
     */
    setMemberStatus(memberId, status) {
        const member = this.getMember(memberId);
        if (!member) {
            throw new Error('Teammitglied nicht gefunden');
        }
        this.updateTeamMember(memberId, { status });
    }

    // ============================================
    // Invite System
    // ============================================

    /**
     * Generate an invite for a new team member.
     * @param {string} email - Email to invite
     * @param {string} role - Role to assign
     * @returns {Object} Invite object with token
     */
    inviteMember(email, role = 'geselle') {
        try {
            if (!email || !email.includes('@')) {
                throw new Error('Gueltige E-Mail-Adresse erforderlich');
            }

            if (!this.ROLES[role]) {
                throw new Error(`Unbekannte Rolle: ${role}`);
            }

            // Check if already invited
            const existingInvite = this.invites.find(
                i => i.email === email && i.status === 'pending'
            );
            if (existingInvite) {
                throw new Error('Diese E-Mail wurde bereits eingeladen');
            }

            // Check if already a member
            if (this.teamData.members.some(m => m.email === email)) {
                throw new Error('Diese Person ist bereits Teammitglied');
            }

            const invite = {
                id: this._generateId(),
                email: email.trim(),
                role: role,
                token: this._generateInviteToken(),
                status: 'pending', // pending, accepted, revoked, expired
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                invitedBy: this._getCurrentMemberId()
            };

            this.invites.push(invite);
            this._saveInvites();

            // Try to send email notification
            this._sendInviteEmail(invite);

            this._logActivity(null, 'invite_sent', {
                email: invite.email,
                role: invite.role
            });

            return invite;
        } catch (e) {
            console.error('TeamManagement: Fehler bei Einladung:', e);
            throw e;
        }
    }

    /**
     * Accept an invite and join the team.
     * @param {string} inviteToken
     * @param {Object} userData - { name, phone }
     * @returns {Object} Created team member
     */
    acceptInvite(inviteToken, userData = {}) {
        try {
            const invite = this.invites.find(
                i => i.token === inviteToken && i.status === 'pending'
            );

            if (!invite) {
                throw new Error('Einladung nicht gefunden oder bereits verwendet');
            }

            // Check expiry
            if (new Date(invite.expiresAt) < new Date()) {
                invite.status = 'expired';
                this._saveInvites();
                throw new Error('Diese Einladung ist abgelaufen');
            }

            // Create team member from invite
            const member = this.addTeamMember({
                name: userData.name || invite.email.split('@')[0],
                email: invite.email,
                phone: userData.phone || '',
                role: invite.role
            });

            // Mark invite as accepted
            invite.status = 'accepted';
            invite.acceptedAt = new Date().toISOString();
            invite.memberId = member.id;
            this._saveInvites();

            return member;
        } catch (e) {
            console.error('TeamManagement: Fehler bei Annahme der Einladung:', e);
            throw e;
        }
    }

    /**
     * Get all pending invites.
     * @returns {Array}
     */
    getPendingInvites() {
        const now = new Date();
        return this.invites.filter(i => {
            if (i.status !== 'pending') { return false; }
            // Auto-expire old invites
            if (new Date(i.expiresAt) < now) {
                i.status = 'expired';
                return false;
            }
            return true;
        });
    }

    /**
     * Revoke a pending invite.
     * @param {string} inviteId
     * @returns {boolean}
     */
    revokeInvite(inviteId) {
        try {
            const invite = this.invites.find(i => i.id === inviteId);
            if (!invite) {
                throw new Error('Einladung nicht gefunden');
            }

            if (invite.status !== 'pending') {
                throw new Error('Einladung kann nicht widerrufen werden (Status: ' + invite.status + ')');
            }

            invite.status = 'revoked';
            invite.revokedAt = new Date().toISOString();
            this._saveInvites();

            this._logActivity(null, 'invite_revoked', { email: invite.email });

            return true;
        } catch (e) {
            console.error('TeamManagement: Fehler beim Widerrufen:', e);
            throw e;
        }
    }

    /**
     * Resend an existing pending invite.
     * @param {string} inviteId
     * @returns {Object} The invite
     */
    resendInvite(inviteId) {
        const invite = this.invites.find(i => i.id === inviteId && i.status === 'pending');
        if (!invite) {
            throw new Error('Einladung nicht gefunden oder nicht mehr offen');
        }

        // Refresh expiry
        invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        this._saveInvites();

        this._sendInviteEmail(invite);
        return invite;
    }

    /**
     * Send invite email via email service (best-effort).
     */
    async _sendInviteEmail(invite) {
        try {
            const emailService = window.emailService;
            if (!emailService) {
                console.warn('TeamManagement: E-Mail-Service nicht verfuegbar, Einladung nur als Link.');
                return;
            }

            const companyName = window.storeService?.store?.settings?.companyName || 'FreyAI Visions';
            const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${invite.token}`;
            const roleLabel = this.ROLES[invite.role]?.label || invite.role;

            await emailService.send({
                to: invite.email,
                subject: `Einladung zum Team - ${companyName}`,
                body: `Hallo,\n\nSie wurden als ${roleLabel} zum Team von ${companyName} eingeladen.\n\nKlicken Sie auf den folgenden Link, um die Einladung anzunehmen:\n${inviteUrl}\n\nDie Einladung ist 7 Tage gueltig.\n\nMit freundlichen Gruessen,\n${companyName}`
            });
        } catch (e) {
            console.warn('TeamManagement: E-Mail-Versand fehlgeschlagen:', e.message);
        }
    }

    /**
     * Get the invite link URL for a given invite.
     * @param {string} inviteId
     * @returns {string}
     */
    getInviteLink(inviteId) {
        const invite = this.invites.find(i => i.id === inviteId);
        if (!invite) { return ''; }
        return `${window.location.origin}${window.location.pathname}?invite=${invite.token}`;
    }

    // ============================================
    // Permission Checking
    // ============================================

    /**
     * Check if a member has a specific permission.
     * @param {string} memberId
     * @param {string} permission - Permission key to check
     * @returns {boolean}
     */
    hasPermission(memberId, permission) {
        try {
            const member = this.getMember(memberId);
            if (!member) { return false; }
            if (member.status !== 'active') { return false; }

            // Custom permissions override role defaults
            const permissions = member.customPermissions || this.ROLES[member.role]?.permissions || [];

            // Wildcard = full access (Meister)
            if (permissions.includes('*')) { return true; }

            return permissions.includes(permission);
        } catch (e) {
            console.error('TeamManagement: Fehler bei Berechtigungspruefung:', e);
            return false;
        }
    }

    /**
     * Resource-based access check.
     * Maps resource + action to a permission key.
     * @param {string} memberId
     * @param {string} resource - e.g. 'auftraege', 'kunden', 'rechnungen'
     * @param {string} action - e.g. 'view', 'edit', 'delete'
     * @returns {boolean}
     */
    canAccess(memberId, resource, action = 'view') {
        try {
            const member = this.getMember(memberId);
            if (!member) { return false; }
            if (member.status !== 'active') { return false; }

            const permissions = member.customPermissions || this.ROLES[member.role]?.permissions || [];

            // Full access
            if (permissions.includes('*')) { return true; }

            // Build permission key
            const permKey = `${action}_${resource}`;

            // Direct match
            if (permissions.includes(permKey)) { return true; }

            // view_all grants all view_ permissions
            if (action === 'view' && permissions.includes('view_all')) { return true; }

            // For azubi: check if they have view_assigned and the job is assigned to them
            if (permissions.includes('view_assigned') && action === 'view') {
                // Allow view access to assigned resources
                return true;
            }

            return false;
        } catch (e) {
            console.error('TeamManagement: Fehler bei Zugriffspruefung:', e);
            return false;
        }
    }

    /**
     * Get the current logged-in user's role.
     * Falls back to 'meister' if no team is set up (single-user mode).
     * @returns {string} Role key
     */
    getCurrentUserRole() {
        const memberId = this._getCurrentMemberId();
        if (!memberId) { return 'meister'; } // Default: full access in single-user mode

        const member = this.getMember(memberId);
        return member ? member.role : 'meister';
    }

    /**
     * Get the current user's member ID based on auth state.
     * @returns {string|null}
     */
    _getCurrentMemberId() {
        // Try Supabase auth user first
        const authUser = window.authService?.getUser();
        if (authUser?.email) {
            const member = this.teamData.members.find(m => m.email === authUser.email);
            if (member) { return member.id; }
        }

        // Try local user manager
        const localUser = window.userManager?.getCurrentUser();
        if (localUser) {
            const member = this.teamData.members.find(
                m => m.name === localUser.name || m.id === localUser.id
            );
            if (member) { return member.id; }
        }

        // If only one member exists, assume it's the current user
        if (this.teamData.members.length === 1) {
            return this.teamData.members[0].id;
        }

        return null;
    }

    /**
     * Check if current user has the given permission.
     * Convenience wrapper around hasPermission.
     * @param {string} permission
     * @returns {boolean}
     */
    currentUserCan(permission) {
        const memberId = this._getCurrentMemberId();
        if (!memberId) { return true; } // No team setup = full access
        return this.hasPermission(memberId, permission);
    }

    /**
     * Get the permissions list for a given role.
     * @param {string} roleKey
     * @returns {Array<string>}
     */
    getRolePermissions(roleKey) {
        return this.ROLES[roleKey]?.permissions || [];
    }

    /**
     * Set custom permissions for a member (override role defaults).
     * @param {string} memberId
     * @param {Array<string>} permissions
     */
    setCustomPermissions(memberId, permissions) {
        this.updateTeamMember(memberId, { customPermissions: permissions });
    }

    /**
     * Reset a member's permissions back to role defaults.
     * @param {string} memberId
     */
    resetToRolePermissions(memberId) {
        this.updateTeamMember(memberId, { customPermissions: null });
    }

    // ============================================
    // Job Assignment
    // ============================================

    /**
     * Assign a team member to a job (Auftrag).
     * @param {string} auftragId
     * @param {string} memberId
     * @returns {Object} Assignment record
     */
    assignJob(auftragId, memberId) {
        try {
            if (!auftragId || !memberId) {
                throw new Error('Auftrags-ID und Mitglied-ID erforderlich');
            }

            const member = this.getMember(memberId);
            if (!member) {
                throw new Error('Teammitglied nicht gefunden');
            }

            // Check for existing assignment
            const exists = this.assignments.find(
                a => a.auftragId === auftragId && a.memberId === memberId
            );
            if (exists) {
                return exists; // Already assigned
            }

            const assignment = {
                id: this._generateId(),
                auftragId: auftragId,
                memberId: memberId,
                assignedAt: new Date().toISOString(),
                assignedBy: this._getCurrentMemberId()
            };

            this.assignments.push(assignment);
            this._saveAssignments();

            // Also update member's assignedJobs list
            if (!member.assignedJobs) { member.assignedJobs = []; }
            if (!member.assignedJobs.includes(auftragId)) {
                member.assignedJobs.push(auftragId);
                this._saveTeamData();
            }

            this._logActivity(memberId, 'job_assigned', {
                auftragId,
                memberName: member.name
            });

            return assignment;
        } catch (e) {
            console.error('TeamManagement: Fehler bei Auftragszuweisung:', e);
            throw e;
        }
    }

    /**
     * Remove a team member from a job.
     * @param {string} auftragId
     * @param {string} memberId
     * @returns {boolean}
     */
    unassignJob(auftragId, memberId) {
        try {
            const index = this.assignments.findIndex(
                a => a.auftragId === auftragId && a.memberId === memberId
            );

            if (index === -1) { return false; }

            this.assignments.splice(index, 1);
            this._saveAssignments();

            // Update member's assignedJobs list
            const member = this.getMember(memberId);
            if (member && member.assignedJobs) {
                member.assignedJobs = member.assignedJobs.filter(id => id !== auftragId);
                this._saveTeamData();
            }

            this._logActivity(memberId, 'job_unassigned', {
                auftragId,
                memberName: member?.name || 'Unbekannt'
            });

            return true;
        } catch (e) {
            console.error('TeamManagement: Fehler beim Entfernen der Zuweisung:', e);
            throw e;
        }
    }

    /**
     * Get all jobs assigned to a member.
     * @param {string} memberId
     * @returns {Array} List of assignment records
     */
    getAssignedJobs(memberId) {
        return this.assignments.filter(a => a.memberId === memberId);
    }

    /**
     * Get all team members assigned to a job.
     * @param {string} auftragId
     * @returns {Array} List of assignment records with member data
     */
    getJobAssignees(auftragId) {
        return this.assignments
            .filter(a => a.auftragId === auftragId)
            .map(a => ({
                ...a,
                member: this.getMember(a.memberId)
            }))
            .filter(a => a.member !== null);
    }

    /**
     * Check if a member is assigned to a specific job.
     * @param {string} auftragId
     * @param {string} memberId
     * @returns {boolean}
     */
    isAssignedToJob(auftragId, memberId) {
        return this.assignments.some(
            a => a.auftragId === auftragId && a.memberId === memberId
        );
    }

    // ============================================
    // Activity Tracking
    // ============================================

    /**
     * Log an activity entry.
     * @param {string|null} memberId
     * @param {string} action
     * @param {Object} details
     */
    _logActivity(memberId, action, details = {}) {
        const entry = {
            id: this._generateId(),
            memberId: memberId,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        };

        this.activityLog.unshift(entry); // Newest first

        // Keep max 500 entries
        if (this.activityLog.length > 500) {
            this.activityLog = this.activityLog.slice(0, 500);
        }

        this._saveActivity();
    }

    /**
     * Get activity log for a specific member within a date range.
     * @param {string} memberId
     * @param {Object} dateRange - { start: ISO string, end: ISO string }
     * @returns {Array}
     */
    getMemberActivity(memberId, dateRange = null) {
        let activities = this.activityLog.filter(a => a.memberId === memberId);

        if (dateRange) {
            const start = dateRange.start ? new Date(dateRange.start) : new Date(0);
            const end = dateRange.end ? new Date(dateRange.end) : new Date();
            activities = activities.filter(a => {
                const ts = new Date(a.timestamp);
                return ts >= start && ts <= end;
            });
        }

        return activities;
    }

    /**
     * Get time tracking entries for a specific member.
     * Integrates with TimeTrackingService if available.
     * @param {string} memberId
     * @param {Object} dateRange - { start, end }
     * @returns {Array}
     */
    getMemberTimeEntries(memberId, dateRange = null) {
        try {
            const timeService = window.timeTrackingService;
            if (!timeService) { return []; }

            let entries = timeService.entries.filter(e => e.employeeId === memberId);

            if (dateRange) {
                const start = dateRange.start || '1970-01-01';
                const end = dateRange.end || '2099-12-31';
                entries = entries.filter(e => e.date >= start && e.date <= end);
            }

            return entries;
        } catch (e) {
            console.error('TeamManagement: Fehler bei Zeiterfassung-Abfrage:', e);
            return [];
        }
    }

    /**
     * Get statistics for a team member.
     * @param {string} memberId
     * @returns {Object} Stats object
     */
    getMemberStats(memberId) {
        try {
            const member = this.getMember(memberId);
            if (!member) { return null; }

            const assignedJobs = this.getAssignedJobs(memberId);
            const activities = this.getMemberActivity(memberId);
            const timeEntries = this.getMemberTimeEntries(memberId);

            // Calculate total hours
            const totalHours = timeEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0);

            // Hours this month
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const monthEntries = timeEntries.filter(e => e.date >= monthStart);
            const monthHours = monthEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0);

            // Count completed jobs (from store if available)
            let completedJobs = 0;
            if (window.storeService) {
                const auftraege = window.storeService.store.auftraege || [];
                assignedJobs.forEach(aj => {
                    const auftrag = auftraege.find(a => a.id === aj.auftragId);
                    if (auftrag && (auftrag.status === 'abgeschlossen' || auftrag.status === 'erledigt')) {
                        completedJobs++;
                    }
                });
            }

            return {
                memberId: memberId,
                name: member.name,
                role: member.role,
                totalAssignedJobs: assignedJobs.length,
                completedJobs: completedJobs,
                activeJobs: assignedJobs.length - completedJobs,
                totalHoursLogged: Math.round(totalHours * 100) / 100,
                monthHoursLogged: Math.round(monthHours * 100) / 100,
                totalActivities: activities.length,
                lastActiveAt: member.lastActiveAt,
                joinedAt: member.joinedAt
            };
        } catch (e) {
            console.error('TeamManagement: Fehler bei Statistik-Berechnung:', e);
            return null;
        }
    }

    // ============================================
    // Team Overview & Schedule
    // ============================================

    /**
     * Get overview of all team members with their current status.
     * @returns {Array} Members with stats
     */
    getTeamOverview() {
        return this.teamData.members.map(member => {
            const stats = this.getMemberStats(member.id);
            return {
                ...member,
                stats: stats,
                activeJobCount: stats?.activeJobs || 0,
                monthHours: stats?.monthHoursLogged || 0
            };
        });
    }

    /**
     * Get team schedule for a given date.
     * Shows who is working where based on job assignments and time entries.
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {Array} Schedule entries
     */
    getTeamSchedule(date = null) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const schedule = [];

        for (const member of this.teamData.members) {
            if (member.status !== 'active') { continue; }

            // Get time entries for this date
            const timeEntries = this.getMemberTimeEntries(member.id, {
                start: targetDate,
                end: targetDate
            });

            // Get assigned jobs
            const assignedJobs = this.getAssignedJobs(member.id);
            const jobDetails = [];

            if (window.storeService) {
                const auftraege = window.storeService.store.auftraege || [];
                for (const aj of assignedJobs) {
                    const auftrag = auftraege.find(a => a.id === aj.auftragId);
                    if (auftrag && auftrag.status !== 'abgeschlossen' && auftrag.status !== 'erledigt') {
                        jobDetails.push({
                            id: auftrag.id,
                            titel: auftrag.titel || auftrag.title || 'Unbenannt',
                            kunde: auftrag.kunde || auftrag.customer || '',
                            status: auftrag.status
                        });
                    }
                }
            }

            // Check if currently clocked in
            const timeService = window.timeTrackingService;
            const isClockedIn = timeService?.activeTimers?.[member.id] != null;

            schedule.push({
                memberId: member.id,
                memberName: member.name,
                role: member.role,
                roleLabel: this.ROLES[member.role]?.label || member.role,
                roleIcon: this.ROLES[member.role]?.icon || '',
                isClockedIn: isClockedIn,
                timeEntries: timeEntries,
                totalHoursToday: timeEntries.reduce((sum, e) => sum + (e.durationHours || 0), 0),
                activeJobs: jobDetails
            });
        }

        return schedule;
    }

    /**
     * Get schedule for a week view (7 days).
     * @param {string} startDate - ISO date string for Monday
     * @returns {Object} { days: [...], members: [...], entries: { memberId: { date: [...] } } }
     */
    getWeekSchedule(startDate = null) {
        const start = startDate
            ? new Date(startDate)
            : this._getMonday(new Date());

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            days.push(d.toISOString().split('T')[0]);
        }

        const members = this.teamData.members.filter(m => m.status === 'active');
        const entries = {};

        for (const member of members) {
            entries[member.id] = {};
            for (const day of days) {
                entries[member.id][day] = this.getTeamSchedule(day)
                    .find(s => s.memberId === member.id) || null;
            }
        }

        return { days, members, entries };
    }

    /**
     * Get the Monday of the week for a given date.
     */
    _getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // ============================================
    // Event Subscription
    // ============================================

    /**
     * Subscribe to team management events.
     * @param {Function} callback - Called with (eventType, data)
     * @returns {Function} Unsubscribe function
     */
    onUpdate(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notify(eventType, data = null) {
        this.listeners.forEach(cb => {
            try {
                cb(eventType, data);
            } catch (e) {
                console.error('TeamManagement: Listener-Fehler:', e);
            }
        });
    }

    // ============================================
    // Utility / Search
    // ============================================

    /**
     * Search team members by name, email, or role.
     * @param {string} query
     * @returns {Array}
     */
    searchMembers(query) {
        if (!query) { return this.getTeamMembers(); }
        const q = query.toLowerCase();
        return this.teamData.members.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q) ||
            (this.ROLES[m.role]?.label || '').toLowerCase().includes(q)
        );
    }

    /**
     * Get count of members by role.
     * @returns {Object} { meister: N, geselle: N, azubi: N, buero: N }
     */
    getMemberCountByRole() {
        const counts = {};
        for (const key of Object.keys(this.ROLES)) {
            counts[key] = this.teamData.members.filter(m => m.role === key).length;
        }
        return counts;
    }

    /**
     * Check if any team members exist (vs. single-user mode).
     * @returns {boolean}
     */
    hasTeam() {
        return this.teamData.members.length > 0;
    }

    /**
     * Export team data for backup.
     * @returns {Object}
     */
    exportData() {
        return {
            teamData: this.teamData,
            invites: this.invites,
            assignments: this.assignments,
            activityLog: this.activityLog,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import team data from backup.
     * @param {Object} data
     */
    importData(data) {
        if (data.teamData) {
            this.teamData = data.teamData;
            this._saveTeamData();
        }
        if (data.invites) {
            this.invites = data.invites;
            this._saveInvites();
        }
        if (data.assignments) {
            this.assignments = data.assignments;
            this._saveAssignments();
        }
        if (data.activityLog) {
            this.activityLog = data.activityLog;
            this._saveActivity();
        }
    }
}

// Global instance
window.teamManagementService = new TeamManagementService();
