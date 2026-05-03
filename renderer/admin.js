const { ipcRenderer, shell } = require('electron');
const os = require('os');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// --- SYSTÈME DE MISE À JOUR AUTO ---
ipcRenderer.on('update-downloading', (event, data) => {
    const overlay = document.getElementById('updateOverlay');
    if(overlay) overlay.classList.remove('hidden');
});

ipcRenderer.on('update-progress', (event, data) => {
    const progressBar = document.getElementById('updateProgressBar');
    const progressText = document.getElementById('updateProgressText');
    const timeRemaining = document.getElementById('updateTimeRemaining');
    
    if(progressBar) progressBar.style.width = data.percent + '%';
    if(progressText) progressText.firstElementChild.innerText = data.percent + '%';
    
    if(timeRemaining) {
        if (data.secondsRemaining > 60) {
            let mins = Math.floor(data.secondsRemaining / 60);
            timeRemaining.innerText = `~${mins} min restantes`;
        } else if (data.secondsRemaining > 0 && isFinite(data.secondsRemaining)) {
            timeRemaining.innerText = `~${data.secondsRemaining} sec restantes`;
        } else {
            timeRemaining.innerText = `Presque terminé...`;
        }
    }
});

ipcRenderer.on('update-ready', () => {
    const overlay = document.getElementById('updateOverlay');
    if(overlay) {
        overlay.innerHTML = `<h3 style="color: var(--status-pret); margin: 0;">Mise à jour prête ! Redémarrage...</h3>`;
    }
});
// -----------------------------------

// Chemins des données
const dataDir = process.env.ORDERFLOW_DATA_DIR || path.join(__dirname, '../data');
const menuPath = path.join(dataDir, 'menu.json');
const settingsPath = path.join(dataDir, 'settings.json');
const categoriesPath = path.join(dataDir, 'categories.json');

// Obtenir l'IP locale
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Ignorer l'IPv6 et l'interface de boucle locale
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// === Navigation entre onglets ===
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        tabPanes.forEach(tab => tab.classList.add('hidden'));
        
        item.classList.add('active');
        document.getElementById(`tab-${item.dataset.tab}`).classList.remove('hidden');
    });
});

