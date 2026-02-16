---
name: add-notification
description: Add an event-driven notification — in-app toast, email trigger, or browser push based on data events.
argument-hint: [event-name] [channel]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add Notification

**Arguments:** `$ARGUMENTS` — parse as `[event-name] [channel]`
Channels: `toast`, `email`, `push`, `all`
Examples: `invoice-overdue email`, `new-order toast`, `payment-received all`

### Steps

1. **Read** `js/services/store-service.js` to find where the event is triggered.
2. Implement the notification for the chosen channel.

### Channel Implementations

#### toast — In-app notification
```javascript
// Add to the action method that triggers the event
if (window.errorHandler) {
    window.errorHandler.success('Neue Anfrage eingegangen!');
}
// Or for warnings:
window.errorHandler.warning('Rechnung überfällig: RE-2024-0042');
```

#### email — Trigger email via Edge Function
```javascript
// After the event occurs in store-service:
if (window.freyaiSupabase) {
    window.freyaiSupabase.functions.invoke('send-email', {
        body: {
            to: recipient.email,
            template: '<template-name>',
            data: { /* template variables */ }
        }
    });
}
```

#### push — Browser push notification
```javascript
if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('<Title>', {
        body: '<message>',
        icon: '/icon-192.png',
        tag: '<event-name>'
    });
}
```

### Event Hook Pattern

Add notification triggers inside the relevant store-service action method. Example for invoice overdue:

```javascript
// In a check method or cron-triggered function:
const overdueInvoices = this.store.rechnungen.filter(
    r => r.status === 'offen' && new Date(r.faelligkeitsdatum) < new Date()
);
overdueInvoices.forEach(inv => {
    // Toast
    window.errorHandler?.warning(`Rechnung ${inv.id} ist überfällig!`);
    // Email
    this._triggerNotification('invoice-overdue', inv);
});
```
