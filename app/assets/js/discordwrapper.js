// Work in progress
const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const { Client } = require('discord-rpc-patch')

let client
let activity

exports.initRPC = function(playerName){
    client = new Client({ transport: 'ipc' })
    const clientId = '490193730033287168'

    activity = {
        details: 'Jogando Online',
        state: `Treinador: ${playerName}`,
        largeImageKey: 'pxbr1',
        largeImageText: 'Pixelmon Brasil',
        smallImageKey: 'pxbr2',
        smallImageText: 'Versão 8.3.8',
        startTimestamp: new Date().getTime(),
        instance: false,
        buttons: [
            { label: 'Discord', url: 'https://discord.com/invite/pxbr'},
            { label: 'Jogue Agora', url: 'https://www.pixelmonbrasil.com.br/download'}
        ]
    }

    client.on('ready', () => {
        logger.log('Discord RPC Connected')
        client.setActivity(activity)
    })
    
    client.login({clientId: clientId}).catch(error => {
        if(error.message.includes('ENOENT')) {
            logger.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            logger.log('Unable to initialize Discord Rich Presence: ' + error.message, error)
        }
    })
}

exports.updateDetails = function(details){
    activity.details = details
    client.setActivity(activity)
}

exports.updateUsername = function(username) {
    activity.state = `Treinador: ${username}`
    activity.details = 'Jogando Online'
    client.setActivity(activity)
}

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}