// === Onglet Serveur ===
const portInput = document.getElementById('portInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusAlert = document.getElementById('statusAlert');
const qrPanel = document.getElementById('qrPanel');
const sidebarStatus = document.getElementById('sidebarStatus');

let currentPort = 3000;
let localIp = getLocalIp();

function showStatus(message, isSuccess) {
    statusAlert.textContent = message;
    statusAlert.className = `alert ${isSuccess ? 'success' : 'error'}`;
}

startBtn.addEventListener('click', () => {
    const port = parseInt(portInput.value, 10);
    if (!port || port < 1024 || port > 65535) {
        showStatus('Veuillez entrer un port valide (1024 - 65535).', false);
        return;
    }
    startBtn.disabled = true;
    startBtn.textContent = "Démarrage...";
    ipcRenderer.send('start-server', port);
});

stopBtn.addEventListener('click', () => {
    stopBtn.disabled = true;
    stopBtn.textContent = "Arrêt...";
    ipcRenderer.send('stop-server');
});

// Vérifier l'état au chargement (si on recharge la page)
ipcRenderer.invoke('get-server-status').then((status) => {
    if (status.running) {
        // Simuler la réponse 'server-status'
        ipcRenderer.emit('server-status', null, { success: true, port: status.port });
    }
});

// === QR Code et Liens Rapides ===
function generateQrCode() {
    let currentAdminCode = "1234";
    try {
        if(fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if(settings.adminCode) currentAdminCode = settings.adminCode;
        }
    } catch(e){}

    const serverUrl = `http://${localIp}:${currentPort}/admin/login.html?code=${currentAdminCode}`;
    
    document.getElementById('recapIp').textContent = localIp;
    document.getElementById('recapPort').textContent = currentPort;
    
    qrcode.toCanvas(document.getElementById('qrcode'), serverUrl, {
        width: 200, margin: 1, color: { dark: '#0f172a', light: '#f8fafc' }
    });

    const installUrl = `http://${localIp}:${currentPort}/admin/install.html`;
    qrcode.toCanvas(document.getElementById('qrInstall'), installUrl, {
        width: 200, margin: 1, color: { dark: '#0f172a', light: '#f8fafc' }
    });
}

// Bouton flouter / afficher QR
const toggleQrBtn = document.getElementById('toggleQrBtn');
const qrCanvas = document.getElementById('qrcode');
toggleQrBtn.addEventListener('click', () => {
    if(qrCanvas.style.filter === 'blur(8px)') {
        qrCanvas.style.filter = 'none';
        toggleQrBtn.innerHTML = '🙈 Masquer le QR Code';
    } else {
        qrCanvas.style.filter = 'blur(8px)';
        toggleQrBtn.innerHTML = '👁️ Afficher le QR Code';
    }
});

ipcRenderer.on('server-status', (event, response) => {
    if (response.success) {
        currentPort = response.port;
        showStatus(`Serveur en ligne sur http://${localIp}:${currentPort}`, true);
        
        startBtn.classList.add('hidden');
        startBtn.disabled = false;
        startBtn.textContent = "Démarrer le Serveur";
        
        stopBtn.classList.remove('hidden');
        stopBtn.disabled = false;
        stopBtn.textContent = "Arrêter le Serveur";
        portInput.disabled = true;
        
        sidebarStatus.querySelector('.status-dot').className = 'status-dot online';
        sidebarStatus.querySelector('span').textContent = 'En ligne';

        generateQrCode();
        qrPanel.classList.remove('hidden');
    } else {
        showStatus(response.message, false);
        startBtn.disabled = false;
        startBtn.textContent = "Démarrer le Serveur";
    }
});

ipcRenderer.on('server-stopped', (event, response) => {
    showStatus(response.message, true);
    stopBtn.classList.add('hidden');
    stopBtn.disabled = false;
    stopBtn.textContent = "Arrêter le Serveur";
    
    startBtn.classList.remove('hidden');
    portInput.disabled = false;
    qrPanel.classList.add('hidden');

    sidebarStatus.querySelector('.status-dot').className = 'status-dot offline';
    sidebarStatus.querySelector('span').textContent = 'Hors ligne';
});

document.getElementById('openWebBtn').addEventListener('click', () => {
    let code = "1234";
    try { if(fs.existsSync(settingsPath)) code = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).adminCode || code; } catch(e){}
    shell.openExternal(`http://localhost:${currentPort}/admin/login.html?code=${code}`);
});

document.getElementById('openDesktopBtn').addEventListener('click', () => {
    // Force l'affichage du terminal en local temporairement
    launchTerminalMode(`http://localhost:${currentPort}/admin/login.html`);
});

// Modal d'installation
const installModal = document.getElementById('installModal');
document.getElementById('shareInstallBtn').addEventListener('click', () => {
    installModal.classList.remove('hidden');
});
document.querySelector('.close-modal').addEventListener('click', () => {
    installModal.classList.add('hidden');
});
window.addEventListener('click', (e) => {
    if (e.target === installModal) installModal.classList.add('hidden');
});

// === Onglet Menu ===
const addMenuForm = document.getElementById('addMenuForm');
const menuList = document.getElementById('menuList');
const menuCategorySelect = document.getElementById('menuCategory');
const categoryList = document.getElementById('categoryList');
const newCategoryName = document.getElementById('newCategoryName');
const addCategoryBtn = document.getElementById('addCategoryBtn');

function loadCategories() {
    let cats = ["Burgers", "Pizzas", "Boissons"];
    try {
        if(fs.existsSync(categoriesPath)) {
            cats = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
        } else {
            fs.writeFileSync(categoriesPath, JSON.stringify(cats, null, 2));
        }
    } catch(e){}

    // Update Select
    menuCategorySelect.innerHTML = '';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        menuCategorySelect.appendChild(opt);
    });

    // Update List
    categoryList.innerHTML = '';
    cats.forEach(c => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.padding = '10px 20px';
        div.innerHTML = `
            <div class="item-info"><span class="item-title">${c}</span></div>
            <button class="btn danger outline btn-delete-cat" data-name="${c}">Supprimer</button>
        `;
        categoryList.appendChild(div);
    });

    document.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            deleteCategory(name);
        });
    });
}

