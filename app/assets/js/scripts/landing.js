/**
 * Script for landing.ejs
 */
// Requirements

const cp                      = require('child_process')
const crypto                  = require('crypto')
const { URL }                 = require('url')
const { MojangRestAPI, getServerStatus }     = require('helios-core/mojang')

// Internal Requirements
const DiscordWrapper          = require('./assets/js/discordwrapper')
const ProcessBuilder          = require('./assets/js/processbuilder')
const { RestResponseStatus, isDisplayableError } = require('helios-core/common')
const { BrowserWindow } = require('@electron/remote')
const { data } = require('jquery')

// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launchProgressBar')
const launch_progress_label   = document.getElementById('launchProgressBarLabel')
const launchDetailsContainer  = document.getElementById('launchDetailsContainer')
const launch_button           = document.getElementById('launch_button')
const launch_details_text     = document.getElementById('launchProgressBarDetails')

const loggerLanding = LoggerUtil1('%c[Landing]', 'color: #000668; font-weight: bold')

/* Landing v2 */
const usernameText = document.getElementById('usernameText')
const userMcHead = document.getElementById('userMcHead')
const settingsButton = document.getElementById('settingsButton')

settingsButton.onclick = (e) => {
    prepareSettings()
    switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
        settingsNavItemListener(document.getElementById('settingsNavAccount'), false)
    })
}

let rpcFlag = false;
function updateSelectedUser(authUser){
    let username = 'Nenhuma Conta Selecionada'
    if(authUser != null){
        if(authUser.displayName != null)
            username = authUser.displayName
        userMcHead.src = `https://mc-heads.net/head/${authUser.displayName}`
        usernameText.textContent = username
    }
    usernameText.innerHTML = username

    if(!rpcFlag) {
        DiscordWrapper.initRPC(username);
        rpcFlag = true;
    }
    else {
        DiscordWrapper.updateUsername(authUser.displayName)
    }
        
}
updateSelectedUser(ConfigManager.getSelectedAccount())
// Lading v2 end

/* Launch Progress Wrapper Functions */

/**
 * Enable/disable the launch button.
 * 
 * @param {boolean} enabled true if button should be enabled.
 */
function toggleLaunchButton(enabled){
    launch_button.disabled = !enabled
}

/**
 * Show/hide the loading area.
 * 
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading){
    if(loading){
        launchDetailsContainer.style.display = 'flex'
        launch_button.style.display = 'none'
    } else {
        launchDetailsContainer.style.display = 'none'
        launch_button.style.display = 'initial'
    }
}


/**
 * Set the details text of the loading area.
 * 
 * @param {string} details The new text for the loading details.
 */
function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

/**
 * Set the value of the loading progress bar and display that value.
 * 
 * @param {number} value The progress value.
 * @param {number} max The total size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setLaunchPercentage(value, max, percent = ((value/max)*100)){
    launch_progress.setAttribute('max', max)
    launch_progress.setAttribute('value', value)
    launch_progress_label.innerHTML = percent + '%'
}

/**
 * Set the value of the OS progress bar and display that on the UI.
 * 
 * @param {number} value The progress value.
 * @param {number} max The total download size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setDownloadPercentage(value, max, percent = ((value/max)*100)){
    remote.getCurrentWindow().setProgressBar(value/max)
    setLaunchPercentage(value, max, percent)
}

/**
 * Enable or disable the launch button.
 * 
 * @param {boolean} val True to enable, false to disable.
 */
function setLaunchEnabled(val){
    document.getElementById('launch_button').disabled = !val
}

// Bind launch button
document.getElementById('launch_button').addEventListener('click', function(e){
    loggerLanding.log('Launching game..')
    const mcVersion = DistroManager.getDistribution().getServer(ConfigManager.getSelectedServer()).getMinecraftVersion()
    const jExe = ConfigManager.getJavaExecutable()
    if(jExe == null){
        asyncSystemScan(mcVersion)
    } else {

        setLaunchDetails(Lang.queryJS('landing.launch.pleaseWait'))
        toggleLaunchArea(true)
        setLaunchPercentage(0, 100)

        const jg = new JavaGuard(mcVersion)
        jg._validateJavaBinary(jExe).then((v) => {
            loggerLanding.log('Java version meta', v)
            if(v.valid){
                dlAsync()
            } else {
                asyncSystemScan(mcVersion)
            }
        })
    }
})

