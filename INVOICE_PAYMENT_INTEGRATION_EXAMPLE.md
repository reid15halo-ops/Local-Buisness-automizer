# Invoice Payment Integration - Implementation Example

This guide shows how to integrate Stripe payment links into your existing invoice (Rechnung) module.

## Overview

The integration involves:
1. **Payment Link Generation** - Create Stripe Checkout URLs
2. **UI Integration** - Add payment buttons to invoice lists
3. **Payment Handling** - Process payment callbacks
4. **Status Updates** - Mark invoices as paid

## Quick Start

### 1. Add Payment Buttons to Invoice List

In your invoice list template or module:

```javascript
// In your invoice rendering function
function renderInvoiceRow(invoice) {
    const paymentButtons = window.invoicePaymentIntegration?.createPaymentButtons(invoice) || '';

    return `
        <tr data-invoice-id="${invoice.id}">
            <td>${invoice.nummer}</td>
            <td>${invoice.kunde?.name}</td>
            <td>€${invoice.betrag?.toFixed(2)}</td>
            <td class="text-${invoice.status === 'bezahlt' ? 'success' : 'warning'}">
                ${invoice.status}
            </td>
            <td>${paymentButtons}</td>
        </tr>
    `;
}
```

### 2. Initialize Payment Handling

Add to your page initialization:

```javascript
// In your main initialization code
document.addEventListener('DOMContentLoaded', () => {
    // ... your existing code ...

    // Initialize payment handling
    if (window.invoicePaymentIntegration) {
        window.invoicePaymentIntegration.initPaymentHandling();
    }

    // Listen for payment success events
    window.addEventListener('invoice:payment:success', (e) => {
        console.log('Payment successful for invoice:', e.detail.invoiceId);
        // Refresh invoice list or update specific row
        location.reload(); // or more sophisticated update
    });
});
```

### 3. Add Required Scripts to HTML

In your `index.html`, include the payment integration module:

```html
<!-- Stripe Payment Integration -->
<script src="js/modules/invoice-payment-integration.js"></script>
```

Also ensure these are loaded:
```html
<script src="js/services/stripe-service.js"></script>
<script src="js/services/payment-service.js"></script>
```

## Implementation Examples

### Example 1: Basic Invoice List with Payment Buttons

```html
<!DOCTYPE html>
<html>
<head>
    <title>Rechnungen</title>
</head>
<body>
    <div class="container">
        <h1>Rechnungen</h1>
        <table id="invoices-table" class="table">
            <thead>
                <tr>
                    <th>Nummer</th>
                    <th>Kunde</th>
                    <th>Betrag</th>
                    <th>Status</th>
                    <th>Aktion</th>
                </tr>
            </thead>
            <tbody id="invoices-body">
                <!-- Rows inserted here -->
            </tbody>
        </table>
    </div>

    <script src="js/services/stripe-service.js"></script>
    <script src="js/services/payment-service.js"></script>
    <script src="js/modules/invoice-payment-integration.js"></script>

    <script>
        function renderInvoices() {
            const invoices = store.rechnungen || [];
            const tbody = document.getElementById('invoices-body');

            tbody.innerHTML = invoices.map(invoice => {
                const paymentButtons = window.invoicePaymentIntegration.createPaymentButtons(invoice);
                return `
                    <tr data-invoice-id="${invoice.id}">
                        <td>${invoice.nummer}</td>
                        <td>${invoice.kunde?.name || 'N/A'}</td>
                        <td>€${(invoice.betrag || 0).toFixed(2)}</td>
                        <td>
                            <span class="badge badge-${
                                invoice.status === 'bezahlt' ? 'success' : 'warning'
                            }">
                                ${invoice.status || 'offen'}
                            </span>
                        </td>
                        <td>${paymentButtons}</td>
                    </tr>
                `;
            }).join('');
        }

        // Initial render
        document.addEventListener('DOMContentLoaded', () => {
            renderInvoices();

            // Refresh on payment success
            window.addEventListener('invoice:payment:success', () => {
                renderInvoices();
            });
        });
    </script>
</body>
</html>
```