function saveCategories(cats) {
    fs.writeFileSync(categoriesPath, JSON.stringify(cats, null, 2));
    loadCategories();
}

addCategoryBtn.addEventListener('click', () => {
    const val = newCategoryName.value.trim();
    if(!val) return;
    
    let cats = [];
    try { if(fs.existsSync(categoriesPath)) cats = JSON.parse(fs.readFileSync(categoriesPath, 'utf8')); } catch(e){}
    
    if(!cats.includes(val)) {
        cats.push(val);
        saveCategories(cats);
        newCategoryName.value = '';
    }
});

function deleteCategory(name) {
    let cats = [];
    try { if(fs.existsSync(categoriesPath)) cats = JSON.parse(fs.readFileSync(categoriesPath, 'utf8')); } catch(e){}
    cats = cats.filter(c => c !== name);
    saveCategories(cats);
}

function loadMenu() {
    let menu = [];
    try {
        if(fs.existsSync(menuPath)) menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
    } catch(e){}
    
    menuList.innerHTML = '';
    if(menu.length === 0) {
        menuList.innerHTML = '<p class="padding-20 text-muted text-center">Aucun produit dans le menu.</p>';
        return;
    }

    menu.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-emoji">${item.icon}</span>
                <div>
                    <div class="item-title">${item.name} <span class="item-price">- ${parseFloat(item.price).toFixed(2)}€</span></div>
                    <div class="item-cat">${item.category}</div>
                </div>
            </div>
            <button class="btn danger outline btn-delete" data-id="${item.id}">Supprimer</button>
        `;
        menuList.appendChild(div);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            deleteMenuItem(id);
        });
    });
}

function saveMenu(menu) {
    fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));
    loadMenu();
}

addMenuForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let menu = [];
    try { if(fs.existsSync(menuPath)) menu = JSON.parse(fs.readFileSync(menuPath, 'utf8')); } catch(e){}

    const newItem = {
        id: Date.now().toString(),
        name: document.getElementById('menuName').value,
        price: parseFloat(document.getElementById('menuPrice').value),
        category: document.getElementById('menuCategory').value,
        icon: document.getElementById('menuIcon').value,
        description: document.getElementById('menuDesc').value
    };

    menu.push(newItem);
    saveMenu(menu);
    addMenuForm.reset();
});

function deleteMenuItem(id) {
    let menu = [];
    try { if(fs.existsSync(menuPath)) menu = JSON.parse(fs.readFileSync(menuPath, 'utf8')); } catch(e){}
    menu = menu.filter(item => item.id.toString() !== id.toString());
    saveMenu(menu);
}

// === Onglet Paramètres ===
const adminCodeInput = document.getElementById('adminCodeInput');
const appModeSelect = document.getElementById('appModeSelect');
const remoteServerUrlGroup = document.getElementById('remoteServerUrlGroup');
const remoteServerUrlSettings = document.getElementById('remoteServerUrlSettings');

appModeSelect.addEventListener('change', (e) => {
    if(e.target.value === 'client') {
        remoteServerUrlGroup.classList.remove('hidden');
    } else {
        remoteServerUrlGroup.classList.add('hidden');
    }
});

function loadSettings() {
    try {
        if(fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if(settings.adminCode) adminCodeInput.value = settings.adminCode;
            
            if(settings.appMode) {
                appModeSelect.value = settings.appMode;
                if(settings.appMode === 'client') remoteServerUrlGroup.classList.remove('hidden');
            }
            if(settings.remoteServerUrl) remoteServerUrlSettings.value = settings.remoteServerUrl;

            // Démarrage auto en mode terminal si configuré
            if(settings.appMode === 'client') {
                document.querySelector('.app-layout').classList.add('hidden');
                let url = settings.remoteServerUrl || '';
                launchTerminalMode(url);
            }
        }
    } catch(e){}
}

document.getElementById('saveModeBtn').addEventListener('click', () => {
    let settings = {};
    try { if(fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e){}
    
    settings.appMode = appModeSelect.value;
    settings.remoteServerUrl = remoteServerUrlSettings.value;
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    // Recharger complètement l'app
    window.location.reload();
});

document.getElementById('saveCodeBtn').addEventListener('click', () => {
    let settings = {};
    try { if(fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e){}
    settings.adminCode = adminCodeInput.value;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    alert('Code enregistré !');
    
    // Régénérer le QR code si le panneau est visible
    if(!qrPanel.classList.contains('hidden')) {
        generateQrCode();
    }
});

document.getElementById('disconnectAllBtn').addEventListener('click', () => {
    if(confirm("Êtes-vous sûr de vouloir déconnecter tous les serveurs ?")) {
        fetch(`http://localhost:${currentPort}/api/auth/logout-all`, { method: 'POST' })
            .then(res => res.json())
            .then(data => alert('Tous les appareils ont été déconnectés.'))
            .catch(err => {
                // If server is not running, just clear the JSON directly
                const sessionsPath = path.join(dataDir, 'sessions.json');
                fs.writeFileSync(sessionsPath, JSON.stringify({}));
                alert('Fichier des sessions vidé.');
            });
    }
});

