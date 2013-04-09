function copyStyle() {
    // copy the style from :hover to l-l-l-hover
    var newstyle = '';
    var styles = document.styleSheets;
    for(var i=0, len=styles.length; i < len; i++) {

        var sheet = styles[i], rules = sheet.cssRules;
        if (!rules) {
            console.log('no css rules');
            continue;
        }
        // console.log(rules);
        for(var j=0, len2=rules.length; j<len2;j++) {
        
            var rule = rules[j];
            if(rule && rule.selectorText && rule.selectorText.indexOf(':hover') > -1){
                newstyle += rule.cssText.replace(/:hover/g, '.l-l-l-hover');
            }
        }
    }
    var styleTag = document.createElement('style');
    styleTag.id = 'fakehover';
    styleTag.textContent = newstyle;
    document.head.appendChild(styleTag);
}

function getParentWithId(element) {
    var parent = element.parentNode;
    while (parent && !parent.id && !parent.href) {
        parent = parent.parentNode;
    }
    return parent;
}

function generateImmediateQuery(element) {
    var queryString = element.tagName;
    var id = element.id;
    if (id) queryString += '#' + id;
    if (element.className) queryString += '.' + element.className.trim().replace(/[ \n\t]+/g, '.');
    if (element.href) {
        queryString += '[href="' + element.getAttribute('href') + '"]';
    }
    // console.log(queryString);
    return queryString;
}

function generateQuery(element) {
    if (document.isEqualNode(element)) {
        return 'document';
    }
    if (element == window) {
        return 'window';
    }
    var queryString;
    var current = element;
    do {
        var immediateQuery = generateImmediateQuery(current);
        queryString = (queryString) ? immediateQuery + ' ' + queryString : immediateQuery;
        current = getParentWithId(current, immediateQuery);
        // console.log(queryString);
    } while (current && document.querySelectorAll(queryString).length > 1);
    if (queryString) queryString = queryString.replace(/\%/g, '+++');
    return queryString;
}

function restoreElement(query) {
    if (query) query = query.replace('+++', '%');
    if (query === 'document') {
        return document;
    } else if (query === 'window') {
        return window;
    } else {
        return document.querySelector(query);
    }
}

function stringifyEvent(event) {
    var obj = {};
    for (var i in event) {
        if (typeof event[i] === 'function') {
            continue;
        } else if (event[i] instanceof Node) {
            obj[i] = { '-element': generateQuery(event[i]) };
        } else if (typeof event[i] === 'number') {
            obj[i] = event[i];
        } else if (i === 'view' || i === 'currentTarget' || i === 'originalEvent' || i === 'delegateTarget' || i === 'handleObj') {
            // these things are making cyclic object
        } else {
            obj[i] = event[i];
            // console.log(i, event[i]);
        }
    }
    return JSON.stringify(obj);
}

var lastScrollTop = 0, lastScrollLeft = 0;
var lastVal;

function dispatchSerialEvent (str) {
    var obj = JSON.parse(str);
    var target, relatedTarget;
    try {
        target = restoreElement(obj.target['-element']);
        relatedTarget = (obj.relatedTarget) ? restoreElement(obj.relatedTarget['-element']) : null;

        if (obj.val !== undefined) lastVal = target.value = obj.val;
    } catch (e) {}

    var event;
    if (obj.type === 'mousewheel') {
        event = document.createEvent('WheelEvent');
        event.initWebKitWheelEvent(obj.wheelDeltaX, obj.wheelDeltaY, null, obj.screenX, obj.screenY, obj.clientX, obj.clientY, obj.ctrlKey, obj.altKey, obj.shiftKey, obj.metaKey);
    } else if (obj.type === 'scroll') {
        if (target === document) target = document.body;
        target.scrollTop = obj.scrollTop;
        target.scrollLeft = obj.scrollLeft;
        lastScrollTop = obj.scrollTop;
        lastScrollLeft = obj.scrollLeft;
    } else if (obj.type === 'locationchange') {
        if (obj.url) {
            location.href = obj.url;
        }
    } else if (obj.type.indexOf('key') > -1) {
        event = document.createEvent('KeyboardEvent');
        event.initKeyboardEvent(obj.type, obj.bubbles, obj.cancelable, null, obj.ctrlKey, obj.altKey, obj.shiftKey, obj.metaKey, obj.keyCode, obj.charCode);
    } else {
        event = document.createEvent('MouseEvents');
        event.initMouseEvent(obj.type, obj.bubbles, obj.cancelable, null, obj.detail, obj.screenX, obj.screenY, obj.clientX, obj.clientY, obj.ctrlKey, obj.altKey, obj.shiftKey, obj.metaKey, obj.button, relatedTarget);
    }
    if (obj.type === 'mouseover') {
        // console.log('mouseenter');
        $(target).parents().not('.l-l-l-hover').addClass('l-l-l-hover');
        // console.log(obj.target['-element'], target);
    } else if (obj.type === 'mouseout') {
        var elems = $('.l-l-l-hover');
        if (relatedTarget) {
            elems = elems.not($(relatedTarget).parents());
        }
        elems.removeClass('l-l-l-hover');
    }
    if (event) {
        event['-cobrowse'] = true;
        if (target) target.dispatchEvent(event);
    }
}

chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.action) {
        case 'dispatchSerialEvent':
            dispatchSerialEvent(message.data);
            break;
        case 'start':
            start(message.url);
            break;
        case 'stop':
            stop();
    }
});

chrome.extension.sendMessage({'action': 'shouldStart'}, function (shouldStart) {
    if (shouldStart) {
        start(null);
    }
});

function start(url) {
    console.log('initialize', url);
    if (url) location.href = url;

    var mouseEvents = ['mousedown', 'mouseup', 'click', 'dblclick', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'contextmenu', 'show', 'mousewheel'];
    var keyboardEvents = ['keydown', 'keyup', 'keypress', 'scroll', 'change', 'focus', 'blur'];
    var eventTypes = [mouseEvents, keyboardEvents];

    var enabled = true;

    var repeater = function (e) {
        if (!e['-cobrowse'] && enabled) {
            if (e.type === 'scroll') {
                var target = (document.isEqualNode(e.target)) ? document.body : e.target;
                if (target.scrollTop == lastScrollTop && target.scrollLeft == lastScrollLeft) {
                    // do not send if scroll positions not updated
                    return;
                }
                e.scrollTop = target.scrollTop;
                e.scrollLeft = target.scrollLeft;
            }
            if (lastVal != e.target.value) {
                e.val = e.target.value;
            }
            chrome.extension.sendMessage({action: 'sendEvent', eventString: stringifyEvent(e)});
        }
    };

    for (var i = 0, count = eventTypes.length; i < count; i++) {
        for (var j = 0, count2 = eventTypes[i].length; j < count2; j++) {
            var eventType = eventTypes[i][j];
            window.addEventListener(eventType, repeater, true);
        }
    }

    // Capture the URL and the scroll position
    var url = location.href;
    var allElements = document.querySelectorAll('*');
    var scrollPositions = {};
    for (var i = 0, count = allElements.length; i < count; i++) {
        var element = allElements[i];
        if (element.scrollTop !== 0) {
            scrollPositions[generateQuery(element)] = element.scrollTop;
        }
    }
    // setTimeout(copyStyle, 1500);
}

document.addEventListener('DOMContentLoaded', copyStyle, true);

function stop () {
    location.reload(true);
}