### Example 2: Invoice Detail View with Payment Options

```javascript
// In your invoice detail module (e.g., rechnungen.js)

class InvoiceDetailModule {
    async showInvoiceDetail(invoiceId) {
        const invoice = store.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) return;

        const detailHtml = `
            <div class="invoice-detail">
                <h2>Rechnung ${invoice.nummer}</h2>

                <div class="invoice-info">
                    <p><strong>Kunde:</strong> ${invoice.kunde?.name}</p>
                    <p><strong>Betrag:</strong> €${invoice.betrag.toFixed(2)}</p>
                    <p><strong>Status:</strong>
                        <span class="badge badge-${
                            invoice.status === 'bezahlt' ? 'success' : 'warning'
                        }">
                            ${invoice.status}
                        </span>
                    </p>
                </div>

                ${invoice.status !== 'bezahlt' ? `
                    <div class="payment-section">
                        <h3>Zahlung</h3>
                        <p>Diese Rechnung steht noch aus. Sende einen Zahlungslink an deinen Kunden:</p>
                        <div class="button-group">
                            ${window.stripeService?.isConfigured() ? `
                                <button class="btn btn-primary"
                                    onclick="window.invoicePaymentIntegration.handleOpenPayment('${invoiceId}')">
                                    💳 Zahlungsseite öffnen
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary"
                                onclick="window.invoicePaymentIntegration.handleSendPaymentLink('${invoiceId}')">
                                🔗 Zahlungslink versenden
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="payment-status paid">
                        <p>✓ Diese Rechnung wurde bezahlt am ${new Date(invoice.bezahltAm).toLocaleDateString('de-DE')}</p>
                    </div>
                `}
            </div>
        `;

        document.getElementById('detail-container').innerHTML = detailHtml;
    }
}
```

### Example 3: Manual Payment Link Creation

```javascript
// For manual testing or advanced use cases

async function createPaymentLinkManually() {
    const invoiceId = 'RE-2024-001';
    const invoice = store.rechnungen.find(r => r.id === invoiceId);

    if (!invoice) {
        console.error('Invoice not found');
        return;
    }

    try {
        // Option 1: Use full Stripe integration
        const result = await window.stripeService.createPaymentLink(invoice);
        if (result.success) {
            console.log('Stripe checkout URL:', result.url);
            // Share with customer
        }
    } catch (err) {
        console.error('Stripe failed:', err);

        // Option 2: Fallback to payment service
        const paymentLink = await window.paymentService.createPaymentLink({
            type: 'invoice',
            referenceId: invoice.id,
            referenceType: 'rechnung',
            amount: invoice.betrag,
            description: `Rechnung ${invoice.nummer}`,
            customerEmail: invoice.kunde.email,
            customerName: invoice.kunde.name,
            invoiceObject: invoice
        });

        console.log('Payment link:', paymentLink.url);
    }
}
```

### Example 4: Dashboard with Payment Statistics

```javascript
// Add payment statistics to your dashboard