// Bind settings button
document.getElementById('userInfoContainer').onclick = (e) => {
    prepareSettings()
    switchView(getCurrentView(), VIEWS.settings)
}

// Bind selected account
function updateSelectedAccount(authUser){
    let username = 'Nenhuma Conta Selecionada'
    if(authUser != null){
        if(authUser.displayName != null){
            username = authUser.displayName
        }
        if(authUser.uuid != null){
            userMcHead.src = `https://mc-heads.net/head/${authUser.displayName}`
        }
    }
    usernameText.innerHTML = username
}
updateSelectedAccount(ConfigManager.getSelectedAccount())

// Bind selected server
function updateSelectedServer(serv){
    if(getCurrentView() === VIEWS.settings){
        saveAllModConfigurations()
    }
    ConfigManager.setSelectedServer(serv != null ? serv.getID() : null)
    ConfigManager.save()
    if(getCurrentView() === VIEWS.settings){
        animateModsTabRefresh()
    }
    setLaunchEnabled(serv != null)
}

/**
 * Shows an error overlay, toggles off the launch area.
 * 
 * @param {string} title The overlay title.
 * @param {string} desc The overlay description.
 */
function showLaunchFailure(title, desc){
    setOverlayContent(
        title,
        desc,
        'Okay'
    )
    setOverlayHandler(null)
    toggleOverlay(true)
    toggleLaunchArea(false)
}

let logWindow;
let logsData = '';
function showLogWindow() {
    if(logWindow)
        logWindow.close();

    logWindow = new BrowserWindow({
        title: 'Crash Logs',
        backgroundColor: '#0c0c0c',
        frame: true
    })

    logWindow.on('closed', () => {
        logWindow = null;
        logsData = '';
    })

    logWindow.removeMenu();
    logWindow.setBackgroundColor("#ffffff")
    logWindow.loadFile('./app/logs.ejs')

    const jsCode = 'setLogs(`'+logsData.trim().replace(/\\/g,"\\\\")+'`);';
    logWindow.webContents.executeJavaScript(jsCode);
    logWindow.show();
}

/* System (Java) Scan */

let sysAEx
let scanAt

let extractListener

/**
 * Asynchronously scan the system for valid Java installations.
 * 
 * @param {string} mcVersion The Minecraft version we are scanning for.
 * @param {boolean} launchAfter Whether we should begin to launch after scanning. 
 */