// === Auto Detection ===
async function autoDetectServer() {
    const ip = getLocalIp();
    if (ip === 'localhost' || ip === '127.0.0.1') return null;
    const subnet = ip.substring(0, ip.lastIndexOf('.'));
    
    const checkIp = (targetIp) => {
        return new Promise((resolve) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                resolve(null);
            }, 1000);
            
            fetch(`http://${targetIp}:3000/api/menu`, { signal: controller.signal })
                .then(res => {
                    clearTimeout(timeoutId);
                    if(res.ok) resolve(targetIp);
                    else resolve(null);
                })
                .catch(() => {
                    clearTimeout(timeoutId);
                    resolve(null);
                });
        });
    };

    const promises = [];
    for (let i = 1; i <= 254; i++) {
        promises.push(checkIp(`${subnet}.${i}`));
    }
    
    const results = await Promise.all(promises);
    return results.find(res => res !== null) || null;
}

const autoDetectBtn = document.getElementById('autoDetectBtn');
const autoDetectStatus = document.getElementById('autoDetectStatus');

if (autoDetectBtn) {
    autoDetectBtn.addEventListener('click', async () => {
        autoDetectBtn.disabled = true;
        autoDetectStatus.textContent = 'Recherche en cours...';
        autoDetectStatus.style.color = 'var(--text-muted)';
        
        const foundIp = await autoDetectServer();
        if (foundIp) {
            remoteServerUrlSettings.value = `http://${foundIp}:3000`;
            autoDetectStatus.textContent = `Serveur trouvé : ${foundIp}`;
            autoDetectStatus.style.color = 'var(--status-pret)';
        } else {
            autoDetectStatus.textContent = 'Aucun serveur trouvé.';
            autoDetectStatus.style.color = 'var(--primary)';
        }
        autoDetectBtn.disabled = false;
    });
}

// === Mode Terminal ===
const terminalContainer = document.getElementById('terminalContainer');
const terminalFrame = document.getElementById('terminalFrame');
const exitTerminalBtn = document.getElementById('exitTerminalBtn');
const terminalExitModal = document.getElementById('terminalExitModal');

async function launchTerminalMode(url) {
    terminalContainer.classList.remove('hidden');
    let finalUrl = url;
    
    if(!finalUrl) {
        terminalFrame.src = 'data:text/html,<h2 style="font-family:sans-serif;text-align:center;margin-top:20%">Recherche automatique du serveur...</h2>';
        const foundIp = await autoDetectServer();
        if(foundIp) finalUrl = `http://${foundIp}:3000`;
        else finalUrl = `http://localhost:3000`; // Fallback
    }

    if(!finalUrl.includes('login.html') && !finalUrl.includes('order.html')) {
        if(!finalUrl.endsWith('/')) finalUrl += '/';
        finalUrl += 'admin/login.html';
    }

    let code = "1234";
    try { if(fs.existsSync(settingsPath)) code = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).adminCode || code; } catch(e){}
    
    if(!finalUrl.includes('code=')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'code=' + code;
    }

    terminalFrame.src = finalUrl;
}

