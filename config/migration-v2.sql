-- ============================================
-- HandwerkFlow - Migration V2
-- New tables for Rounds 4-6 features
-- (Purchase Orders, Stock Movements, Material Reservations, Suppliers, Communication Log)
-- ============================================

-- ============================================
-- purchase_orders - Purchase Order Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nummer TEXT NOT NULL,
    status TEXT DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'bestellt', 'teillieferung', 'geliefert', 'storniert')),
    lieferant_name TEXT,
    lieferant_email TEXT,
    lieferant_telefon TEXT,
    lieferant_ansprechpartner TEXT,
    positionen JSONB DEFAULT '[]',
    netto DECIMAL(12,2) DEFAULT 0,
    mwst DECIMAL(12,2) DEFAULT 0,
    brutto DECIMAL(12,2) DEFAULT 0,
    bestelldatum DATE,
    lieferdatum_erwartet DATE,
    lieferdatum_tatsaechlich DATE,
    auftrag_id TEXT,
    notizen TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase_orders" ON purchase_orders
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_user ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_auftrag ON purchase_orders(auftrag_id);

-- ============================================
-- stock_movements - Audit trail for every stock change
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    material_id TEXT NOT NULL,
    material_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('eingang', 'ausgang', 'reservierung', 'freigabe', 'korrektur', 'bestellung')),
    richtung TEXT NOT NULL CHECK (richtung IN ('ein', 'aus')),
    menge DECIMAL(12,2) NOT NULL,
    bestand_vorher DECIMAL(12,2),
    bestand_nachher DECIMAL(12,2),
    referenz_typ TEXT CHECK (referenz_typ IN ('auftrag', 'bestellung', 'manuell', 'reorder')),
    referenz_id TEXT,
    referenz_beschreibung TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stock_movements" ON stock_movements
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_referenz ON stock_movements(referenz_typ, referenz_id);

-- ============================================
-- material_reservations - Track reserved stock per Auftrag
-- ============================================
CREATE TABLE IF NOT EXISTS material_reservations (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    auftrag_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    menge DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'reserviert' CHECK (status IN ('reserviert', 'verbraucht', 'freigegeben')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    consumed_at TIMESTAMPTZ
);

ALTER TABLE material_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own material_reservations" ON material_reservations
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_material_reservations_user ON material_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_material_reservations_auftrag ON material_reservations(auftrag_id);
CREATE INDEX IF NOT EXISTS idx_material_reservations_material ON material_reservations(material_id);
CREATE INDEX IF NOT EXISTS idx_material_reservations_status ON material_reservations(status);

-- ============================================
-- suppliers - Supplier Registry
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    telefon TEXT,
    ansprechpartner TEXT,
    adresse TEXT,
    lieferzeit_tage INTEGER DEFAULT 5,
    notizen TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suppliers" ON suppliers
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);

-- ============================================
-- communication_log - Customer Message History
-- ============================================
CREATE TABLE IF NOT EXISTS communication_log (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    kunde_id TEXT,
    kunde_name TEXT,
    channel TEXT DEFAULT 'chat' CHECK (channel IN ('chat', 'sms', 'email')),
    direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
    message TEXT,
    template_id TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'read')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own communication_log" ON communication_log
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_communication_log_user ON communication_log(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_kunde ON communication_log(kunde_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_created ON communication_log(created_at);
CREATE INDEX IF NOT EXISTS idx_communication_log_channel ON communication_log(channel);

-- ============================================
-- Update purchase_orders with triggers
-- ============================================
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Update suppliers with triggers
-- ============================================
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