function asyncSystemScan(mcVersion, launchAfter = true){

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    const loggerSysAEx = LoggerUtil1('%c[SysAEx]', 'color: #353232; font-weight: bold')

    const forkEnv = JSON.parse(JSON.stringify(process.env))
    forkEnv.CONFIG_DIRECT_PATH = ConfigManager.getLauncherDirectory()

    // Fork a process to run validations.
    sysAEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        'JavaGuard',
        mcVersion
    ], {
        env: forkEnv,
        stdio: 'pipe'
    })
    // Stdout
    sysAEx.stdio[1].setEncoding('utf8')
    sysAEx.stdio[1].on('data', (data) => {
        loggerSysAEx.log(data)
    })
    // Stderr
    sysAEx.stdio[2].setEncoding('utf8')
    sysAEx.stdio[2].on('data', (data) => {
        loggerSysAEx.log(data)
    })
    
    sysAEx.on('message', (m) => {

        if(m.context === 'validateJava'){
            if(m.result == null){
                // If the result is null, no valid Java installation was found.
                // Show this information to the user.
                setOverlayContent(
                    'Nenhum JAVA compativel foi encontrado.',
                    'Para jogar você precisa de uma instalação x64 do JAVA 8, gostaria de instalar?',
                    'Instalar Java',
                    'Instalar Manualmente'
                )
                setOverlayHandler(() => {
                    setLaunchDetails('Iniciando download do Java')
                    sysAEx.send({task: 'changeContext', class: 'AssetGuard', args: [ConfigManager.getCommonDirectory(),ConfigManager.getJavaExecutable()]})
                    sysAEx.send({task: 'execute', function: '_enqueueOpenJDK', argsArr: [ConfigManager.getDataDirectory()]})
                    toggleOverlay(false)
                })
                setDismissHandler(() => {
                    $('#overlayContent').fadeOut(250, () => {
                        //$('#overlayDismiss').toggle(false)
                        setOverlayContent(
                            'O Java é obrigatório<br>para jogar',
                            'Uma instalação do java 8 x64 é necessária.<br>',
                            'Entendi',
                            'Voltar'
                        )
                        setOverlayHandler(() => {
                            toggleLaunchArea(false)
                            toggleOverlay(false)
                        })
                        setDismissHandler(() => {
                            toggleOverlay(false, true)
                            asyncSystemScan()
                        })
                        $('#overlayContent').fadeIn(250)
                    })
                })
                toggleOverlay(true, true)

            } else {
                // Java installation found, use this to launch the game.
                ConfigManager.setJavaExecutable(m.result)
                ConfigManager.save()

                // We need to make sure that the updated value is on the settings UI.
                // Just incase the settings UI is already open.
                settingsJavaExecVal.value = m.result
                populateJavaExecDetails(settingsJavaExecVal.value)

                if(launchAfter){
                    dlAsync()
                }
                sysAEx.disconnect()
            }
        } else if(m.context === '_enqueueOpenJDK'){

            if(m.result === true){

                // Oracle JRE enqueued successfully, begin download.
                setLaunchDetails('Baixando o Java..')
                sysAEx.send({task: 'execute', function: 'processDlQueues', argsArr: [[{id:'java', limit:1}]]})

            } else {

                // Oracle JRE enqueue failed. Probably due to a change in their website format.
                // User will have to follow the guide to install Java.
                setOverlayContent(
                    'Erro inesperado:<br>Download do JAVA falhou.',
                    'Infelizmente não conseguimos instalar o java, será necessário realizar uma instalação manual.',
                    'Entendi'
                )
                setOverlayHandler(() => {
                    toggleOverlay(false)
                    toggleLaunchArea(false)
                })
                toggleOverlay(true)
                sysAEx.disconnect()

            }

        } else if(m.context === 'progress'){

            switch(m.data){
                case 'download':
                    // Downloading..
                    setDownloadPercentage(m.value, m.total, m.percent)
                    break
            }

        } else if(m.context === 'complete'){

            switch(m.data){
                case 'download': {
                    // Show installing progress bar.
                    remote.getCurrentWindow().setProgressBar(2)

                    // Wait for extration to complete.
                    const eLStr = 'Extraindo'
                    let dotStr = ''
                    setLaunchDetails(eLStr)
                    extractListener = setInterval(() => {
                        if(dotStr.length >= 3){
                            dotStr = ''
                        } else {
                            dotStr += '.'
                        }
                        setLaunchDetails(eLStr + dotStr)
                    }, 750)
                    break
                }
                case 'java':
                // Download & extraction complete, remove the loading from the OS progress bar.
                    remote.getCurrentWindow().setProgressBar(-1)

                    // Extraction completed successfully.
                    ConfigManager.setJavaExecutable(m.args[0])
                    ConfigManager.save()

                    if(extractListener != null){
                        clearInterval(extractListener)
                        extractListener = null
                    }

                    setLaunchDetails('Java Instalado!')

                    if(launchAfter){
                        dlAsync()
                    }

                    sysAEx.disconnect()
                    break
            }

        } else if(m.context === 'error'){
            console.log(m.error)
        }
    })

    // Begin system Java scan.
    setLaunchDetails('Checando informações do sistema..')
    sysAEx.send({task: 'execute', function: 'validateJava', argsArr: []})

}

// Keep reference to Minecraft Process
let proc
// Is DiscordRPC enabled
let hasRPC = true
// Joined server regex
// Change this if your server uses something different.
const GAME_JOINED_REGEX = /\[.+\]: Sound engine started/
const GAME_LAUNCH_REGEX = /^\[.+\]: (?:MinecraftForge .+ Initialized|ModLauncher .+ starting: .+)$/
const MIN_LINGER = 5000

