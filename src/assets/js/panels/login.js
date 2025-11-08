const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";

    async init(config) {
        this.config = config;
        this.db = new database();

        // Mostrar panel de selección inicial
        this.showTab('.login-select');

        // Eventos de selección de login
        document.querySelector('.select-microsoft').addEventListener('click', () => {
            this.showMicrosoftLogin();
        });

        document.querySelector('.select-offline').addEventListener('click', () => {
            this.showOfflineLogin();
        });

        // Cancelar Microsoft
        document.querySelector('.cancel-home').addEventListener('click', () => {
            this.showTab('.login-select');
        });

        // Cancelar Offline
        document.querySelector('.cancel-offline').addEventListener('click', () => {
            this.showTab('.login-select');
        });

        // Cancelar AZauth
        const cancelAZauth = document.querySelector('.cancel-AZauth');
        if(cancelAZauth){
            cancelAZauth.addEventListener('click', () => {
                this.showTab('.login-select');
            });
        }

        // Cancelar AZauth-A2F
        const cancelAZauthA2F = document.querySelector('.cancel-AZauth-A2F');
        if(cancelAZauthA2F){
            cancelAZauthA2F.addEventListener('click', () => {
                this.showTab('.login-select');
            });
        }
    }

    // Mostrar una pestaña y ocultar las demás
    showTab(selector) {
        document.querySelectorAll('.login-tabs').forEach(tab => {
            tab.style.display = 'none';
        });
        const tab = document.querySelector(selector);
        if(tab) tab.style.display = 'block';
    }

    // Mostrar login Microsoft
    showMicrosoftLogin() {
        this.showTab('.login-home');
        this.getMicrosoft();
    }

    // Mostrar login Offline
    showOfflineLogin() {
        this.showTab('.login-offline');
        this.getCrack();
    }

    async getMicrosoft() {
        console.log('Initializing Microsoft login...');
        const popupLogin = new popup();
        const microsoftBtn = document.querySelector('.connect-home');

        // Evitar duplicar listener
        microsoftBtn.replaceWith(microsoftBtn.cloneNode(true));
        const btn = document.querySelector('.connect-home');

        btn.addEventListener("click", () => {
            popupLogin.openPopup({
                title: 'Conectando',
                content: 'Espere por favor...',
                color: 'var(--color)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
                if (!account_connect || account_connect === 'cancel') {
                    popupLogin.closePopup();
                    return;
                }
                await this.saveData(account_connect);
                popupLogin.closePopup();
            }).catch(err => {
                popupLogin.openPopup({
                    title: 'Error',
                    content: err,
                    options: true
                });
            });
        });
    }

    async getCrack() {
        console.log('Initializing offline login...');
        const popupLogin = new popup();
        const emailOffline = document.querySelector('.email-offline');
        const connectOffline = document.querySelector('.connect-offline');

        // Evitar duplicar listener
        connectOffline.replaceWith(connectOffline.cloneNode(true));
        const btn = document.querySelector('.connect-offline');

        btn.addEventListener('click', async () => {
            const nick = emailOffline.value.trim();
            if (nick.length < 3) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu Nick debe tener al menos 3 caracteres.',
                    options: true
                });
                return;
            }
            if (nick.includes(' ')) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: 'Tu Nick no debe contener espacios.',
                    options: true
                });
                return;
            }

            const MojangConnect = await Mojang.login(nick);
            if (MojangConnect.error) {
                popupLogin.openPopup({
                    title: 'Error',
                    content: MojangConnect.message,
                    options: true
                });
                return;
            }
            await this.saveData(MojangConnect);
            popupLogin.closePopup();
        });
    }

    async getAZauth() {
        // Aquí tu lógica AZauth como estaba antes
    }

    async saveData(connectionData) {
        // Normalizar el objeto de conexión para asegurar que tiene la propiedad 'name'
        if (!connectionData.name && connectionData.profile?.name) {
            connectionData.name = connectionData.profile.name;
            console.log(`[Login] Microsoft account normalized: name=${connectionData.name}`);
        }
        if (!connectionData.name) {
            console.warn('[Login] Account has no name property!', connectionData);
        }

        const configClient = await this.db.readData('configClient');
        const account = await this.db.createData('accounts', connectionData);
        
        // Verificar que createData preservó la propiedad 'name'
        if (!account.name && account.profile?.name) {
            account.name = account.profile.name;
            console.log(`[Login] Account name needed re-normalization after createData: ${account.name}`);
            await this.db.updateData('accounts', account, account.ID);
        }
        const instanceSelect = configClient.instance_selct;
        const instancesList = await config.getInstanceList();

        // Select the newly created account
        configClient.account_selected = account.ID;

        // Ensure instance selection respects whitelist after adding account
        try {
            for (let instance of instancesList) {
                if (instance.whitelistActive) {
                    const whitelist = instance.whitelist.find(u => u === account.name);
                    if (whitelist !== account.name && instance.name === instanceSelect) {
                        const newInstanceSelect = instancesList.find(i => !i.whitelistActive);
                        if (newInstanceSelect) {
                            configClient.instance_selct = newInstanceSelect.name;
                            await setStatus(newInstanceSelect.status);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Error while adjusting instance selection for new account:', err);
        }

        // Persist config changes
        await this.db.updateData('configClient', configClient);

        // Update UI; be defensive: if addAccount/accountSelect fail, still attempt to go Home
        try {
            await addAccount(account);
        } catch (err) {
            console.warn('addAccount failed (UI list update) but account was created:', err);
        }

        try {
            await accountSelect(account);
        } catch (err) {
            console.warn('accountSelect failed (UI selection) but account was created:', err);
        }

        try {
            changePanel('home');
        } catch (err) {
            console.error('changePanel to home failed after login:', err);
        }

        return account;
    }
}

export default Login;
