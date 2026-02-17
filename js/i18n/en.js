// English Translations
window.i18nEN = {
    // ========== Navigation & Main Menu ==========
    nav: {
        dashboard: 'Dashboard',
        inquiries: 'Inquiries',
        quotes: 'Quotes',
        orders: 'Orders',
        invoices: 'Invoices',
        dunning: 'Dunning',
        customers: 'Customers',
        calendar: 'Calendar',
        tasks: 'Tasks',
        documents: 'Documents',
        timetracking: 'Time Tracking',
        settings: 'Settings',
        emails: 'Emails',
        emailAutomation: 'Email Automation',
        chatbot: 'AI Chatbot',
        material: 'Material',
        reports: 'Reports',
        buchhaltung: 'Accounting',
        workflows: 'Workflows',
        adminPanel: 'Administration'
    },

    // ========== Common Actions ==========
    action: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        search: 'Search',
        filter: 'Filter',
        export: 'Export',
        import: 'Import',
        print: 'Print',
        send: 'Send',
        confirm: 'Confirm',
        create: 'Create',
        update: 'Update',
        remove: 'Remove',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        download: 'Download',
        upload: 'Upload',
        copy: 'Copy',
        paste: 'Paste',
        more: 'More',
        logout: 'Logout',
        reset: 'Reset',
        clear: 'Clear',
        apply: 'Apply',
        generate: 'Generate'
    },

    // ========== Status Labels ==========
    status: {
        new: 'New',
        draft: 'Draft',
        open: 'Open',
        pending: 'Pending',
        completed: 'Completed',
        paid: 'Paid',
        overdue: 'Overdue',
        cancelled: 'Cancelled',
        active: 'Active',
        inactive: 'Inactive',
        archived: 'Archived',
        sent: 'Sent',
        accepted: 'Accepted',
        rejected: 'Rejected',
        inProgress: 'In Progress'
    },

    // ========== Time Expressions ==========
    time: {
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        thisYear: 'This Year',
        lastWeek: 'Last Week',
        lastMonth: 'Last Month',
        lastYear: 'Last Year',
        overdue: 'Overdue'
    },

    // ========== Messages & Notifications ==========
    msg: {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Information',
        loading: 'Loading...',
        noData: 'No data available',
        confirmDelete: 'Are you sure you want to delete?',
        saved: 'Saved',
        deleted: 'Deleted',
        created: 'Created',
        updated: 'Updated',
        imported: 'Imported',
        exported: 'Exported',
        sending: 'Sending...',
        sent: 'Sent',
        copied: 'Copied'
    },

    // ========== Dashboard ==========
    dashboard: {
        title: 'Dashboard',
        subtitle: 'Overview of all processes',
        openInquiries: 'Open Inquiries',
        pendingQuotes: 'Pending Quotes',
        activeOrders: 'Active Orders',
        openInvoices: 'Open Invoices',
        workflowOverview: 'Workflow Overview',
        recentActivities: 'Recent Activities',
        noActivities: 'No activities yet. Create a new inquiry!',
        statistics: 'Statistics',
        quickActions: 'Quick Actions'
    },

    // ========== Inquiries ==========
    inquiry: {
        title: 'Inquiries',
        singular: 'Inquiry',
        plural: 'Inquiries',
        subtitle: 'Incoming customer inquiries',
        new: 'New Inquiry',
        create: 'Create Inquiry',
        edit: 'Edit Inquiry',
        delete: 'Delete Inquiry',
        noInquiries: 'No open inquiries',
        customerName: 'Customer Name',
        email: 'Email',
        phone: 'Phone',
        serviceType: 'Service Type',
        description: 'Description',
        budget: 'Budget',
        deadline: 'Deadline',
        status: 'Status',
        createdAt: 'Created',
        createdFrom: 'Inquiry from {{customer}}'
    },

    // ========== Quotes ==========
    quote: {
        title: 'Quotes',
        singular: 'Quote',
        plural: 'Quotes',
        subtitle: 'Created Quotes',
        new: 'New Quote',
        create: 'Create Quote',
        edit: 'Edit Quote',
        delete: 'Delete Quote',
        noQuotes: 'No quotes available',
        customer: 'Customer',
        date: 'Quote Date',
        items: 'Items',
        amount: 'Amount',
        netAmount: 'Net',
        tax: 'Tax',
        grossAmount: 'Total',
        validity: 'Valid until',
        status: 'Status',
        description: 'Description',
        accepted: 'Quote accepted',
        rejected: 'Quote rejected'
    },

    // ========== Orders ==========
    order: {
        title: 'Orders',
        singular: 'Order',
        plural: 'Orders',
        new: 'New Order',
        create: 'Create Order',
        edit: 'Edit Order',
        delete: 'Delete Order',
        noOrders: 'No orders',
        customer: 'Customer',
        date: 'Order Date',
        startDate: 'Start Date',
        endDate: 'End Date',
        items: 'Items',
        amount: 'Amount',
        status: 'Status',
        description: 'Description',
        progress: 'Progress',
        completed: 'Order completed',
        workHours: 'Work Hours',
        materialCosts: 'Material Costs'
    },

    // ========== Invoices ==========
    invoice: {
        title: 'Invoices',
        singular: 'Invoice',
        plural: 'Invoices',
        subtitle: 'Generated Invoices (GoBD compliant)',
        new: 'New Invoice',
        create: 'Create Invoice',
        edit: 'Edit Invoice',
        delete: 'Delete Invoice',
        noInvoices: 'No invoices available',
        number: 'Invoice Number',
        date: 'Invoice Date',
        customer: 'Customer',
        items: 'Items',
        amount: 'Amount',
        netAmount: 'Net',
        tax: 'Tax',
        grossAmount: 'Total',
        dueDate: 'Due Date',
        paid: 'Paid',
        pending: 'Pending',
        overdue: 'Overdue',
        status: 'Status',
        download: 'Download PDF',
        print: 'Print',
        send: 'Send'
    },

    // ========== Dunning ==========
    dunning: {
        title: 'Dunning',
        subtitle: 'Overdue invoices and escalation',
        openCases: 'Open Cases',
        noCases: 'No overdue invoices 🎉',
        overdueInvoices: 'Overdue Invoices',
        level1: 'Reminder 1st Level',
        level2: 'Reminder 2nd Level',
        level3: 'Reminder 3rd Level',
        collection: 'Collection Case',
        daysOverdue: '{{days}} days overdue',
        reminder: 'Create Reminder',
        createReminder: 'Create Reminder'
    },

    // ========== Material Management ==========
    material: {
        title: 'Material',
        subtitle: 'Material Management and Inventory',
        name: 'Material Name',
        sku: 'SKU',
        category: 'Category',
        stock: 'Stock',
        unit: 'Unit',
        price: 'Price',
        costPrice: 'Cost Price',
        sellingPrice: 'Selling Price',
        minStock: 'Minimum Stock',
        lowStock: 'Low Stock',
        add: 'Add Material',
        import: 'Import from Excel',
        loadDemo: 'Load Demo Data',
        noMaterials: 'No materials available',
        importedCount: '{{count}} items imported',
        stockValue: 'Stock Value',
        lowStockItems: 'Low stock items'
    },

    // ========== Customers ==========
    customer: {
        title: 'Customers',
        singular: 'Customer',
        plural: 'Customers',
        name: 'Customer Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        postalCode: 'Postal Code',
        country: 'Country',
        taxId: 'Tax ID',
        add: 'Add Customer',
        edit: 'Edit Customer',
        delete: 'Delete Customer',
        noCustomers: 'No customers available'
    },

    // ========== Tasks ==========
    task: {
        title: 'Tasks',
        singular: 'Task',
        plural: 'Tasks',
        new: 'New Task',
        create: 'Create Task',
        edit: 'Edit Task',
        delete: 'Delete Task',
        description: 'Description',
        dueDate: 'Due Date',
        priority: 'Priority',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        assignee: 'Assigned to',
        status: 'Status',
        completed: 'Completed',
        pending: 'Pending',
        overdue: 'Overdue',
        today: 'Due Today',
        noTasks: 'No tasks available'
    },

    // ========== Time Tracking ==========
    timeTracking: {
        title: 'Time Tracking',
        subtitle: 'Time Budget',
        startTime: 'Start Time',
        endTime: 'End Time',
        duration: 'Duration',
        hours: 'Hours',
        description: 'Description',
        project: 'Project',
        add: 'Add Time Entry',
        noEntries: 'No time entries available',
        totalHours: 'Total Hours'
    },

    // ========== Calendar ==========
    calendar: {
        title: 'Calendar',
        nextWeek: 'Next →',
        previousWeek: '← Previous'
    },

    // ========== Documents ==========
    document: {
        title: 'Documents',
        upload: 'Upload Document',
        delete: 'Delete Document',
        download: 'Download',
        noDocuments: 'No documents available'
    },

    // ========== Email & Automation ==========
    email: {
        title: 'Emails',
        automation: 'Email Automation',
        templateSubject: 'Subject Line',
        templateBody: 'Message Text',
        send: 'Send Email',
        sendConfirmation: 'Send email?',
        manualCheck: 'Manually review quotes before sending',
        recommended: 'Recommended: Quotes will be created but only sent after approval',
        inquiriesReceived: 'Inquiries Received',
        quotesGenerated: 'Quotes Generated',
        averageProcessingTime: 'Avg Processing Time',
        automationSettings: 'Automation Settings',
        configuredAutomations: 'Overview of configured automations'
    },

    // ========== Chatbot ==========
    chatbot: {
        title: 'AI Chatbot',
        message: 'Message',
        send: 'Send',
        noMessages: 'No messages yet'
    },

    // ========== Accounting ==========
    accounting: {
        title: 'Accounting',
        subtitle: 'EÜR & Tax Overview',
        entries: 'Entries',
        noEntries: 'No entries yet. Invoices are recorded automatically.',
        income: 'Income',
        expenses: 'Expenses',
        date: 'Date',
        description: 'Description',
        category: 'Category',
        amount: 'Amount',
        type: 'Type',
        year: 'Year',
        yearlyReset: 'Yearly Reset'
    },

    // ========== Reports ==========
    report: {
        title: 'Reports',
        create: 'Create Report',
        type: 'Report Type',
        invoices: 'Invoices',
        contracts: 'Contracts',
        quotes: 'Quotes',
        selectType: 'Select a report type and click "Create Report"',
        noReports: 'No reports available'
    },

    // ========== Settings ==========
    settings: {
        title: 'Settings',
        general: 'General',
        api: 'API & Integrations',
        automation: 'Automation',
        templates: 'Templates',
        numbering: 'Numbering',
        language: 'Language',
        theme: 'Theme',
        geminiApiKey: 'Gemini API Key',
        geminiDescription: 'For real AI text generation',
        hourlyRate: 'Hourly Rate',
        hourlyRateDescription: 'Standard hourly rate for work',
        webhookUrl: 'Webhook URL',
        webhookDescription: 'Automatic email sending via Proton Mail Bridge (VPS Relay)',
        saveSettings: 'Save Settings',
        configured: '✅ Configured',
        notConfigured: '❌ Not Configured',
        resetTutorial: 'Reset Tutorial',
        clearAllData: 'Clear All Data',
        exportData: 'Export Data',
        exported: 'Data exported!',
        invoicePrefix: 'Prefix',
        nextNumber: 'Next Number (Preview)',
        autoIncrementNumbers: 'Auto increment numbers',
        godbCompliant: '⚠️ Changes must be GoBD compliant!',
        selectTemplate: 'Template selection for PDF generation'
    },

    // ========== Forms & Input ==========
    form: {
        required: 'Required',
        optional: 'Optional',
        placeholder: 'Enter here...',
        selectOption: 'Select an option',
        dateFormat: 'MM/DD/YYYY',
        noResults: 'No results',
        search: 'Search...'
    },

    // ========== Empty States ==========
    empty: {
        noData: 'No data available',
        noResults: 'No results found',
        tryAgain: 'Try again',
        noInquiries: 'No open inquiries',
        noQuotes: 'No quotes available',
        noOrders: 'No orders',
        noInvoices: 'No invoices available',
        loadDemo: 'Load Demo Data'
    },

    // ========== Errors ==========
    error: {
        title: 'Error',
        generic: 'An error occurred',
        notFound: 'Not found',
        invalidInput: 'Invalid input',
        required: 'Required',
        requiredField: 'This field is required',
        invalidEmail: 'Invalid email address',
        invalidPhone: 'Invalid phone number',
        invalidAmount: 'Invalid amount',
        importError: 'Import error: {{message}}',
        excelImportError: 'Excel import error'
    },

    // ========== Confirmations ==========
    confirm: {
        delete: 'Are you sure you want to delete?',
        deleteItem: 'Really delete {{item}}?',
        clearData: 'Delete all data? This cannot be undone.',
        proceed: 'Proceed',
        cancel: 'Cancel'
    },

    // ========== Demo & Tutorial ==========
    demo: {
        workflow: 'Demo Workflow',
        start: 'Demo workflow starting...',
        completed: 'Demo workflow completed!',
        materials: 'Demo materials loaded',
        importDemo: '🎲 Load Demo Data',
        excelImport: '📊 Import Excel'
    },

    // ========== Validation Messages ==========
    validate: {
        success: 'Validation successful',
        error: 'Validation error',
        emailInvalid: 'Invalid email address',
        phoneInvalid: 'Invalid phone number',
        amountInvalid: 'Invalid amount',
        required: 'Required',
        minLength: 'Minimum {{min}} characters required',
        maxLength: 'Maximum {{max}} characters allowed'
    },

    // ========== Modal Titles ==========
    modal: {
        confirmDelete: 'Confirm',
        newInquiry: 'New Inquiry',
        newQuote: 'New Quote',
        newOrder: 'New Order',
        newInvoice: 'New Invoice',
        editInquiry: 'Edit Inquiry',
        editQuote: 'Edit Quote',
        editOrder: 'Edit Order',
        editInvoice: 'Edit Invoice',
        settings: 'Settings',
        help: 'Help'
    },

    // ========== Feature-Specific Text ==========
    feature: {
        inventory: 'Material Management',
        invoicing: 'Invoice Generation',
        timeTracking: 'Time Tracking',
        scheduling: 'Scheduling',
        automation: 'Automation',
        reporting: 'Reporting',
        pdfGeneration: 'PDF Generation',
        dataExport: 'Data Export'
    },

    // ========== Status Change Messages ==========
    statusChange: {
        changeStatus: 'Change Status',
        confirmStatusChange: 'Change status to "{{newStatus}}"?',
        statusChanged: 'Status changed to {{status}}'
    },

    // ========== Offline Mode ==========
    offline: {
        banner: '🛜 Offline Mode — Data saved locally only',
        description: 'You are working in offline mode. Changes are saved locally.'
    },

    // ========== Admin Panel ==========
    adminPanel: {
        title: 'Administration',
        subtitle: 'System Configuration — Admin & Developer',
        loginTitle: 'Admin Area',
        loginSubtitle: 'Please log in to access the administration panel.',
        loginHint: 'This area contains the core structure of the application. Changes may affect the software.',
        username: 'Username',
        password: 'Password',
        login: 'Login',
        logout: 'Logout',
        forgotCredentials: 'Forgot credentials?',
        forgotHint: 'Contact your system administrator or developer to reset your credentials.',
        warningTitle: 'Warning — System Configuration',
        warningText: 'This is the core structure of the application. Changes in this area may impair the software or cause features to stop working correctly.',
        roleAdmin: 'Administrator',
        roleDeveloper: 'Developer',
        loggedInAs: 'Logged in as',
        tabBusiness: 'Company Data',
        tabFinancial: 'Finance & Taxes',
        tabCredentials: 'Credentials',
        tabTechnical: 'Technical Configuration',
        tabDatabase: 'Database & APIs',
        companyData: 'Company Data',
        companyDataDesc: 'Basic information about your company.',
        taxFinance: 'Tax & Finance',
        taxFinanceDesc: 'Tax and payment settings for invoices and accounting.',
        bankDetails: 'Bank Details',
        bankDetailsDesc: 'Your bank details for invoices and payment information.',
        credentialsAdmin: 'Change Admin Credentials',
        credentialsDev: 'Change Developer Credentials',
        devWarning: 'This area contains technical configurations that affect the core structure of the app.',
        dbWarning: 'Incorrect Supabase configurations can lead to data loss.',
        saved: 'Saved!',
        saveError: 'Error saving',
        sessionExpired: 'Session expired. Please log in again.',
        wrongCredentials: 'Incorrect username or password.'
    }
};