let aEx
let serv
let versionData
let forgeData

let progressListener

function dlAsync(login = true){

    // Login parameter is temporary for debug purposes. Allows testing the validation/downloads without
    // launching the game.

    if(login) {
        if(ConfigManager.getSelectedAccount() == null){
            loggerLanding.error('Você deve estar conectado em uma conta.')
            return
        }
    }

    setLaunchDetails('Aguarde..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    const loggerAEx = LoggerUtil1('%c[AEx]', 'color: #353232; font-weight: bold')
    const loggerLaunchSuite = LoggerUtil1('%c[LaunchSuite]', 'color: #000668; font-weight: bold')

    const forkEnv = JSON.parse(JSON.stringify(process.env))
    forkEnv.CONFIG_DIRECT_PATH = ConfigManager.getLauncherDirectory()

    // Start AssetExec to run validations and downloads in a forked process.
    aEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        'AssetGuard',
        ConfigManager.getCommonDirectory(),
        ConfigManager.getJavaExecutable()
    ], {
        env: forkEnv,
        stdio: 'pipe'
    })
    // Stdout
    aEx.stdio[1].setEncoding('utf8')
    aEx.stdio[1].on('data', (data) => {
        loggerAEx.log(data)
    })
    // Stderr
    aEx.stdio[2].setEncoding('utf8')
    aEx.stdio[2].on('data', (data) => {
        loggerAEx.log(data)
    })
    aEx.on('error', (err) => {
        loggerLaunchSuite.error('Error during launch', err)
        showLaunchFailure('Erro durante a inicialização', err.message || 'Cheque o console (CTRL + Shift + i) para mais detalhes.')
    })
    aEx.on('close', (code, signal) => {
        if(code !== 0){
            loggerLaunchSuite.error(`AssetExec exited with code ${code}, assuming error.`)
            showLaunchFailure('Erro durante a inicialização', 'Cheque o console (CTRL + Shift + i) para mais detalhes.')
        }
    })

    // Establish communications between the AssetExec and current process.
    aEx.on('message', (m) => {

        if(m.context === 'validate'){
            switch(m.data){
                case 'distribution':
                    setLaunchPercentage(20, 100)
                    loggerLaunchSuite.log('Validated distibution index.')
                    setLaunchDetails('Carregando informações da versão..')
                    break
                case 'version':
                    setLaunchPercentage(40, 100)
                    loggerLaunchSuite.log('Version data loaded.')
                    setLaunchDetails('Validando integridade dos recursos..')
                    break
                case 'assets':
                    setLaunchPercentage(60, 100)
                    loggerLaunchSuite.log('Asset Validation Complete')
                    setLaunchDetails('Validando integridade das bibliotecas..')
                    break
                case 'libraries':
                    setLaunchPercentage(80, 100)
                    loggerLaunchSuite.log('Library validation complete.')
                    setLaunchDetails('Validando integridade dos arquivos variados..')
                    break
                case 'files':
                    setLaunchPercentage(100, 100)
                    loggerLaunchSuite.log('File validation complete.')
                    setLaunchDetails('Baixando arquivos..')
                    break
            }
        } else if(m.context === 'progress'){
            switch(m.data){
                case 'assets': {
                    const perc = (m.value/m.total)*20
                    setLaunchPercentage(40+perc, 100, parseInt(40+perc))
                    break
                }
                case 'download':
                    setDownloadPercentage(m.value, m.total, m.percent)
                    break
                case 'extract': {
                    // Show installing progress bar.
                    remote.getCurrentWindow().setProgressBar(2)

                    // Download done, extracting.
                    const eLStr = 'Extraindo bibliotecas'
                    let dotStr = ''
                    setLaunchDetails(eLStr)
                    progressListener = setInterval(() => {
                        if(dotStr.length >= 3){
                            dotStr = ''
                        } else {
                            dotStr += '.'
                        }
                        setLaunchDetails(eLStr + dotStr)
                    }, 750)
                    break
                }
            }
        } else if(m.context === 'complete'){
            switch(m.data){
                case 'download':
                    // Download and extraction complete, remove the loading from the OS progress bar.
                    remote.getCurrentWindow().setProgressBar(-1)
                    if(progressListener != null){
                        clearInterval(progressListener)
                        progressListener = null
                    }

                    setLaunchDetails('Preparando para iniciar..')
                    break
            }
        } else if(m.context === 'error'){
            switch(m.data){
                case 'download':
                    loggerLaunchSuite.error('Error while downloading:', m.error)
                    
                    if(m.error.code === 'ENOENT'){
                        showLaunchFailure(
                            'Erro no Download',
                            'Não foi possivel conectar ao servidor de arquivos. Certifique-se de que você está conectado a internet e tente novamente.'
                        )
                    } else {
                        showLaunchFailure(
                            'Erro no Download',
                            'Verifique o console (CTRL + Shift + i) para mais detalhes. Por favor tente novamente.'
                        )
                    }

                    remote.getCurrentWindow().setProgressBar(-1)

                    // Disconnect from AssetExec
                    aEx.disconnect()
                    break
            }
        } else if(m.context === 'validateEverything'){

            let allGood = true

            // If these properties are not defined it's likely an error.
            if(m.result.forgeData == null || m.result.versionData == null){
                loggerLaunchSuite.error('Error during validation:', m.result)

                loggerLaunchSuite.error('Error during launch', m.result.error)
                showLaunchFailure('Erro durante a inicialização', 'Verifique o console (CTRL + Shift + i) para mais detalhes.')

                allGood = false
            }

            forgeData = m.result.forgeData
            versionData = m.result.versionData

            if(login && allGood) {
                const authUser = ConfigManager.getSelectedAccount()
                loggerLaunchSuite.log(`Sending selected account (${authUser.displayName}) to ProcessBuilder.`)
                let pb = new ProcessBuilder(serv, versionData, forgeData, authUser, remote.app.getVersion())
                setLaunchDetails('Iniciando o jogo..')

                // const SERVER_JOINED_REGEX = /\[.+\]: \[CHAT\] [a-zA-Z0-9_]{1,16} joined the game/
                const SERVER_JOINED_REGEX = new RegExp(`\\[.+\\]: \\[CHAT\\] ${authUser.displayName} joined the game`)

                const onLoadComplete = () => {
                    toggleLaunchArea(false)
                    toggleLaunchButton(false)
                    proc.stdout.removeListener('data', tempListener)
                    proc.stderr.removeListener('data', gameErrorListener)
                }
                const start = Date.now()

                // Attach a temporary listener to the client output.
                // Will wait for a certain bit of text meaning that
                // the client application has started, and we can hide
                // the progress bar stuff.
                const tempListener = function(data){
                    logsData += '\n' + data.trim();
                    if(GAME_LAUNCH_REGEX.test(data.trim())){
                        const diff = Date.now()-start
                        if(diff < MIN_LINGER) {
                            setTimeout(onLoadComplete, MIN_LINGER-diff)
                        } else {
                            onLoadComplete()
                        }
                    }
                }

                const gameErrorListener = function(data){
                    data = data.trim()
                    if(data.indexOf('Could not find or load main class net.minecraft.launchwrapper.Launch') > -1){
                        loggerLaunchSuite.error('Game launch failed, LaunchWrapper was not downloaded properly.')
                        showLaunchFailure('Erro durante a inicialização', 'Não foi possivel baixar o arquivo principal corretamente. Como resultado, o jogo não foi inicializado.<br><br>Para resolver esse problema, desative temporariamente seu antivirus e inicie o jogo novamente.')
                    }
                }

                try {
                    // Build Minecraft process.
                    proc = pb.build()

                    // Bind listeners to stdout.
                    proc.stdout.on('data', tempListener)
                    proc.stderr.on('data', gameErrorListener)

                    setLaunchDetails('Pronto. Divirta-se!')

                    proc.on('close', (code, signal) => {
                        toggleLaunchButton(true)
                        if(code != 0) {
                            showLogWindow();
                        }
                    })

                } catch(err) {

                    loggerLaunchSuite.error('Error during launch', err)
                    showLaunchFailure('Erro durante a inicialização', 'Por favor verifique o console (CTRL + Shift + i) para mais detalhes.')

                }
            }

            // Disconnect from AssetExec
            aEx.disconnect()

        }
    })

    // Begin Validations

    // Validate Forge files.
    setLaunchDetails('Carregando informações do servidor..')

    refreshDistributionIndex(true, (data) => {
        onDistroRefresh(data)
        serv = data.getServer(ConfigManager.getSelectedServer())
        aEx.send({task: 'execute', function: 'validateEverything', argsArr: [ConfigManager.getSelectedServer(), DistroManager.isDevMode()]})
    }, (err) => {
        loggerLaunchSuite.log('Error while fetching a fresh copy of the distribution index.', err)
        refreshDistributionIndex(false, (data) => {
            onDistroRefresh(data)
            serv = data.getServer(ConfigManager.getSelectedServer())
            aEx.send({task: 'execute', function: 'validateEverything', argsArr: [ConfigManager.getSelectedServer(), DistroManager.isDevMode()]})
        }, (err) => {
            loggerLaunchSuite.error('Unable to refresh distribution index.', err)
            if(DistroManager.getDistribution() == null){
                showLaunchFailure('Erro Fatal', 'Não foi possivel carregar uma cópia do distribution index. Veja o console (CTRL + Shift + i) para mais detalhes.')

                // Disconnect from AssetExec
                aEx.disconnect()
            } else {
                serv = data.getServer(ConfigManager.getSelectedServer())
                aEx.send({task: 'execute', function: 'validateEverything', argsArr: [ConfigManager.getSelectedServer(), DistroManager.isDevMode()]})
            }
        })
    })
}

