# Orderflow 🍔📱

Orderflow est un système de prise de commande local et hors ligne (offline-first) pensé pour la restauration rapide, les food trucks, les bars et les petits événements. 

## 🚀 Pourquoi Orderflow ?
- **100% Local & Hors Ligne** : Aucune connexion internet n'est requise. Le système fonctionne de manière autonome sur votre réseau local (Wi-Fi).
- **Pas de Base de Données Complexe** : Toutes les données sont sauvegardées en local sous format de simples fichiers texte (JSON). C'est ultra-léger et vos données restent privées.
- **Multi-Appareils** : Utilisez un PC Windows comme serveur principal (et écran de cuisine) et connectez n'importe quel smartphone ou tablette pour prendre les commandes ou les consulter en temps réel.
- **Plug & Play** : Installez le logiciel, lancez-le, scannez un QR code et vous êtes prêt !

## 📥 Téléchargements

> **Note :** Cliquez sur les boutons ci-dessous pour télécharger la dernière version de l'application.

[![Télécharger pour Windows](https://img.shields.io/badge/Windows-T%C3%A9l%C3%A9charger_le_Logiciel_PC-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Ibotweat/Orderflow/releases/latest/download/Orderflow_Setup.exe)
[![Télécharger l'APK](https://img.shields.io/badge/Android-T%C3%A9l%C3%A9charger_l'App_Mobile_APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/Ibotweat/Orderflow/releases/latest/download/Orderflow_Mobile.apk)

---

## 🛠️ Installation & Utilisation

### 1. Le Serveur Principal (PC Windows)
1. Téléchargez l'installateur Windows (`Orderflow Setup.exe`).
2. Installez et lancez l'application. Ce PC sera le "cerveau" de votre restaurant.
3. Allez dans l'onglet **Serveur & Accès** et cliquez sur **Démarrer le Serveur**.

### 2. Connecter vos Appareils Mobiles (Prise de commande)
Vous avez deux options pour connecter vos téléphones ou tablettes :
- **L'Application Mobile Android (Recommandé)** : Installez le fichier `Orderflow.apk` sur vos téléphones Android. Au lancement, l'application détectera automatiquement le serveur OU vous pouvez scanner le QR code OU rentrez l'adresse IP affichée sur le PC.
- **La Version Web Rapide** : Flashez simplement le QR Code affiché sur l'écran du PC avec l'appareil photo de n'importe quel téléphone (iPhone ou Android) pour ouvrir l'interface de commande dans votre navigateur web.

## ⚙️ Fonctionnalités Principales
1. **Gestion du Menu Intuitive** : Ajoutez ou modifiez vos plats, prix, et emojis/icônes directement depuis le PC.
2. **Synchronisation en Temps Réel** : Les serveurs envoient les commandes depuis leur téléphone, elles s'affichent instantanément en cuisine sur le PC.
3. **Suivi des Statuts** : Changez l'état d'une commande d'un simple clic (`En attente` ➡️ `Préparation` ➡️ `Prêt`).
4. **Code Admin Sécurisé** : Verrouillez l'accès aux commandes et aux paramètres critiques avec un code PIN (configurable dans les paramètres).

---

## 👨‍💻 Pour les Développeurs

Vous souhaitez modifier le projet, ajouter des fonctionnalités ou le recompiler ? 

### Prérequis
- [Node.js](https://nodejs.org/) (Version 18 ou supérieure)
- [Flutter](https://flutter.dev/) (Uniquement si vous souhaitez modifier l'application mobile Android/iOS)

### Installation du projet PC (Serveur Electron)
```bash
# Cloner le dépôt
git clone https://github.com/Ibotweat/Orderflow.git
cd Orderflow

# Installer les dépendances
npm install

# Lancer l'application en mode développement
npm start
```

### Compiler le logiciel Windows (.exe)
```bash
npm run build
```
L'exécutable généré se trouvera dans le dossier `dist/`.

### Lancer le projet Mobile (Flutter)
```bash
cd orderflow_mobile
flutter pub get
flutter run
```

---

By Ibotweat