exitTerminalBtn.addEventListener('click', () => {
    terminalExitModal.classList.remove('hidden');
});

document.getElementById('btnSwitchToServer').addEventListener('click', () => {
    // Repasse en mode Serveur
    let settings = {};
    try { if(fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e){}
    settings.appMode = 'server';
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    window.location.reload();
});

document.getElementById('btnQuitApp').addEventListener('click', () => {
    window.close(); // Quittera l'app Electron
});

// === Version Checking ===
async function checkVersions() {
    const pkg = require('../package.json');
    const currentVersion = pkg.version;
    const currentVersionSpan = document.getElementById('currentPcVersion');
    if(currentVersionSpan) currentVersionSpan.textContent = currentVersion;
    
    try {
        const res = await fetch('https://api.github.com/repos/Ibotweat/Orderflow/releases');
        if(!res.ok) throw new Error('Network error');
        const releases = await res.json();
        
        let latestPcRelease = releases.find(r => r.assets.some(a => a.name.endsWith('.exe') || a.name === 'latest.yml'));
        let latestMobileRelease = releases.find(r => r.assets.some(a => a.name.endsWith('.apk')));
        
        let latestPcVersion = latestPcRelease ? latestPcRelease.tag_name.replace(/^v/, '') : currentVersion;
        let latestMobileVersion = latestMobileRelease ? latestMobileRelease.tag_name.replace(/^v/, '') : currentVersion;
        
        const ghPcSpan = document.getElementById('githubPcVersion');
        const ghMobileSpan = document.getElementById('githubMobileVersion');
        if(ghPcSpan) ghPcSpan.textContent = latestPcVersion;
        if(ghMobileSpan) ghMobileSpan.textContent = latestMobileVersion;
        
        const updatePcBtn = document.getElementById('updatePcBtn');
        if (updatePcBtn) {
            if (latestPcVersion !== currentVersion) {
                updatePcBtn.textContent = 'Mettre à jour le logiciel';
                updatePcBtn.className = 'btn primary mt-1';
                updatePcBtn.disabled = false;
                updatePcBtn.onclick = () => ipcRenderer.send('start-pc-update');
            } else {
                updatePcBtn.textContent = 'Logiciel à jour ✅';
                updatePcBtn.className = 'btn secondary outline mt-1';
                updatePcBtn.disabled = true;
            }
        }

        const downloadApkBtn = document.getElementById('downloadApkBtn');
        if(downloadApkBtn) {
            let apkUrl = latestMobileRelease && latestMobileRelease.assets.find(a => a.name.endsWith('.apk')) 
                ? latestMobileRelease.assets.find(a => a.name.endsWith('.apk')).browser_download_url 
                : 'https://github.com/Ibotweat/Orderflow/releases/latest/download/Orderflow_Mobile.apk';
                
            downloadApkBtn.onclick = () => {
                downloadApkBtn.disabled = true;
                const oldText = downloadApkBtn.textContent;
                downloadApkBtn.textContent = 'Téléchargement...';
                ipcRenderer.send('download-apk', apkUrl);
                
                ipcRenderer.once('download-apk-done', (event, { success, message }) => {
                    downloadApkBtn.disabled = false;
                    downloadApkBtn.textContent = oldText;
                    if(message) alert(message);
                });
            };
        }

    } catch(err) {
        const ghPcSpan = document.getElementById('githubPcVersion');
        const ghMobileSpan = document.getElementById('githubMobileVersion');
        if(ghPcSpan) ghPcSpan.textContent = 'Erreur réseau';
        if(ghMobileSpan) ghMobileSpan.textContent = 'Erreur réseau';
    }
}

// Init
loadCategories();
loadMenu();
loadSettings();
checkVersions();
