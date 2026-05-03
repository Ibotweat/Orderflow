const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataDir = process.env.ORDERFLOW_DATA_DIR || path.join(__dirname, '../data');
const dataPath = path.join(dataDir, 'orders.json');
const menuPath = path.join(dataDir, 'menu.json');
const settingsPath = path.join(dataDir, 'settings.json');
const sessionsPath = path.join(dataDir, 'sessions.json');

// Helper functions for reading/writing JSON
const readJson = (file) => {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
        return file === settingsPath || file === sessionsPath ? {} : [];
    } catch (e) { return file === settingsPath || file === sessionsPath ? {} : []; }
};
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

// ---- AUTHENTICATION ----
router.post('/auth/login', (req, res) => {
    const { code } = req.body;
    const settings = readJson(settingsPath);
    const adminCode = settings.adminCode || "1234";

    if (code === adminCode) {
        const sessionId = uuidv4();
        const sessions = readJson(sessionsPath);
        sessions[sessionId] = { timestamp: Date.now() };
        writeJson(sessionsPath, sessions);
        
        res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); // Keep cookie for backward compatibility if needed
        res.json({ success: true, sessionId });
    } else {
        res.status(401).json({ success: false, message: "Code incorrect." });
    }
});

router.post('/auth/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        const sessions = readJson(sessionsPath);
        delete sessions[sessionId];
        writeJson(sessionsPath, sessions);
        res.clearCookie('sessionId');
    }
    res.json({ success: true });
});

router.post('/auth/logout-all', (req, res) => {
    writeJson(sessionsPath, {});
    res.json({ success: true, message: "Tous les appareils ont été déconnectés." });
});

const extractToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
    return req.cookies.sessionId;
};

router.get('/auth/check', (req, res) => {
    const sessionId = extractToken(req);
    if (!sessionId) return res.status(401).json({ success: false });
    
    const sessions = readJson(sessionsPath);
    if (sessions[sessionId]) return res.json({ success: true });
    
    return res.status(401).json({ success: false });
});

// Middleware pour protéger les routes API (sauf login et menu)
const apiAuth = (req, res, next) => {
    const sessionId = extractToken(req);
    if (!sessionId) return res.status(401).json({ success: false, message: "Non autorisé" });
    
    const sessions = readJson(sessionsPath);
    if (sessions[sessionId]) {
        next();
    } else {
        res.status(401).json({ success: false, message: "Session expirée" });
    }
};

// ---- MENU ----
router.get('/menu', (req, res) => {
    res.json(readJson(menuPath));
});

router.post('/menu', (req, res) => {
    const newMenu = req.body;
    writeJson(menuPath, newMenu);
    res.json({ success: true });
});

// ---- PARAMÈTRES ----
router.get('/settings', (req, res) => {
    res.json(readJson(settingsPath));
});

router.post('/settings', (req, res) => {
    const newSettings = req.body;
    const settings = readJson(settingsPath);
    writeJson(settingsPath, { ...settings, ...newSettings });
    res.json({ success: true });
});

// ---- COMMANDES ----
router.get('/orders', apiAuth, (req, res) => {
    const orders = readJson(dataPath);
    orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(orders);
});

router.post('/orders', apiAuth, (req, res) => {
    const { table, items, total } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: "La commande est vide." });
    
    const newOrder = {
        id: Date.now().toString(),
        table: table || "Emporter",
        items: items,
        total: total,
        status: "En attente",
        timestamp: new Date().toISOString()
    };

    const orders = readJson(dataPath);
    orders.push(newOrder);
    writeJson(dataPath, orders);
    res.status(201).json({ success: true, order: newOrder });
});

router.put('/orders/:id/status', apiAuth, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const orders = readJson(dataPath);
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return res.status(404).json({ success: false, message: "Commande non trouvée." });
    
    orders[orderIndex].status = status;
    writeJson(dataPath, orders);
    res.json({ success: true, order: orders[orderIndex] });
});

router.delete('/orders/:id', apiAuth, (req, res) => {
    const { id } = req.params;
    const orders = readJson(dataPath);
    const newOrders = orders.filter(o => o.id !== id);
    if (orders.length === newOrders.length) return res.status(404).json({ success: false, message: "Commande non trouvée." });
    
    writeJson(dataPath, newOrders);
    res.json({ success: true, message: "Commande supprimée." });
});

module.exports = router;
