const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api', routes);

// Servir le dossier admin (La protection est gérée par le client JS et apiAuth)
app.use('/admin', express.static(path.join(__dirname, '../web/admin')));

// Servir le dossier client (public)
app.use('/client', express.static(path.join(__dirname, '../web/client')));

// Redirections
app.get('/', (req, res) => {
    res.redirect('/admin/login.html');
});

module.exports = app;