async function showPaymentDashboard() {
    const stats = await window.invoicePaymentIntegration.getPaymentStats();

    const dashboardHtml = `
        <div class="dashboard-cards">
            <div class="card">
                <h3>Gesamtrechnungsbetrag</h3>
                <p class="big-number">${window.invoicePaymentIntegration.formatCurrency(stats.totalInvoiceAmount)}</p>
            </div>

            <div class="card">
                <h3>Bezahlte Rechnungen</h3>
                <p class="big-number">${stats.paidInvoices}</p>
                <small>${(stats.paymentRate * 100).toFixed(1)}% Zahlungsquote</small>
            </div>

            <div class="card">
                <h3>Offene Rechnungen</h3>
                <p class="big-number">${stats.pendingInvoices}</p>
                <small>Ausstehender Betrag: ${window.invoicePaymentIntegration.formatCurrency(stats.pendingAmount)}</small>
            </div>

            <div class="card">
                <h3>Diesen Monat</h3>
                <p class="big-number">${stats.monthlyPayments}</p>
                <small>${window.invoicePaymentIntegration.formatCurrency(stats.monthlyAmount)}</small>
            </div>
        </div>
    `;

    document.getElementById('dashboard').innerHTML = dashboardHtml;
}
```

## Event Handling

### Listen for Payment Events

```javascript
// Payment successful
window.addEventListener('invoice:payment:success', (e) => {
    console.log('Invoice paid:', e.detail.invoiceId);
    // Update UI, refresh list, etc.
});

// Payment cancelled
window.addEventListener('invoice:payment:cancelled', (e) => {
    console.log('Payment cancelled for:', e.detail.invoiceId);
    // Show retry option
});

// Payment link created
window.addEventListener('invoice:payment-link:created', (e) => {
    console.log('Payment link created:', e.detail.paymentLink.url);
    // Log, track, notify user, etc.
});
```

## Styling

Add CSS for payment buttons and status indicators:

```css
/* Payment buttons */
.payment-actions {
    display: flex;
    gap: 8px;
}

.btn-small {
    padding: 4px 12px;
    font-size: 0.875rem;
    border-radius: 4px;
    border: none;
    cursor: pointer;
}

.btn-primary {
    background-color: #007bff;
    color: white;
}

.btn-primary:hover {
    background-color: #0056b3;
}

.btn-secondary {
    background-color: #6c757d;
    color: white;
}

.btn-secondary:hover {
    background-color: #545b62;
}

/* Payment status */
.payment-status.paid {
    color: #28a745;
    font-weight: bold;
}

.payment-status.pending {
    color: #ffc107;
}

.badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
}

.badge-success {
    background-color: #d4edda;
    color: #155724;
}

.badge-warning {
    background-color: #fff3cd;
    color: #856404;
}

/* Invoice table */
#invoices-table tr.paid {
    opacity: 0.7;
}

#invoices-table tr.paid td {
    text-decoration: line-through;
    color: #6c757d;
}
```

## Testing Checklist

- [ ] Invoice list displays with payment buttons
- [ ] Click "💳 Zahlen" opens Stripe Checkout
- [ ] Click "🔗 Link" copies payment link to clipboard
- [ ] Complete test payment with card `4242 4242 4242 4242`
- [ ] Invoice status updates to "bezahlt" after payment
- [ ] Payment success event fires
- [ ] Webhook logs show transaction
- [ ] Multiple payment methods work (card, SEPA, etc.)

## Troubleshooting

### Buttons Not Appearing

```javascript
// Check if module is loaded
console.log(window.invoicePaymentIntegration);

// Check if Stripe is configured
console.log(window.stripeService.isConfigured());

// Check localStorage
console.log(localStorage.getItem('stripe_publishable_key'));
```

### Payment Link Not Creating

```javascript
// Check if services are initialized
console.log(window.stripeService);
console.log(window.paymentService);
console.log(window.supabaseConfig?.get());

// Check invoice object has required fields
const invoice = store.rechnungen[0];
console.log({
    id: invoice.id,
    betrag: invoice.betrag,
    email: invoice.kunde?.email
});
```

## Next Steps

1. **Email Integration**: Auto-send payment links via email
2. **Payment Reminders**: Send reminders for unpaid invoices
3. **Dashboard**: Add payment analytics
4. **Export**: Include payment links in PDF invoices
5. **Automation**: Auto-create payment links on invoice creation

## Support

For issues, check:
1. Browser console for errors
2. Supabase Edge Function logs
3. Stripe Dashboard for transaction details
4. STRIPE_INTEGRATION.md for troubleshooting
