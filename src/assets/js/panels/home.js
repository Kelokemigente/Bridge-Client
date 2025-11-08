/**
 * @author Darken
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.news();
        this.renderSidebarAvatars();
        this.instancesSelect();
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'));
    }

    // Método auxiliar para filtrar instancias autorizadas por whitelist
    filterAuthorizedInstances(instancesList, authName) {
        return instancesList.filter(instance => {
            if (instance.whitelistActive) {
                const wl = Array.isArray(instance.whitelist) ? instance.whitelist : [];
                return wl.includes(authName);
            }
            // Si no tiene whitelist, siempre está disponible
            return true;
        });
    }

    // Establece el fondo del launcher, con precarga y fallback
    setBackground(url) {
        try {
            if (!url) {
                document.body.style.backgroundImage = '';
                this.currentBackground = null;
                return;
            }

            const img = new Image();
            img.onload = () => {
                document.body.style.backgroundImage = `url('${url}')`;
                this.currentBackground = url;
            };
            img.onerror = () => {
                console.warn('No se pudo cargar la imagen de fondo:', url);
                document.body.style.backgroundImage = '';
                this.currentBackground = null;
            };
            img.src = url;
        } catch (e) {
            console.warn('Error estableciendo fondo:', e);
            document.body.style.backgroundImage = '';
        }
    }

    // (removed) debug overlay helper — debug UI was temporary and removed

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews().then(res => res).catch(err => false);

        if (news) {
            if (!news.length) {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">No hay noticias disponibles actualmente.</div>
                        </div>
                        <div class="date">
                            <div class="day">25</div>
                            <div class="month">Abril</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Puedes seguir todas las novedades relativas al servidor aquí.</p>
                        </div>
                    </div>`;
                newsElement.appendChild(blockNews);
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date);
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon.png">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, '<br>')}</p>
                                <p class="news-author">- <span>${News.author}</span></p>
                            </div>
                        </div>`;
                    newsElement.appendChild(blockNews);
                }
            }
        } else {
            let blockNews = document.createElement('div');
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">25</div>
                            <div class="month">Abril</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>No se puede contactar con el servidor de noticias.</br>Por favor verifique su configuración.</p>
                        </div>
                    </div>`
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block');
        socials.forEach(social => {
            social.addEventListener('click', e => shell.openExternal(social.dataset.url));
        });
    }

    // Render circular instance avatars in the sidebar and wire clicks to change instance
    async renderSidebarAvatars() {
        try {
            let configClient = await this.db.readData('configClient');
            let auth = await this.db.readData('accounts', configClient.account_selected);
            let allInstances = await config.getInstanceList();
            // Filtrar solo instancias autorizadas
            let instancesList = this.filterAuthorizedInstances(allInstances, auth?.name);
            const container = document.querySelector('.instance-avatars');
            if (!container) return;

            // Debug: log instances returned from server and current auth
            console.debug('renderSidebarAvatars: auth=', auth?.name, 'authorized instances=', instancesList.map(i => i.name));

            container.innerHTML = '';

            // Reusable tooltip element for instance names on hover
            let tooltip = document.querySelector('.instance-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'instance-tooltip';
                tooltip.style.display = 'none';
                document.body.appendChild(tooltip);
            }

            const defaultAvatar = 'assets/images/icon.png';
            for (let instance of instancesList) {

                const bg = instance.backgroundUrl || instance.background || '';
                const avatar = instance.avatarUrl || instance.iconUrl || instance.icon || '';
                const el = document.createElement('div');
                el.className = 'instance-avatar';
                el.dataset.name = instance.name;

                // set avatar image (prefer avatar field; fallback to background or a default icon)
                if (avatar) el.style.backgroundImage = `url('${avatar}')`;
                else if (bg) el.style.backgroundImage = `url('${bg}')`;
                else el.style.backgroundImage = `url('${defaultAvatar}')`;

                if (configClient.instance_selct === instance.name) el.classList.add('active');

                // Show tooltip on hover with the instance name
                el.addEventListener('mouseenter', (ev) => {
                    try {
                        let tooltipText = instance.name;
                        tooltip.textContent = tooltipText;
                        tooltip.style.display = 'block';
                        // position tooltip to the right of avatar by default
                        const rect = el.getBoundingClientRect();
                        tooltip.style.top = `${rect.top + rect.height / 2}px`;
                        tooltip.style.left = `${rect.right + 10}px`;
                    } catch (err) { }
                });
                el.addEventListener('mousemove', (ev) => {
                    // follow cursor a bit to avoid blocking the avatar
                    tooltip.style.top = `${ev.clientY + 12}px`;
                    tooltip.style.left = `${ev.clientX + 12}px`;
                });
                el.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });

                el.addEventListener('click', async () => {
                    try {
                        // update visual selection
                        const prev = container.querySelector('.instance-avatar.active');
                        if (prev) prev.classList.remove('active');
                        el.classList.add('active');

                        // persist selection
                        configClient.instance_selct = instance.name;
                        await this.db.updateData('configClient', configClient);

                        // Notificar al Rich Presence sobre el cambio de instancia
                        ipcRenderer.send('instance-changed', { instanceName: instance.name });

                        // apply background and status
                        try { this.setBackground(bg || null); } catch (e) { }
                        try { setStatus(instance.status); } catch (e) { }
                    } catch (err) { console.warn('Error al seleccionar instancia desde sidebar:', err); }
                });

                container.appendChild(el);
            }
        } catch (e) {
            console.warn('Error renderizando avatars de instancia:', e);
        }
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let allInstances = await config.getInstanceList();
        // Filtrar solo instancias autorizadas
        let instancesList = this.filterAuthorizedInstances(allInstances, auth?.name);
        
        let instanceSelect = instancesList.find(i => i.name == configClient?.instance_selct)
            ? configClient?.instance_selct
            : null;

        let playBTN = document.querySelector('.play-btn');
        let instanceBTN = document.querySelector('.instance-select');
        let instancePopup = document.querySelector('.instance-popup');
        let instancesListPopup = document.querySelector('.instances-List');
        let instanceCloseBTN = document.querySelector('.close-popup');

        // Siempre mostrar el botón de instancias
        instanceBTN.style.display = 'flex';

        if (!instanceSelect && instancesList.length > 0) {
            configClient.instance_selct = instancesList[0]?.name;
            instanceSelect = instancesList[0]?.name;
            await this.db.updateData('configClient', configClient);
        }

        // Aplicar status de la instancia seleccionada
        for (let instance of instancesList) {
            if (instance.name === instanceSelect) {
                setStatus(instance.status);
                break;
            }
        }

        // Aplicar fondo inicial de la instancia seleccionada (si existe)
        try {
            let currentOption = instancesList.find(i => i.name === instanceSelect);
            if (currentOption) this.setBackground(currentOption.backgroundUrl || currentOption.background || null);
        } catch (e) { console.warn('Error aplicando fondo inicial:', e); }

        // Botón selector de instancia abre popup
        instanceBTN.addEventListener('click', async () => {
            instancesListPopup.innerHTML = '';

            if (instancesList.length === 0) {
                instancesListPopup.innerHTML = `<div class="no-instances">No hay instancias activas disponibles</div>`;
            } else {
                instancesListPopup.innerHTML = '';
                
                // Renderizar instancias disponibles
                for (let instance of instancesList) {
                    const bg = instance.backgroundUrl || instance.background || '';
                    const bannerStyle = bg ? `style="background-image: url('${bg}');"` : '';
                    instancesListPopup.innerHTML += `
                        <div id="${instance.name}" class="instance-card${instance.name === instanceSelect ? ' active-instance' : ''}" data-bg="${bg}">
                            <div class="instance-banner" ${bannerStyle}>
                                <div class="instance-banner-overlay">
                                    <div class="instance-name">${instance.name}</div>
                                </div>
                            </div>
                        </div>`;
                }
            }

            // Prepare hover preview handlers (avoid duplicates by defining once per open)
            const onHover = e => {
                const el = e.target.closest('.instance-card');
                if (!el) return;
                const hoverBg = el.dataset.bg;
                if (hoverBg) this.setBackground(hoverBg);
            };

            const onLeave = e => {
                const related = e.relatedTarget;
                if (!instancesListPopup.contains(related)) {
                    try {
                        const currentInstance = instancesList.find(i => i.name === instanceSelect);
                        this.setBackground(currentInstance?.backgroundUrl || currentInstance?.background || null);
                    } catch (err) { }
                }
            };

            // Remove previous listeners (no-op if not present) and add
            instancesListPopup.removeEventListener('mouseover', onHover);
            instancesListPopup.removeEventListener('mouseout', onLeave);
            instancesListPopup.addEventListener('mouseover', onHover);
            instancesListPopup.addEventListener('mouseout', onLeave);

            instancePopup.style.display = 'flex';
        });



        // Selección de instancia en popup
        instancePopup.addEventListener('click', async e => {
            const instanceEl = e.target.closest('.instance-card');
            if (instanceEl) {
                let newInstanceSelect = instanceEl.id;
                let instance = instancesList.find(i => i.name === newInstanceSelect);

                if (!instance) return;

                let active = document.querySelector('.active-instance');
                if (active) active.classList.remove('active-instance');
                instanceEl.classList.add('active-instance');

                configClient.instance_selct = newInstanceSelect;
                await this.db.updateData('configClient', configClient);
                instanceSelect = newInstanceSelect;

                // Notificar al Rich Presence sobre el cambio de instancia
                ipcRenderer.send('instance-changed', { instanceName: newInstanceSelect });

                await setStatus(instance.status);
                // Apply background for selected instance
                try { this.setBackground(instance.backgroundUrl || instance.background || null); } catch (e) { }
                instancePopup.style.display = 'none';
            }
        });

        // Cerrar popup
        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none');

        // Botón Jugar
        playBTN.addEventListener('click', () => this.startGame());
    }

    async startGame() {
        // startGame called
        const rawConfig = await this.db.readData('configClient');
        let configClient = rawConfig || {};
        let needPersist = false;

        // Defensive defaults in case DB record is missing or partially populated
        if (!rawConfig || typeof rawConfig !== 'object') {
            needPersist = true;
            configClient = {
                account_selected: null,
                instance_selct: null,
                java_config: { java_path: null, java_memory: { min: 2, max: 4 } },
                game_config: { screen_size: { width: 854, height: 480 } },
                launcher_config: { download_multi: 5, theme: 'auto', closeLauncher: 'close-launcher', intelEnabledMac: true }
            };
        }

        // Ensure nested configs exist
        if (!configClient.launcher_config) { configClient.launcher_config = { download_multi: 5, theme: 'auto', closeLauncher: 'close-launcher', intelEnabledMac: true }; needPersist = true; }
        if (!configClient.java_config) { configClient.java_config = { java_path: null, java_memory: { min: 2, max: 4 } }; needPersist = true; }
        if (!configClient.java_config.java_memory) { configClient.java_config.java_memory = { min: 2, max: 4 }; needPersist = true; }
        if (!configClient.game_config) { configClient.game_config = { screen_size: { width: 854, height: 480 } }; needPersist = true; }
        if (!configClient.game_config.screen_size) { configClient.game_config.screen_size = { width: 854, height: 480 }; needPersist = true; }
        if (needPersist) {
            try { await this.db.updateData('configClient', configClient); } catch (err) { console.warn('Failed to persist default configClient:', err); }
        }
        const instances = await config.getInstanceList();
        const authenticator = await this.db.readData('accounts', configClient.account_selected);
        const options = instances.find(i => i.name === configClient.instance_selct);

        const playInstanceBTN = document.querySelector('.play-instance');
        const infoStartingBOX = document.querySelector('.info-starting-game');
        const infoStarting = document.querySelector(".info-starting-game-text");
        const progressBar = document.querySelector('.progress-bar');

        // Basic validations before building the launch options
        if (!options) {
            console.error('startGame: no options found for selected instance', configClient.instance_selct);
            new popup().openPopup({ title: 'Error', content: 'No se encontró la instancia seleccionada. Revise la configuración.', color: 'red', options: true });
            return;
        }

        if (!authenticator) {
            console.error('startGame: no authenticator/account selected');
            new popup().openPopup({ title: 'Error', content: 'No hay una cuenta seleccionada. Inicie sesión primero.', color: 'red', options: true });
            return;
        }

        // Verificar que el usuario está autorizado para lanzar esta instancia (validación de seguridad)
        if (options.whitelistActive) {
            const wl = Array.isArray(options.whitelist) ? options.whitelist : [];
            if (!wl.includes(authenticator?.name)) {
                console.error('startGame: Usuario no autorizado para lanzar instancia', configClient.instance_selct, 'usuario:', authenticator?.name);
                new popup().openPopup({ title: 'Acceso denegado', content: `No tienes permiso para lanzar la instancia ${options.name}.`, color: 'red', options: true });
                return;
            }
        }

        // Validate loader structure to avoid runtime exceptions
        if (!options.loadder || typeof options.loadder !== 'object') {
            console.warn('startGame: instance loader info missing or invalid, attempting to continue with defaults', options.name);
        }

        const opt = {
            url: options.url,
            authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform === 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder?.minecraft_version,
            detached: configClient.launcher_config.closeLauncher !== "close-all",
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,
            loader: {
                type: options.loadder?.loadder_type,
                build: options.loadder?.loadder_version,
                enable: options.loadder?.loadder_type !== 'none'
            },
            verify: options.verify,
            ignored: Array.isArray(options.ignored) ? [...options.ignored] : [],
            javaPath: configClient.java_config?.java_path,
            screen: {
                width: configClient.game_config?.screen_size?.width,
                height: configClient.game_config?.screen_size?.height
            },
            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        };

        // Create launcher and attach listeners BEFORE starting the launch to avoid missing early events
        const launch = new Launch();

        launch.on('extract', () => ipcRenderer.send('main-window-progress-load'));
        launch.on('progress', (progress, size) => {
            infoStarting.innerHTML = `Descargando ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            if (progressBar) {
                progressBar.value = progress;
                progressBar.max = size;
            }
        });
        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Verificando ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            if (progressBar) {
                progressBar.value = progress;
                progressBar.max = size;
            }
        });
        launch.on('estimated', time => console.log(`Tiempo estimado: ${time}s`));
        launch.on('speed', speed => console.log(`${(speed / 1067008).toFixed(2)} Mb/s`));
        launch.on('patch', () => { if (infoStarting) infoStarting.innerHTML = `Parche en curso...`; });
        launch.on('data', () => {
            if (progressBar) progressBar.style.display = "none";
            if (infoStarting) infoStarting.innerHTML = `Jugando...`;
            new logger('Minecraft', '#36b030');
        });
        launch.on('close', code => {
            ipcRenderer.send('main-window-progress-reset');
            if (infoStartingBOX) infoStartingBOX.style.display = "none";
            if (playInstanceBTN) playInstanceBTN.style.display = "flex";
            if (infoStarting) infoStarting.innerHTML = `Verificando`;
            new logger(pkg.name, '#7289da');
        });
        launch.on('error', err => {
            let popupError = new popup();
            popupError.openPopup({ title: 'Error', content: err?.error || err?.message || String(err), color: 'red', options: true });
            ipcRenderer.send('main-window-progress-reset');
            if (infoStartingBOX) infoStartingBOX.style.display = "none";
            if (playInstanceBTN) playInstanceBTN.style.display = "flex";
            if (infoStarting) infoStarting.innerHTML = `Verificando`;
            new logger(pkg.name, '#7289da');
        });

        // UI - show progress area
        if (playInstanceBTN) playInstanceBTN.style.display = "none";
        if (infoStartingBOX) infoStartingBOX.style.display = "block";
        if (progressBar) progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load');

        // Set starting popup image to instance avatar (or fallbacks)
        try {
            const startImg = document.querySelector('.starting-icon-big');
            if (startImg) {
                const avatar = options.avatarUrl || options.avatar || options.iconUrl || options.icon || options.backgroundUrl || options.background;
                startImg.src = avatar || 'assets/images/icon.png';
            }
        } catch (err) { console.warn('Failed to set starting image:', err); }

        // Start launch (handle both sync and Promise-returning implementations)
        try {
            console.log('Calling launch.Launch with opt:', opt);
            const maybePromise = launch.Launch(opt);
            // If returns a promise, await to catch immediate rejections
            if (maybePromise && typeof maybePromise.then === 'function') {
                await maybePromise.catch(launchErr => { throw launchErr; });
            }
            console.log('launch.Launch invoked successfully');
        } catch (launchErr) {
            console.error('launch.Launch threw an exception:', launchErr);
            let popupError = new popup();
            popupError.openPopup({ title: 'Error al lanzar', content: launchErr?.message || String(launchErr), color: 'red', options: true });
            ipcRenderer.send('main-window-progress-reset');
            if (infoStartingBOX) infoStartingBOX.style.display = "none";
            if (playInstanceBTN) playInstanceBTN.style.display = "flex";
            return;
        }
    }

    getdate(e) {
        let date = new Date(e);
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let allMonth = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return { year, month: allMonth[month - 1], day };
    }
}

export default Home;
