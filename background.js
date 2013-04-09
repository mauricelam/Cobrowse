// var syncedTabs = [];
var sockets = {};
var currentURL;
var serverURL;

chrome.browserAction.onClicked.addListener(function (tab) {
    if (tab.id in sockets) {
        delete sockets[tab.id];
        chrome.tabs.sendMessage(tab.id, {action: 'stop'});
    } else {
        if (!serverURL) {
            serverURL = prompt('Enter server URL', '127.0.0.1:3100');
        }
        var socket = sockets[tab.id] = io.connect(serverURL,  {'force new connection': true});
        socket.emit('id', {id:1});
        socket.on('init', function(data){
            console.log(data);
        });
        socket.on('error', function(data){
            console.log('error', data.id);
        });
        socket.on('action', function(data) {
            chrome.tabs.sendMessage(tab.id, {action: 'dispatchSerialEvent', data: data});
            // dispatchSerialEvent(data);
        });
        chrome.tabs.sendMessage(tab.id, {action: 'start', url: currentURL});
        // syncedTabs.push(tab.id);
        // chrome.tabs.executeScript(tab.id, { file: 'jquery.js' });
        // chrome.tabs.executeScript(tab.id, { file: 'socket.io.js' });
        // chrome.tabs.executeScript(tab.id, { file: 'inject.js' });
        
        if (!currentURL)
            currentURL = tab.url;
        console.log('url', currentURL);
    }
});

chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.action) {
        case 'sendEvent':
            // console.log('sendevent', message.eventString);
            sockets[sender.tab.id].emit('action', message.eventString);
            break;
        case 'getCurrentURL':
            sendResponse(currentURL);
            break;
        case 'shouldStart':
            sendResponse(sender.tab.id in sockets);
            break;
    }
});

chrome.tabs.onUpdated.addListener(function (tabid, changeInfo, tab) {
    if (tabid in sockets) {
        sockets[tabid].emit('action', JSON.stringify({ type:'locationchange', url: changeInfo.url }));

        // chrome.tabs.executeScript(tab.id, { file: 'jquery.js' });
        // chrome.tabs.executeScript(tab.id, { file: 'socket.io.js' });
        // chrome.tabs.executeScript(tab.id, { file: 'inject.js' });

        if (changeInfo.url) currentURL = changeInfo.url;
    }
});