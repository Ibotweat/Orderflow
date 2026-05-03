// --- Fetch Interceptor for Token Auth ---
const originalFetch = window.fetch;
window.fetch = async function(resource, config = {}) {
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
        const token = localStorage.getItem('orderflow_token');
        if (token) {
            config.headers = { ...config.headers, 'Authorization': `Bearer ${token}` };
        }
    }
    const response = await originalFetch(resource, config);
    if (response.status === 401 && typeof resource === 'string' && !resource.includes('/auth/login') && !resource.includes('/auth/check')) {
        window.location.href = '/admin/login.html';
    }
    return response;
};

// État global
let MENU_ITEMS = [];
let cart = [];

// Éléments du DOM
const menuGrid = document.getElementById('menuGrid');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalElement = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const tableNumberInput = document.getElementById('tableNumber');
const toast = document.getElementById('toast');
const ordersGrid = document.getElementById('ordersGrid');
const refreshBtn = document.getElementById('refreshBtn');

// --- Logique de la page "Prise de Commande" ---

if (menuGrid) {
    initMenu();
}

async function initMenu() {
    try {
        const res = await fetch('/api/menu');
        if (!res.ok && res.status !== 401) throw new Error("Erreur serveur");
        if (res.ok) MENU_ITEMS = await res.json();
    } catch(e) {
        console.error("Erreur de chargement du menu");
        return;
    }

    menuGrid.innerHTML = '';

    if (MENU_ITEMS.length === 0) {
        menuGrid.innerHTML = '<p class="empty-cart-msg" style="grid-column: 1 / -1;">Le menu est vide. Ajoutez des produits via le logiciel.</p>';
        return;
    }

    // Grouper par catégories
    const categories = [...new Set(MENU_ITEMS.map(item => item.category || 'Autres'))];
    
    // Catégories (Filtres)
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.innerHTML = '';
        
        // Bouton "Tout"
        const allBtn = document.createElement('button');
        allBtn.className = 'cat-btn active';
        allBtn.textContent = 'Tous';
        allBtn.onclick = () => filterMenu('Tous');
        categoryFilter.appendChild(allBtn);

        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-btn';
            btn.textContent = cat;
            btn.onclick = () => filterMenu(cat);
            categoryFilter.appendChild(btn);
        });

        // Bouton Panier
        const cartBtn = document.createElement('button');
        cartBtn.className = 'cat-btn cart-btn-filter';
        cartBtn.id = 'openCartBtnFilter';
        cartBtn.innerHTML = '🛒 Panier (0.00 €)';
        cartBtn.onclick = () => document.getElementById('cartModal').classList.remove('hidden');
        categoryFilter.appendChild(cartBtn);
    }
    
    // Afficher tous les items
    renderMenuItems('Tous');
}

function filterMenu(category) {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        if (btn.textContent === category) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderMenuItems(category);
}

function renderMenuItems(filterCat) {
    menuGrid.innerHTML = '';
    
    const itemsToShow = filterCat === 'Tous' 
        ? MENU_ITEMS 
        : MENU_ITEMS.filter(item => (item.category || 'Autres') === filterCat);
        
    itemsToShow.forEach(item => {
        const cartItem = cart.find(c => c.id.toString() === item.id.toString());
        const currentQty = cartItem ? cartItem.quantity : 0;
        
        const card = document.createElement('div');
        card.className = 'menu-item';
        card.innerHTML = `
            <div class="item-clickable" style="cursor: pointer; width: 100%;" onclick="showItemDetails('${item.id}')">
                <div class="item-icon">${item.icon || '🍔'}</div>
                <h3>${item.name}</h3>
            </div>
            <span class="item-price" style="margin-top: auto; padding-top: 5px;">${parseFloat(item.price).toFixed(2)} €</span>
            <div class="cart-item-controls inline-controls" style="justify-content: center; margin-top: 10px; width: 100%;">
                <button class="qty-btn minus-menu" data-id="${item.id}">-</button>
                <span class="qty" style="margin: 0 10px; font-weight: bold;">${currentQty}</span>
                <button class="qty-btn plus-menu" data-id="${item.id}">+</button>
            </div>
        `;
        menuGrid.appendChild(card);
    });

    document.querySelectorAll('.plus-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = e.target.getAttribute('data-id');
            const item = MENU_ITEMS.find(i => i.id.toString() === itemId);
            const existingItem = cart.find(i => i.id.toString() === itemId);
            if (existingItem) existingItem.quantity += 1;
            else cart.push({ ...item, quantity: 1 });
            updateCartUI();
            renderMenuItems(document.querySelector('.cat-btn.active').textContent);
        });
    });

    document.querySelectorAll('.minus-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = e.target.getAttribute('data-id');
            const existingIndex = cart.findIndex(i => i.id.toString() === itemId);
            if (existingIndex !== -1) {
                cart[existingIndex].quantity -= 1;
                if (cart[existingIndex].quantity <= 0) cart.splice(existingIndex, 1);
            }
            updateCartUI();
            renderMenuItems(document.querySelector('.cat-btn.active').textContent);
        });
    });

    checkoutBtn.addEventListener('click', submitOrder);
}

