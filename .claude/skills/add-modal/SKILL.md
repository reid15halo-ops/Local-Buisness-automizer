---
name: add-modal
description: Add a modal dialog with form to index.html — includes HTML structure, form validation, submit handler, and store integration.
argument-hint: [modal-name] [entity-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add a Modal Dialog

**Arguments:** `$ARGUMENTS` — parse as `[modal-name] [entity-type]`

### Steps

1. **Read** `index.html` — find existing modals for the pattern.
2. **Read** `js/app.js` — find existing form handlers (e.g., `initAnfrageForm`).
3. **Read** `supabase_schema.sql` for the entity's column definitions.

### HTML Template (add before `</body>` in `index.html`)

```html
<div class="modal-overlay" id="modal-<name>" style="display: none;">
    <div class="modal">
        <div class="modal-header">
            <h3><Title></h3>
            <button class="modal-close" onclick="closeModal('modal-<name>')">&times;</button>
        </div>
        <form id="form-<name>" class="modal-form">
            <div class="form-group">
                <label for="<field>"><Label></label>
                <input type="text" id="<field>" required>
            </div>
            <!-- More fields matching the entity schema -->
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('modal-<name>')">Abbrechen</button>
                <button type="submit" class="btn btn-primary">Speichern</button>
            </div>
        </form>
    </div>
</div>
```

### JS Handler (add to `js/app.js`)

```javascript
function init<Name>Form() {
    const form = document.getElementById('form-<name>');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const item = {
            id: generateId('<PREFIX>'),
            // ... read form fields
            createdAt: new Date().toISOString()
        };
        store.<entities>.push(item);
        saveStore();
        addActivity('<icon>', `<Activity text>`);
        form.reset();
        closeModal('modal-<name>');
    });
}
```

### Conventions
- German labels and button text
- Use `required` attribute for mandatory fields
- Call `closeModal()` / `openModal()` (existing helpers)
- Always `form.reset()` after successful submit
- Always add an activity log entry
