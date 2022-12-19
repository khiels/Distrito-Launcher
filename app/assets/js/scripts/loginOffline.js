/**
 * Script for loginOffline.ejs
 */

// Login Elements
const loginOfflineUsername = document.getElementById('loginOfflineUsername')
const loginOfflineButton = document.getElementById('loginOfflineConfirm')
const loginOfflineNameError = document.getElementById('loginOfflineNameError')
const loginOfflineCancelContainer = document.getElementById('loginOfflineCancelContainer')
const loginOfflineCancelButton = document.getElementById('loginOfflineCancelButton')

const loggerOffline = LoggerUtil1('%c[LoginOffline]', 'color: #000668; font-weight: bold')

function toggleCancelButton(val) {
    if(val) {
        $(loginOfflineCancelContainer).show()
    } else {
        $(loginOfflineCancelContainer).hide()
    }
}

loginOfflineCancelButton.onclick = (e) => {
    switchView(getCurrentView(), loginViewOnCancel, 500, 500, () => {
        loginOfflineUsername.value = ''
        toggleCancelButton(false)
    })
}

loginOfflineUsername.addEventListener('focusout', (e) => {
    validateUsername(e.target.value)
    shakeError(loginOfflineNameError)
})

// Validate input for each field.
loginOfflineUsername.addEventListener('input', (e) => {
    validateUsername(e.target.value)
})

loginOfflineButton.addEventListener('click', async (e) => {
    let ref = await AuthManager.addAccount(loginOfflineUsername.value)
    updateSelectedAccount(ref)
    setTimeout(() => {
        switchView(VIEWS.loginOffline, VIEWS.landing, 500, 500, () => {
            prepareSettings()
            loginOfflineUsername.value = ''
            loginOfflineDisabled(true)
            loginViewOnSuccess = VIEWS.landing // Reset this for good measure.
            loginCancelEnabled(false) // Reset this for good measure.
            loginViewCancelHandler = null // Reset this for good measure.
            $('.circle-loader').toggleClass('load-complete')
            $('.checkmark').toggle()
            loginLoading(false)
            loginButton.innerHTML = loginButton.innerHTML.replace(Lang.queryJS('login.success'), Lang.queryJS('login.login'))
            formDisabled(false)
        })
    }, 0)
})


/**
 * Enable or disable the login offline button.
 * 
 * @param {boolean} v True to enable, false to disable.
 */
function loginOfflineDisabled(v){
    if(loginOfflineButton.disabled !== v){
        loginOfflineButton.disabled = v
    }
}

/**
 * Validate that an username field is neither empty nor invalid.
 * 
 * @param {string} value The username value.
 */
function validateUsername(value){
    if(value){
        if(validUsername.test(value) && value.length >= 3 && value.length <= 16){
            loginOfflineNameError.style.opacity = 0
            loginOfflineDisabled(false)
        } else {
            showError(loginOfflineNameError, Lang.queryJS('login.error.invalidValue'))
            loginOfflineDisabled(true)
        }
    } else {
        showError(loginOfflineNameError, Lang.queryJS('login.error.requiredValue'))
        loginOfflineDisabled(true)
    }
}