/**
 * News Loading Functions
 */
const news_slider                  = document.getElementById('news_slider')
const nav_dots                     = document.getElementById('navDots')
let currentSlideIndex = 0

loadNewsJson()
initNavDots()
setInterval(() => {
    currentSlideIndex = showSlide(currentSlideIndex+1)
}, 10000)



function initNavDots() {
    const slides = document.getElementsByClassName('slider_item')
    for(let i = 0; i <= slides.length; i++) {
        const dot = document.createElement('div')
        dot.classList.add('navDot')
        if(i == 0)
            dot.classList.add('active')
        dot.onclick = () => {
            currentSlideIndex = showSlide(i)
        }
        dot.setAttribute('index', i)
        nav_dots.appendChild(dot)
    }

    if(slides.length <= 1)
        nav_dots.style.display = 'none'
}


function showSlide(index) {
    const slides = document.getElementsByClassName('slider_item')
    if(!slides) return

    if(index >= slides.length)
        index = 0
    else if(index < 0)
        index = slides.length-1

    for(let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        if(i == index)
            slide.style.display = 'flex'
        else
            slide.style.display = 'none'
    }

    const dotNavs = document.getElementsByClassName('navDot')
    if(dotNavs) {
        for(const dot of dotNavs) {
            const dotindex = dot.getAttribute('index')
            if(dotindex == index)
                dot.classList.add('active')
            else
                dot.classList.remove('active')
        }
    }

    return index
}
async function loadNewsJson() {
    try {
        const headers = new Headers()
        headers.append('cache-control', 'no-cache')
        headers.append('pragma', 'no-cache')

        const options = { 
            method: 'GET',
            headers: headers,
        }

        const data = await fetch('http://launcher.distritopixelmon.com/distritopixelmon.json', options)
        const news = await data.json()

        news_slider.innerHTML=''

        for(const value of news) {
            let readMore = ''
            if(value.link)
                readMore = `<a class="readmore" href="${value.link}">Ver mais...</a>`

            news_slider.innerHTML += `
                <div class="slider_item" style="display: none">
                    <div class="slideshowHeading">${value.title}</div>
                    <div class="slideshowContent">${value.description}</div>
                    <img class="newsImage" src="${value.imageURL || './assets/images/render2.png'}">
                    ${readMore}
                </div>
            `
        }
        currentSlideIndex = showSlide(0)
    }
    catch(e) {
        console.log('A problem occurred trying to fetch news')
    }
}