function showItemDetails(id) {
    const item = MENU_ITEMS.find(i => i.id.toString() === id.toString());
    if (!item) return;
    
    document.getElementById('modalIcon').textContent = item.icon || '🍔';
    document.getElementById('modalTitle').textContent = item.name;
    document.getElementById('modalDesc').textContent = item.description || 'Aucune description disponible.';
    document.getElementById('modalPrice').textContent = parseFloat(item.price).toFixed(2) + ' €';
    
    document.getElementById('itemDetailsModal').classList.remove('hidden');
}

function updateCartUI() {
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Le panier est vide.</p>';
        checkoutBtn.disabled = true;
    } else {
        checkoutBtn.disabled = false;
        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartRow = document.createElement('div');
            cartRow.className = 'cart-item';
            cartRow.innerHTML = `
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">${parseFloat(item.price).toFixed(2)} €</span>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn minus" data-index="${index}">-</button>
                    <span class="qty">${item.quantity}</span>
                    <button class="qty-btn plus" data-index="${index}">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(cartRow);
        });

        // Ajouter les événements pour +/-
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                if (e.target.classList.contains('plus')) {
                    cart[index].quantity += 1;
                } else {
                    cart[index].quantity -= 1;
                    if (cart[index].quantity <= 0) {
                        cart.splice(index, 1);
                    }
                }
                updateCartUI();
            });
        });
    }

    cartTotalElement.textContent = `${total.toFixed(2)} €`;

    // Mettre à jour le bouton panier dans le filtre
    const filterCartBtn = document.getElementById('openCartBtnFilter');
    if (filterCartBtn) {
        let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        filterCartBtn.innerHTML = `🛒 Panier (${totalItems}) - ${total.toFixed(2)} €`;
    }
}

async function submitOrder() {
    if (cart.length === 0) return;

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Envoi...";

    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const table = tableNumberInput.value.trim() || "Emporter";

    const orderData = {
        table: table,
        items: cart,
        total: total
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok && response.status !== 401) {
            const resData = await response.json().catch(()=>({}));
            throw new Error(resData.message || "Erreur serveur");
        }

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                cart = [];
                tableNumberInput.value = '';
                document.getElementById('cartModal').classList.add('hidden');
                updateCartUI();
                renderMenuItems(document.querySelector('.cat-btn.active').textContent);
                showToast();
            } else {
                alert('Erreur: ' + result.message);
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur de connexion au serveur.');
    } finally {
        checkoutBtn.textContent = "Valider la commande";
        checkoutBtn.disabled = cart.length === 0;
    }
}

function showToast() {
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// --- Logique de la page "Cuisine / Serveur" ---

if (ordersGrid) {
    fetchOrders();

    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchOrders);
    }

    // Auto-refresh toutes les 5 secondes
    setInterval(fetchOrders, 5000);
}

async function fetchOrders() {
    try {
        const response = await fetch('/api/orders');
        if (response.ok) {
            const orders = await response.json();
            renderOrders(orders);
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des commandes", error);
        ordersGrid.innerHTML = '<div class="loading-msg error">Erreur de connexion</div>';
    }
}

function renderOrders(orders) {
    ordersGrid.innerHTML = '';

    if (orders.length === 0) {
        ordersGrid.innerHTML = '<div class="loading-msg">Aucune commande en cours.</div>';
        return;
    }

    orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = `order-card status-${order.status.toLowerCase().replace(/\s/g, '-')}`;
        
        const date = new Date(order.timestamp);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

        let itemsHtml = order.items.map(item => `
            <div class="order-item">
                <span class="qty">${item.quantity}x</span>
                <span class="name">${item.name}</span>
            </div>
        `).join('');

        orderCard.innerHTML = `
            <div class="order-header">
                <h3>${order.table}</h3>
                <span class="time">${timeStr}</span>
            </div>
            <div class="order-body">
                ${itemsHtml}
            </div>
            <div class="order-footer">
                <select class="status-select" data-id="${order.id}">
                    <option value="En attente" ${order.status === 'En attente' ? 'selected' : ''}>En attente</option>
                    <option value="Préparation" ${order.status === 'Préparation' ? 'selected' : ''}>Préparation</option>
                    <option value="Prêt" ${order.status === 'Prêt' ? 'selected' : ''}>Prêt</option>
                    <option value="Terminé" ${order.status === 'Terminé' ? 'selected' : ''}>Terminé</option>
                </select>
                <div>
                    <button class="print-btn btn secondary small" data-id="${order.id}">🖨️ Ticket</button>
                    <button class="delete-btn" data-id="${order.id}">🗑️</button>
                </div>
            </div>
        `;
        ordersGrid.appendChild(orderCard);
    });

    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const id = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            await updateOrderStatus(id, newStatus);
            fetchOrders();
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Voulez-vous vraiment supprimer cette commande ?')) {
                const id = e.target.closest('.delete-btn').getAttribute('data-id');
                await deleteOrder(id);
                fetchOrders();
            }
        });
    });

    document.querySelectorAll('.print-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const order = orders.find(o => o.id.toString() === id);
            if (order) printTicket(order);
        });
    });
}

function printTicket(order) {
    const date = new Date(order.timestamp);
    const dateStr = date.toLocaleDateString('fr-FR');
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    let itemsHtml = order.items.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${item.quantity}x ${item.name}</span>
            <span>${(item.price * item.quantity).toFixed(2)} €</span>
        </div>
    `).join('');

    const printWindow = document.createElement('iframe');
    printWindow.style.position = 'absolute';
    printWindow.style.top = '-1000px';
    document.body.appendChild(printWindow);

    const doc = printWindow.contentWindow.document;
    doc.open();
    doc.write(`
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 300px; margin: 0; padding: 10px; color: black; }
                .text-center { text-align: center; }
                .divider { border-top: 1px dashed black; margin: 10px 0; }
                h2 { margin: 0 0 5px 0; font-size: 16px; }
                .bold { font-weight: bold; }
                @page { margin: 0; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <h2>ORDERFLOW</h2>
                <p>Table: <span class="bold">${order.table}</span></p>
                <p>${dateStr} - ${timeStr}</p>
                <p>N° ${order.id.slice(-4)}</p>
            </div>
            <div class="divider"></div>
            ${itemsHtml}
            <div class="divider"></div>
            <div style="display:flex; justify-content:space-between; font-size: 14px;" class="bold">
                <span>TOTAL</span>
                <span>${parseFloat(order.total).toFixed(2)} €</span>
            </div>
            <div class="divider"></div>
            <p class="text-center">Merci de votre visite !</p>
        </body>
        </html>
    `);
    doc.close();

    printWindow.contentWindow.focus();
    setTimeout(() => {
        printWindow.contentWindow.print();
        setTimeout(() => document.body.removeChild(printWindow), 500);
    }, 250);
}

async function updateOrderStatus(id, status) {
    try {
        await fetch(`/api/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    } catch (error) {
        console.error("Erreur mise à jour:", error);
    }
}

async function deleteOrder(id) {
    try {
        await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    } catch (error) {
        console.error("Erreur suppression:", error);
    }
}

// Fonction de déconnexion pour le client web
document.addEventListener('DOMContentLoaded', () => {
    // Si on a un bouton logout (à ajouter dans la navbar)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST' });
            localStorage.removeItem('orderflow_token');
            window.location.href = '/admin/login.html';
        });
    }
});
