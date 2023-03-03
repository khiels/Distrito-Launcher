const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const { Client } = require('discord-rpc-patch')

let client
let activity

exports.initRPC = function(playerName){
    client = new Client({ transport: 'ipc' })
    const clientId = '792162609746411540'

    activity = {
        details: 'Jogando Online',
        state: `Treinador: ${playerName}`,
        largeImageKey: 'dist1',
        largeImageText: 'Distrito Pixelmon',
        smallImageKey: 'dist2',
        smallImageText: 'Versão 8.4.3',
        startTimestamp: new Date().getTime(),
        instance: false,
        buttons: [
            { label: 'Discord', url: 'https://discord.gg/Tjt5vXNn'},
            { label: 'Jogue Agora', url: 'https://www.distritopixelmon.com/download'}
        ]
    }

    client.on('ready', () => {
        logger.log('Discord RPC Conectado')
        client.setActivity(activity)
    })
    
    client.login({clientId: clientId}).catch(error => {
        if(error.message.includes('ENOENT')) {
            logger.log('Incapaz de inicializar o RPC, nenhum cliente detectado.')
        } else {
            logger.log('Incapaz de inicializar o RPC: ' + error.message, error)
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